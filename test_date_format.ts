import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
    const sheetId = 'KrjaRy';
    
    const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!C2:C5?valueRenderOption=ToString`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const readData = await readRes.json();
    console.log("Read back ToString:", JSON.stringify(readData.data.valueRange.values, null, 2));
    
    const readRes2 = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!C2:C5?valueRenderOption=DateTimeRenderOption`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const readData2 = await readRes2.json();
    console.log("Read back DateTime:", JSON.stringify(readData2.data.valueRange.values, null, 2));
    
  } catch (e) {
    console.error(e);
  }
}
run();
