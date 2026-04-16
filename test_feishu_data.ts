import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
    
    const sheetsRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const sheetsData = await sheetsRes.json();
    console.log("Sheets:", sheetsData.data.sheets.map((s: any) => ({ title: s.title, sheet_id: s.sheet_id })));
    
    for (const sheet of sheetsData.data.sheets) {
      const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheet.sheet_id}!A:Z`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const readData = await readRes.json();
      const values = readData.data?.valueRange?.values || [];
      console.log(`\nSheet: ${sheet.title} (${sheet.sheet_id}), Rows: ${values.length}`);
      if (values.length > 0) {
        console.log("Header:", values[0].slice(0, 5), "...");
        if (values.length > 1) {
          console.log("Row 1:", values[1].slice(0, 5), "...");
          console.log("Row 2:", values[2] ? values[2].slice(0, 5) : "None");
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}
run();
