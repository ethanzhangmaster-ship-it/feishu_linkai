import fs from 'fs';
import { upsertToFeishuSheet } from './services/feishuUpsert.js';

const config = JSON.parse(fs.readFileSync('./app-config.json', 'utf8'));

async function run() {
  try {
    const spreadsheetToken = 'LkWhsJT7Thq2p8t8VXOcK1bynHc';
    const sheetId = 'KrjaRy';
    
    const header = ['投放策略/版本变化日志', '版本', '日期', '消耗($)', '7日回收金额', '14日回收金额', '21日回收金额', '首日ROI', '2日ROI', '3日ROI', '4日ROI', '5日ROI', '6日ROI', '7日ROI', '14日ROI', '21日ROI', '30日ROI', '45日ROI', '60日ROI', '90日ROI', '100日ROI', '首日倍率', '2日倍率', '3日倍率', '4日倍率', '5日倍率', '6日倍率', '7日倍率', '14日倍率', '21日倍率', '30日倍率', '45日倍率', '60日倍率', '90日倍率', '100日倍率', '首日回收', '2日回收', '3日回收', '4日回收', '5日回收', '6日回收'];
    
    const rows = [
      ['Test Note 2', 'P04 Witch', '2025-11-18', 100, 0, 0, 0, 0.5, 0.6, 0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 60, 70, 0, 0, 0],
      ['Test Note 3', 'P04 Witch', '2026-04-10', 300, 0, 0, 0, 0.5, 0.6, 0.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 60, 70, 0, 0, 0]
    ];
    
    console.log("Running upsert...");
    const res = await upsertToFeishuSheet(config, spreadsheetToken, sheetId, header, rows);
    console.log("Result:", res);
    
  } catch (e) {
    console.error(e);
  }
}
run();
