import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = process.env.TEST_SPREADSHEET_TOKEN || config?.feishu_config?.spreadsheet_token;
    const sheetId = 'KrjaRy'; // We will just read for now
    
    // Let's create a test sheet to test updating with nulls
    const addSheetRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/sheets_batch_update`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: 'TestAPI'
              }
            }
          }
        ]
      })
    });
    const addSheetData = await addSheetRes.json();
    console.log("Add sheet:", addSheetData);
    
    const testSheetId = addSheetData.data.replies[0].addSheet.properties.sheetId;
    
    // Write initial data
    await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueRanges: [
          {
            range: `${testSheetId}!A1:C2`,
            values: [
              ['Col1', 'Col2', 'Col3'],
              ['Val1', 'Val2', 'Val3']
            ]
          }
        ]
      })
    });
    
    // Update with null
    await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values_batch_update`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueRanges: [
          {
            range: `${testSheetId}!A2:C2`,
            values: [
              ['NewVal1', null, 'NewVal3']
            ]
          }
        ]
      })
    });
    
    // Read back
    const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${testSheetId}!A:Z`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const readData = await readRes.json();
    console.log("Read back:", readData.data.valueRange.values);
    
  } catch (e) {
    console.error(e);
  }
}
run();
