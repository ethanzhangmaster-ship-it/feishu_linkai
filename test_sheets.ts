import { getAppConfig } from './server/config.js';
import { getSpreadsheetSheets } from './services/feishuService.js';

async function run() {
  const config = getAppConfig();
  const token = "LkWhsJT7Thq2p8t8VXOcK1bynHc";
  try {
    const sheets = await getSpreadsheetSheets(config, token);
    console.log("Sheets:", sheets.map(s => s.title));
  } catch (e) {
    console.error(e);
  }
}
run();
