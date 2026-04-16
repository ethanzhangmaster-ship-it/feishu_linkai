import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
    const sheetId = 'KrjaRy';
    
    const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A1:Z350`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const readData = await readRes.json();
    const values = readData.data.valueRange.values;
    
    for (let i = 0; i < values.length; i++) {
      if (values[i][2] === 46122 || values[i][2] === '2026-04-10' || values[i][0] === 'Test Note 3') {
        console.log(`Found at row ${i + 1}:`, values[i]);
      }
    }
    
  } catch (e) {
    console.error(e);
  }
}
run();
