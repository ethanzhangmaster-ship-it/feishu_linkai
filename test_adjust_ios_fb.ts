import fs from 'fs';
import { fetchAndProcessData } from './services/adjustService.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const block = config.data_blocks.find((b: any) => b.id === 'block_ios_fb_basic');
    if (!block) throw new Error("Block not found");
    
    console.log("Fetching block:", block.name);
    
    // We need to modify adjustService.ts to log the raw row, or we can just fetch it directly here
    const userToken = config.adjust_api.user_token;
    const params = new URLSearchParams({ 
      date_period: `2026-04-01:2026-04-01`, 
      dimensions: 'app,app_token,store_type,day,network', 
      metrics: 'cost,installs,all_revenue,ad_revenue,revenue,ecpi_all,roas_d0,all_revenue_total_d0,revenue_total_d0,ad_revenue_total_d0,first_paying_users_d0,retention_rate_d1,daus,sessions,all_revenue_total_m0,all_revenue_total_m1,all_revenue_total_m2,all_revenue_total_m3,all_revenue_total_m4,all_revenue_total_m5', 
      ad_spend_mode: 'network' 
    });
    
    const targetUrl = `https://automate.adjust.com/reports-service/report?${params.toString()}`;
    const response = await fetch(targetUrl, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'Accept': 'application/json' }
    });
    const data = await response.json();
    console.log("Raw API response:", data.rows[0]);
    
  } catch (e) {
    console.error(e);
  }
}
run();
