import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = process.env.TEST_SPREADSHEET_TOKEN || config?.feishu_config?.spreadsheet_token;
    
    const sheetIds = ['KrjaRy', '5PnClN', 'qp7sOz', '2mmDaV'];
    
    for (const sheetId of sheetIds) {
      const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A1:Z300`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const readData = await readRes.json();
      const values = readData.data?.valueRange?.values || [];
      
      let lastRowWithDate = -1;
      let firstEmptyRow = -1;
      let hasSummaryRow = false;
      
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[2] && typeof row[2] === 'number') { // Date is usually a number
          lastRowWithDate = i + 1;
        } else if (row[2] && typeof row[2] === 'string' && row[2].includes('汇总')) {
          hasSummaryRow = true;
        } else if (!row[2] && firstEmptyRow === -1) {
          firstEmptyRow = i + 1;
        }
      }
      
      console.log(`Sheet: ${sheetId}`);
      console.log(`  Last row with date: ${lastRowWithDate}`);
      console.log(`  First empty row: ${firstEmptyRow}`);
      console.log(`  Has summary row: ${hasSummaryRow}`);
      console.log(`  Total rows returned: ${values.length}`);
    }
    
  } catch (e) {
    console.error(e);
  }
}
run();
