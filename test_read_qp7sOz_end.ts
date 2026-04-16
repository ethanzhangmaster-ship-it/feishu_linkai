import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
    const sheetId = 'qp7sOz';
    
    const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A1:Z500`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const readData = await readRes.json();
    const values = readData.data.valueRange.values;
    
    let lastRow = -1;
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i].some((c: any) => c !== null && c !== '')) {
        lastRow = i;
        break;
      }
    }
    
    console.log("Last non-empty row index:", lastRow);
    if (lastRow >= 0) {
      console.log("Last 5 non-empty rows:", JSON.stringify(values.slice(Math.max(0, lastRow - 4), lastRow + 1), null, 2));
    }
    
  } catch (e) {
    console.error(e);
  }
}
run();
