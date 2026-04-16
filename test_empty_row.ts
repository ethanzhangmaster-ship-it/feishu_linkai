import fs from 'fs';
import { getTenantAccessToken } from './services/feishuService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const token = await getTenantAccessToken(config);
    const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
    const sheetId = 'KrjaRy';
    
    const readRes = await fetch(`https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A1:Z344`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const readData = await readRes.json();
    const values = readData.data.valueRange.values;
    
    let firstEmpty = -1;
    for (let i = 1; i < values.length; i++) {
      if (!values[i][2]) { // Date column is C (index 2)
        firstEmpty = i + 1;
        break;
      }
    }
    console.log("First row without date:", firstEmpty);
    
    if (firstEmpty !== -1) {
      console.log("Row before empty:", values[firstEmpty - 2]);
      console.log("Empty row:", values[firstEmpty - 1]);
    }
    
  } catch (e) {
    console.error(e);
  }
}
run();
