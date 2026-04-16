import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = process.env.TEST_SPREADSHEET_TOKEN || config?.feishu_config?.spreadsheet_token;
    const sheetId = 'KrjaRy';
    
    const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A150:Z150?valueRenderOption=Formula`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const readData = await readRes.json();
    console.log("Read back Formula:", JSON.stringify(readData.data.valueRange.values, null, 2));
    
  } catch (e) {
    console.error(e);
  }
}
run();
