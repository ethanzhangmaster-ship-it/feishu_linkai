import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = process.env.TEST_SPREADSHEET_TOKEN || config?.feishu_config?.spreadsheet_token;
    const sheetId = 'qp7sOz';
    
    const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A1:Z500`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const readData = await readRes.json();
    const values = readData.data.valueRange.values;
    
    for (let i = 0; i < values.length; i++) {
      if (values[i].includes('2026-04-01') || values[i].includes(46113) || values[i].includes('2026-04-02') || values[i].includes(46114)) {
        console.log(`Found at row ${i + 1}:`, values[i]);
      }
    }
    
  } catch (e) {
    console.error(e);
  }
}
run();
