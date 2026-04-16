import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = process.env.TEST_SPREADSHEET_TOKEN || config?.feishu_config?.spreadsheet_token;
    
    const sheetIds = ['KrjaRy', '5PnClN', 'qp7sOz', '2mmDaV'];
    
    for (const sheetId of sheetIds) {
      const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A:Z`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const readData = await readRes.json();
      const values = readData.data?.valueRange?.values || [];
      console.log(`\nSheet: ${sheetId}, Rows: ${values.length}`);
      if (values.length > 0) {
        console.log("Header:", values[0]);
      }
    }
  } catch (e) {
    console.error(e);
  }
}
run();
