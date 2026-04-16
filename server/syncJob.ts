import { getAppConfig } from './config.js';
import { fetchAndProcessData, fetchApps } from '../services/adjustService.js';
import { syncToFeishu } from '../services/feishuService.js';
import { ProcessedRow } from '../types.js';

const DEFAULT_AUTO_SYNC_START_DATE = '2025-12-01';

export async function runAutoSync(force: boolean = false) {
  const config = getAppConfig();
  if (!config || (!config.feishu_config?.auto_sync_enabled && !force)) {
    console.log("Auto sync is disabled or not configured.");
    return { success: false, message: "Auto sync is disabled or not configured." };
  }

  console.log("Starting Feishu Auto Sync...");

  try {
    const end = new Date();
    const startDateStr = config.feishu_config.auto_sync_start_date || DEFAULT_AUTO_SYNC_START_DATE;
    const endDateStr = end.toISOString().split('T')[0];

    console.log(`Fetching Adjust data from ${startDateStr} to ${endDateStr}...`);

    let selectedBlocks = config.feishu_config.selected_blocks || [];
    if (selectedBlocks.length === 0) {
      selectedBlocks = config.data_blocks.map(b => b.id);
    }

    const mappings = config.feishu_config.app_mappings || [];
    const mappedApps = new Set<string>();

    let selectedApps = config.feishu_config.selected_apps || [];
    if (selectedApps.length === 0) {
      console.log("No apps selected, fetching all available apps...");
      const apps = await fetchApps(config.adjust_api.user_token, config.adjust_api.use_proxy);
      selectedApps = apps.map(a => a.token);
    }

    const defaultToken = config.feishu_config.spreadsheet_token;
    const targetSheetId = config.feishu_config.sheet_id || 'auto';

    // Collect all required blocks (selected + mapped)
    const requiredBlocks = new Set<string>(selectedBlocks);
    for (const m of mappings) {
      if (m.sheet_mappings) {
        for (const sm of m.sheet_mappings) {
          if (sm.blockId) requiredBlocks.add(sm.blockId);
        }
      }
    }

    let totalUpdated = 0;
    let totalAppended = 0;

    // Pre-fetch all required blocks in parallel to speed up the process
    const blockDataMap = new Map<string, ProcessedRow[]>();
    console.log(`Pre-fetching ${requiredBlocks.size} blocks in parallel...`);
    
    const preFetchPromises = Array.from(requiredBlocks).map(async (blockId) => {
      const block = config.data_blocks.find(b => b.id === blockId);
      if (block) {
        console.log(`[Pre-fetch] Starting: ${block.name}`);
        const data = await fetchAndProcessData(config, block, startDateStr, endDateStr, [], undefined, force);
        console.log(`[Pre-fetch] Completed: ${block.name} (${data.length} rows)`);
        return { blockId, data };
      }
      return null;
    });

    const preFetchResults = await Promise.all(preFetchPromises);
    for (const res of preFetchResults) {
      if (res) blockDataMap.set(res.blockId, res.data);
    }

    console.log("Pre-fetching completed. Starting data processing and sync...");

    // 1. Process explicitly mapped apps
    for (const m of mappings) {
      if (!m.appName || !m.spreadsheet_token) continue;
      const apps = m.appName.split(',').map(s => s.trim()).filter(Boolean);
      for (const app of apps) mappedApps.add(app);

      // For mapped apps, we process all blocks that have a mapping, or fallback to selectedBlocks if no specific mappings exist
      const blocksToProcess = m.sheet_mappings && m.sheet_mappings.length > 0 
        ? m.sheet_mappings.map(sm => sm.blockId) 
        : selectedBlocks;

      for (const blockId of blocksToProcess) {
        const block = config.data_blocks.find(b => b.id === blockId);
        if (!block) continue;

        console.log(`Processing block: ${block.name} for mapped apps [${apps.join(',')}]...`);
        const blockData = blockDataMap.get(blockId) || [];
        const filtered = blockData.filter(r => apps.includes(r.appToken || '') || apps.includes(r.appName || ''));
        
        if (filtered.length > 0) {
          // Find specific sheet mapping for this block, fallback to 'auto'
          const sheetMapping = m.sheet_mappings?.find(sm => sm.blockId === blockId);
          const specificSheetId = sheetMapping?.sheetId || 'auto';
          
          console.log(`Syncing ${filtered.length} rows to Feishu token ${m.spreadsheet_token}, sheet ${specificSheetId}...`);
          const result = await syncToFeishu(config, filtered, m.spreadsheet_token, specificSheetId);
          totalUpdated += result.data?.updated || 0;
          totalAppended += result.data?.appended || 0;
        }
      }
    }

    // 2. Process unmapped apps (fallback to default token)
    if (defaultToken) {
      const unmappedApps = selectedApps.filter(a => !mappedApps.has(a));
      if (unmappedApps.length > 0) {
        console.log(`Syncing unmapped apps [${unmappedApps.join(', ')}] to default token ${defaultToken}...`);
        let allProcessedData: ProcessedRow[] = [];
        
        for (const blockId of selectedBlocks) {
          const block = config.data_blocks.find(b => b.id === blockId);
          if (!block) continue;
          
          console.log(`Processing block: ${block.name} for unmapped apps...`);
          const blockData = blockDataMap.get(blockId) || [];
          const filtered = blockData.filter(r => unmappedApps.includes(r.appToken || '') || unmappedApps.includes(r.appName || ''));
          allProcessedData.push(...filtered);
        }

        if (allProcessedData.length > 0) {
          console.log(`Syncing ${allProcessedData.length} rows to default Feishu token...`);
          const result = await syncToFeishu(config, allProcessedData, defaultToken, targetSheetId);
          totalUpdated += result.data?.updated || 0;
          totalAppended += result.data?.appended || 0;
        }
      }
    }

    console.log("Auto sync completed successfully.");
    return { success: true, result: { updated: totalUpdated, appended: totalAppended } };

  } catch (e: any) {
    console.error("Auto sync failed:", e);
    throw e;
  }
}
