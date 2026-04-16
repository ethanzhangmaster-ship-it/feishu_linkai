import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = process.env.TEST_SPREADSHEET_TOKEN || config?.feishu_config?.spreadsheet_token;
    const sheetId = 'KrjaRy';
    
    const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_append`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueRange: {
          range: `${sheetId}!A:A`,
          values: [['Append Test 2']]
        }
      })
    });
    console.log("Append result:", await res.json());
    
  } catch (e) {
    console.error(e);
  }
}
run();
