import fs from 'fs';
import { upsertToFeishuSheet } from './services/feishuUpsert.js';
import { fetchAndProcessData } from './services/adjustService.js';
import { syncToFeishu } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const block = config.data_blocks.find((b: any) => b.id === 'block_roi_all_80');
    if (!block) throw new Error("Block not found");
    
    console.log("Fetching block:", block.name);
    const data = await fetchAndProcessData(config, block, '2026-04-01', '2026-04-02', [], undefined, true);
    console.log("Data length:", data.length);
    
    if (data.length > 0) {
      console.log("Sample data:", data[0]);
      const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
      const sheetId = '5PnClN';
      
      console.log("Syncing to Feishu...");
      const result = await syncToFeishu(config, data, spreadsheetToken, sheetId);
      console.log("Result:", result);
    }
  } catch (e) {
    console.error(e);
  }
}
run();
