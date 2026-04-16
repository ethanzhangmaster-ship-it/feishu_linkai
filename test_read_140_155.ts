import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = process.env.TEST_SPREADSHEET_TOKEN || config?.feishu_config?.spreadsheet_token;
    const sheetId = 'KrjaRy';
    
    const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A140:Z155?valueRenderOption=ToString`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const readData = await readRes.json();
    console.log("Read back:", JSON.stringify(readData.data.valueRange.values.map(r => r.slice(0, 4)), null, 2));
    
  } catch (e) {
    console.error(e);
  }
}
run();
