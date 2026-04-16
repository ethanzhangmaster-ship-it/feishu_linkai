import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = process.env.TEST_SPREADSHEET_TOKEN || config?.feishu_config?.spreadsheet_token;
    
    const addSheetRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/sheets_batch_update`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: 'TestAPI2' } } }]
      })
    });
    const addSheetData = await addSheetRes.json();
    const testSheetId = addSheetData.data.replies[0].addSheet.properties.sheetId;
    
    // Write initial data
    await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueRanges: [
          {
            range: `${testSheetId}!A1:E5`,
            values: [
              ['C1', 'C2', 'C3', 'C4', 'C5'],
              ['1', '2', '3', '4', '5'],
              ['1', '2', '3', '4', '5'],
              ['1', '2', '3', '4', '5'],
              ['1', '2', '3', '4', '5']
            ]
          }
        ]
      })
    });
    
    // Update disjoint cells
    const valueRanges = [];
    for (let r = 2; r <= 5; r++) {
      valueRanges.push({ range: `${testSheetId}!A${r}:A${r}`, values: [[`U_A${r}`]] });
      valueRanges.push({ range: `${testSheetId}!C${r}:C${r}`, values: [[`U_C${r}`]] });
      valueRanges.push({ range: `${testSheetId}!E${r}:E${r}`, values: [[`U_E${r}`]] });
    }
    
    const updateRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueRanges })
    });
    console.log("Update disjoint:", await updateRes.json());
    
  } catch (e) {
    console.error(e);
  }
}
run();
