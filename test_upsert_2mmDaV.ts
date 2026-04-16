import fs from 'fs';
import { fetchAndProcessData } from './services/adjustService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const block = config.data_blocks.find((b: any) => b.id === 'block_gp_fb_basic');
    if (!block) throw new Error("Block not found");
    
    console.log("Fetching block:", block.name);
    const data = await fetchAndProcessData(config, block, '2026-04-01', '2026-04-02', [], undefined, true);
    console.log("Data length:", data.length);
    
    if (data.length > 0) {
      console.log("Sample data:", data.map(d => `${d.dateStr} - ${d.appName}`));
    }
  } catch (e) {
    console.error(e);
  }
}
run();
