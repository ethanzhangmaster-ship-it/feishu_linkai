import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
    const sheetId = 'KrjaRy';
    
    // Append a row with nulls
    const appendRow = new Array(26).fill(null);
    appendRow[0] = 'Append Test';
    appendRow[2] = '2026-01-01';
    appendRow[3] = 200;
    
    const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_append`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueRange: {
          range: `${sheetId}!A:Z`,
          values: [appendRow]
        }
      })
    });
    console.log("Append result:", await res.json());
    
  } catch (e) {
    console.error(e);
  }
}
run();
