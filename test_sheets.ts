import { getAppConfig } from './server/config.js';
import { getSpreadsheetSheets } from './services/feishuService.js';

async function run() {
  const config = getAppConfig();
  const token = process.env.TEST_SPREADSHEET_TOKEN || config?.feishu_config?.spreadsheet_token;
  try {
    const sheets = await getSpreadsheetSheets(config, token);
    console.log("Sheets:", sheets.map(s => s.title));
  } catch (e) {
    console.error(e);
  }
}
run();
