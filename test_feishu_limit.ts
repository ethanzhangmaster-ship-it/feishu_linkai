import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
    const testSheetId = 'm6GfPj'; // Just any sheet, we won't actually write, we'll just see if it rejects the request size
    
    const valueRanges = [];
    for (let r = 2; r <= 500; r++) {
      valueRanges.push({ range: `${testSheetId}!A${r}:A${r}`, values: [[`U_A${r}`]] });
    }
    
    const updateRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueRanges })
    });
    console.log("Update 500 ranges:", await updateRes.json());
    
  } catch (e) {
    console.error(e);
  }
}
run();
