import { AppConfig } from '../types';
import { getTenantAccessToken } from './feishuService';

function normalizeDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const summaryMonthMatch = trimmed.match(/(\d{2,4})[-/年](\d{1,2})(?:月)?汇总$/);
    if (summaryMonthMatch) {
      const rawYear = summaryMonthMatch[1];
      const y = rawYear.length === 2 ? `20${rawYear}` : rawYear;
      const m = summaryMonthMatch[2].padStart(2, '0');
      return `${y}-${m}__summary__`;
    }

    const fullMatch = trimmed.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
    if (fullMatch) {
      const y = fullMatch[1];
      const m = fullMatch[2].padStart(2, '0');
      const d = fullMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    const monthMatch = trimmed.match(/(\d{2,4})[-/年](\d{1,2})(?:月)?$/);
    if (monthMatch) {
      const rawYear = monthMatch[1];
      const y = rawYear.length === 2 ? `20${rawYear}` : rawYear;
      const m = monthMatch[2].padStart(2, '0');
      return `${y}-${m}`;
    }
  }
  return String(val);
}

function jsDateToExcel(dateStr: string) {
  const normalized = /^\d{4}-\d{2}$/.test(dateStr) ? `${dateStr}-01` : dateStr;
  const d = new Date(normalized);
  return (d.getTime() / (86400 * 1000)) + 25569;
}

function getColStr(idx: number) {
  if (idx >= 26) {
    const firstChar = String.fromCharCode(64 + Math.floor(idx / 26));
    const secondChar = String.fromCharCode(65 + (idx % 26));
    return `${firstChar}${secondChar}`;
  }
  return String.fromCharCode(65 + idx);
}

function cleanValue(val: any): any {
  // 直接返回原始值，保留 formatCurrency 和 formatPercent 生成的字符串格式
  // 这样可以确保飞书上显示的内容与代码中格式化的一致，避免被错误地转换为纯数字
  return val;
}

export async function upsertToFeishuSheet(
  config: AppConfig,
  spreadsheetToken: string,
  sheetId: string,
  header: string[],
  rows: any[][],
  sheetTitle?: string
) {
  const token = await getTenantAccessToken(config);
  const useProxy = typeof window !== 'undefined' && config.adjust_api.use_proxy;
  
  // Clean rows
  const cleanedRows = rows.map(row => row.map(cleanValue));
  
  // 1. Read existing data
  let readUrl = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A:AZ`;
  if (useProxy) readUrl = `/api/feishu/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A:AZ`;
  
  const readRes = await fetch(readUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const readData = await readRes.json();
  const existingValues: any[][] = readData.data?.valueRange?.values || [];
  
  // 辅助函数：标准化表头名称，去除空格、括号、斜杠、美元符号等特殊字符，转小写
  const normalize = (s: any) => {
    if (typeof s !== 'string') return String(s || '').trim();
    // 移除所有非字母数字和非中文字符，保留下划线
    return s.replace(/[^\w\u4e00-\u9fa5]/g, '').toLowerCase();
  };

  // 智能寻找表头行：寻找包含最多“锚点”关键词的行
  const anchorKeywords = ['日期', '版本', '应用名称', '消耗', '渠道', '合作伙伴', 'roi', '留存', '倍率', '说明', '日志', '回收', 'cpi', 'dau', 'arpu', '付费'];
  let bestHeaderIdx = -1;
  let maxScore = 0;

  // 预先标准化所有行，方便匹配
  const normalizedRows = existingValues.map(row => (row || []).map(normalize));

  // 检查前 50 行
  for (let i = 0; i < Math.min(normalizedRows.length, 50); i++) {
    const normRow = normalizedRows[i];
    if (!normRow || normRow.length === 0) continue;
    
    let anchorCount = 0;
    for (const keyword of anchorKeywords) {
      if (normRow.some(cell => cell.includes(keyword))) {
        anchorCount++;
      }
    }
    
    const currentHeaderNorms = header.map(normalize);
    let matchCount = 0;
    for (const hNorm of currentHeaderNorms) {
      if (hNorm && normRow.includes(hNorm)) {
        matchCount++;
      }
    }
    
    const score = anchorCount * 2 + matchCount * 5; // 权重：直接匹配 header 的词权重更高
    if (score > maxScore) {
      maxScore = score;
      bestHeaderIdx = i;
    }
  }

  // 如果没找到明显的表头行，回退到第一个非空行
  if (bestHeaderIdx === -1 || maxScore < 5) {
    bestHeaderIdx = existingValues.findIndex(row => row && row.some(cell => cell !== null && cell !== ''));
  }
  
  if (bestHeaderIdx === -1) {
    // Sheet is empty or only contains empty rows, write everything starting from A1
    console.log(`[Sync] Sheet ${sheetId} is empty, writing headers and ${rows.length} rows.`);
    const values = [header, ...rows];
    let url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`;
    if (useProxy) url = `/api/feishu/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueRanges: [{ range: `${sheetId}!A1:${getColStr(header.length - 1)}${values.length}`, values }] })
    });
    const result = await res.json();
    if (result.code !== 0) throw new Error(result.msg);
    return { success: true, updated: 0, appended: rows.length };
  }

  const existingHeader = existingValues[bestHeaderIdx] || [];
  console.log(`[Sync] Detected header row at index ${bestHeaderIdx}: ${JSON.stringify(existingHeader)}`);
  
  // Map our header to existing header
  const headerMap = new Map<number, number>(); // newIdx -> existingIdx
  const normalizedExistingHeader = existingHeader.map(normalize);

  for (let i = 0; i < header.length; i++) {
    const colName = header[i];
    if (!colName || colName === '空白') continue;

    const normColName = normalize(colName);
    
    // 1. 尝试精确匹配
    let existingIdx = normalizedExistingHeader.findIndex(h => h === normColName);
    
    // 2. 针对基础字段的容错匹配
    if (existingIdx === -1) {
      if (normColName === '版本' || normColName === '应用名称') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === '版本' || h === '应用名称' || h === 'app' || h === '应用' || h === '名称');
      } else if (normColName === '日期' || normColName === '日期周期') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === '日期' || h === '日期周期' || h === '时间' || h === 'day' || h === 'date');
      } else if (normColName === '渠道' || normColName === '合作伙伴') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === '渠道' || h === '合作伙伴' || h === 'network' || h === '媒体' || h === '来源');
      } else if (normColName === '消耗') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === '消耗' || h === 'cost' || h === '支出' || h === '花费');
      } else if (normColName === '说明' || normColName === '投放策略版本变化日志') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === '说明' || h === '投放策略版本变化日志' || h === '备注' || h === '日志' || h === '策略');
      } else if (normColName === '新增用户' || normColName === '安装') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === '新增用户' || h === '安装' || h === 'installs' || h === '新增');
      } else if (normColName === 'cpi') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === 'cpi' || h === '单价' || h === '成本');
      } else if (normColName === 'dau') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === 'dau' || h === '日活');
      } else if (normColName === '首日roi') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === '首日roi' || h === 'd0roi' || h === 'roi' || h === '首日回收');
      } else if (normColName === '新增arpu') {
        existingIdx = normalizedExistingHeader.findIndex(h => h === '新增arpu' || h === 'arpu');
      } else if (normColName === '新增首日用户付费数') {
        existingIdx = normalizedExistingHeader.findIndex(h => h.includes('付费数') || h.includes('付费用户') || h.includes('付费人数'));
      } else if (normColName.includes('月回收')) {
        const month = normColName.match(/\d+/)?.[0];
        if (month) {
          existingIdx = normalizedExistingHeader.findIndex(h => h.includes(`${month}月回收`) || h.includes(`m${month}`) || h.includes(`month${month}`));
        }
      } else if (normColName.includes('倍率')) {
        const days = normColName.match(/\d+/)?.[0];
        if (days) {
          existingIdx = normalizedExistingHeader.findIndex(h => h.includes(`${days}日倍率`) || h.includes(`${days}d倍率`));
        }
      } else if (normColName.includes('/') && /\d+\/\d+/.test(normColName)) {
        // 处理比例，如 21/14
        const [n1, n2] = normColName.split('/');
        existingIdx = normalizedExistingHeader.findIndex(h => h === `${n1}${n2}` || h === `${n2}${n1}` || h.includes(`${n1}/${n2}`) || h.includes(`${n2}/${n1}`));
      }
    }

    // 3. 最后的模糊匹配（仅当精确匹配和基础容错都失败时）
    if (existingIdx === -1 && normColName.length > 1) {
       existingIdx = normalizedExistingHeader.findIndex(h => h && (h.includes(normColName) || normColName.includes(h)));
    }
    
    if (existingIdx !== -1) {
      headerMap.set(i, existingIdx);
      console.log(`DEBUG: Successfully mapped '${colName}' to existing column index ${existingIdx}`);
    } else {
      console.warn(`DEBUG: Failed to map header '${colName}' in sheet ${sheetTitle || sheetId}. Existing headers: ${JSON.stringify(normalizedExistingHeader)}`);
    }
  }

  const dateColIdx = normalizedExistingHeader.findIndex((h: string) => h === '日期' || h === '日期周期' || h === '时间');
  let appColIdx = normalizedExistingHeader.findIndex((h: string) => h === '版本' || h === '应用名称' || h === 'app' || h === '应用');
  const netColIdx = normalizedExistingHeader.findIndex((h: string) => h === '渠道' || h === '合作伙伴' || h === 'network');
  
  // Special case for ROI sheets where the app column header might be empty
  if (appColIdx === -1 && normalizedExistingHeader[0] === '投放策略版本变化日志' && !normalizedExistingHeader[1]) {
    appColIdx = 1;
  }
  
  let isExcelDate = false;
  let firstEmptyRowIdx = -1; // The first row that is completely empty in key columns
  
  const rowMap = new Map<string, number>();
  if (dateColIdx !== -1) {
    // Start from the row after the header
    for (let i = bestHeaderIdx + 1; i < existingValues.length; i++) {
      const row = existingValues[i];
      if (!row) continue;
      const rawDate = row[dateColIdx];
      
      // Detect if the sheet uses Excel date numbers
      if (rawDate && typeof rawDate === 'number' && !isExcelDate) {
        isExcelDate = true;
      }
      
      const date = normalizeDate(rawDate);
      
      // Check for empty row to fill
      const isDateEmpty = !rawDate || rawDate === '';
      const isSummary = row && row.some((cell: any) => typeof cell === 'string' && cell.includes('汇总'));
      if (isDateEmpty && !isSummary && firstEmptyRowIdx === -1) {
        firstEmptyRowIdx = i + 1; // 1-based row number
        console.log(`Found first empty row at index ${firstEmptyRowIdx}`);
      }
      
      if (!date) continue;
      
      let key = `${date}`;
      if (appColIdx !== -1) key += `_${row[appColIdx]}`;
      if (netColIdx !== -1) key += `_${row[netColIdx]}`;
      
      rowMap.set(key, i + 1); // 1-based row number
    }
  }
  
  console.log("Existing keys sample:", Array.from(rowMap.keys()).slice(-5));

  const updates: { range: string, values: any[][] }[] = [];
  const appends: any[][] = [];

  const newDateColIdx = header.findIndex(h => h === '日期' || h === '日期/周期');
  const newAppColIdx = header.findIndex(h => h === '版本' || h === '应用名称' || h === '投放策略/版本变化日志');
  const newNetColIdx = header.findIndex(h => h === '渠道' || h === '合作伙伴');

  let currentEmptyRow = firstEmptyRowIdx !== -1 ? firstEmptyRowIdx : existingValues.length + 1;

  for (const row of cleanedRows) {
    const rawNewDate = row[newDateColIdx];
    const date = normalizeDate(rawNewDate);
    if (!date) continue;
    
    let key = `${date}`;
    if (newAppColIdx !== -1) key += `_${row[newAppColIdx]}`;
    if (newNetColIdx !== -1) key += `_${row[newNetColIdx]}`;
    
    console.log("New key:", key, "Found in map:", rowMap.has(key));
    
    // Format the date to match the sheet's format
    if (isExcelDate) {
      row[newDateColIdx] = jsDateToExcel(date);
    }
    
    if (rowMap.has(key)) {
      const rowNum = rowMap.get(key)!;
      console.log(`[Sync] Updating existing row ${rowNum} for key: ${key}`);
      for (const [newIdx, existingIdx] of headerMap.entries()) {
        const val = row[newIdx];
        if (val !== undefined && val !== null && val !== '') {
           updates.push({
             range: `${sheetId}!${getColStr(existingIdx)}${rowNum}:${getColStr(existingIdx)}${rowNum}`,
             values: [[val]]
           });
        }
      }
    } else {
      // We need to insert/append this row
      console.log(`[Sync] Appending new row at ${currentEmptyRow} for key: ${key}`);
      for (const [newIdx, existingIdx] of headerMap.entries()) {
        const val = row[newIdx];
        if (val !== undefined && val !== null && val !== '') {
           updates.push({
             range: `${sheetId}!${getColStr(existingIdx)}${currentEmptyRow}:${getColStr(existingIdx)}${currentEmptyRow}`,
             values: [[val]]
           });
        }
      }
      currentEmptyRow++;
      appends.push(row); // Just to keep track of count
    }
  }
  
  console.log(`[Sync] Total updates to send: ${updates.length} cells across ${cleanedRows.length} rows`);

  // Execute updates
  if (updates.length > 0) {
    let url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`;
    if (useProxy) url = `/api/feishu/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`;
    
    const CHUNK_SIZE = 100;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      console.log(`[Sync] Sending batch update chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(updates.length/CHUNK_SIZE)}...`);
      
      let retries = 3;
      while (retries > 0) {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ valueRanges: chunk })
        });
        const result = await res.json();
        
        if (result.code === 0) {
          break; // Success
        } else if (result.msg && result.msg.toLowerCase().includes('too many request')) {
          retries--;
          if (retries === 0) throw new Error(result.msg);
          console.log(`Rate limited on batch update. Retrying in 2 seconds... (${retries} left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw new Error(result.msg);
        }
      }
      // Delay between chunks to prevent hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Return the number of rows updated (not the number of cells)
  const updatedRowsCount = new Set(updates.map(u => u.range.split('!')[1].match(/\d+/)?.[0])).size;
  return { success: true, updated: updatedRowsCount - appends.length, appended: appends.length };
}
