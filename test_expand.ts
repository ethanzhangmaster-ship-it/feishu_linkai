import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
    const sheetId = 'KrjaRy';
    
    // Let's try to update row 1000 (which probably doesn't exist, current rows ~344)
    const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueRanges: [
          {
            range: `${sheetId}!A1000:A1000`,
            values: [['Expand Test']]
          }
        ]
      })
    });
    console.log("Expand result:", await res.json());
    
  } catch (e) {
    console.error(e);
  }
}
run();
