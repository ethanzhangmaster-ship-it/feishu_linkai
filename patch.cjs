const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'services', 'feishuService.ts');
let content = fs.readFileSync(filePath, 'utf8');

const startIndex = content.indexOf('export async function syncToFeishu');
if (startIndex !== -1) {
  content = content.substring(0, startIndex);
}

const newContent = `import { upsertToFeishuSheet } from './feishuUpsert';

function formatDataForFeishu(data: ProcessedRow[]) {
  if (!data || data.length === 0) return { header: [], rows: [] };
  const blockId = data[0].blockId || '';
  let header: string[] = [];
  let rows: any[][] = [];

  if (blockId === 'block_roi') {
    header = [
      '投放策略/版本变化日志', '版本', '日期', '消耗($)', '7日回收金额', '14回收金额', '21日回收金额',
      '首日ROI', '2日ROI', '3日ROI', '4日ROI', '5日ROI', '6日ROI', '7日ROI', '14日ROI', '21日ROI', '30日ROI',
      '40日ROI', '50日ROI', '60日ROI', '70日ROI', '80日ROI', '90日ROI', '100日ROI', '空白',
      '2日倍率', '3日倍率', '4日倍率', '5日倍率', '6日倍率', '7日倍率', '14日倍率', '21日倍率', '30日倍率',
      '3/2', '7/2', '14/7', '14/21', '7/30', '14/30', '21/30'
    ];
    rows = data.map(r => {
      const roas0 = r.roiD0 || 0;
      const roas1 = r.roiD1 || 0;
      const roas2 = r.roiD2 || 0;
      const roas3 = r.roiD3 || 0;
      const roas4 = r.roiD4 || 0;
      const roas5 = r.roiD5 || 0;
      const roas6 = r.roiD6 || 0;
      const roas14 = r.roiD14 || 0;
      const roas21 = r.roiD21 || 0;
      const roas30 = r.roiD30 || 0;

      return [
        '', r.appName || '', r.dateStr, formatCurrency(r.cost), formatCurrency(r.revD7), formatCurrency(r.revD14), formatCurrency(r.revD21),
        formatPercent(roas0), formatPercent(roas1), formatPercent(roas2), formatPercent(roas3), formatPercent(roas4), formatPercent(roas5), formatPercent(roas6), formatPercent(roas14), formatPercent(roas21), formatPercent(roas30),
        '', '', '', '', '', '', '', '',
        calcRatio(roas1, roas0), calcRatio(roas2, roas0), calcRatio(roas3, roas0), calcRatio(roas4, roas0), calcRatio(roas5, roas0), calcRatio(roas6, roas0), calcRatio(roas14, roas0), calcRatio(roas21, roas0), calcRatio(roas30, roas0),
        calcRatio(roas2, roas1), calcRatio(roas6, roas1), calcRatio(roas14, roas6), calcRatio(roas14, roas21), calcRatio(roas6, roas30), calcRatio(roas14, roas30), calcRatio(roas21, roas30)
      ];
    });
  } else if (blockId === 'block_roi_network') {
    header = [
      '投放策略/版本变化日志', '渠道', '日期', '消耗($)', 
      '首日ROI', '2日ROI', '3日ROI', '4日ROI', '5日ROI', '6日ROI', '7日ROI', '14日ROI', '21日ROI', '30日ROI', 
      '2日倍率', '3日倍率', '4日倍率', '5日倍率', '6日倍率', '7日倍率', '14日倍率', '21日倍率', '30日倍率', 
      '3/2', '7/2', '14/7', 
      '7日回收金额', '14回收金额', '21日回收金额', '30日回收金额'
    ];
    rows = data.map(r => {
      const roas0 = r.roiD0 || 0;
      const roas1 = r.roiD1 || 0;
      const roas2 = r.roiD2 || 0;
      const roas3 = r.roiD3 || 0;
      const roas4 = r.roiD4 || 0;
      const roas5 = r.roiD5 || 0;
      const roas6 = r.roiD6 || 0;
      const roas14 = r.roiD14 || 0;
      const roas21 = r.roiD21 || 0;
      const roas30 = r.roiD30 || 0;

      return [
        r.appName || '', r.network || '', r.dateStr, formatCurrency(r.cost), 
        formatPercent(roas0), formatPercent(roas1), formatPercent(roas2), formatPercent(roas3), formatPercent(roas4), formatPercent(roas5), formatPercent(roas6), formatPercent(roas14), formatPercent(roas21), formatPercent(roas30),
        calcRatio(roas1, roas0), calcRatio(roas2, roas0), calcRatio(roas3, roas0), calcRatio(roas4, roas0), calcRatio(roas5, roas0), calcRatio(roas6, roas0), calcRatio(roas14, roas0), calcRatio(roas21, roas0), calcRatio(roas30, roas0),
        calcRatio(roas2, roas1), calcRatio(roas6, roas1), calcRatio(roas14, roas6),
        formatCurrency(r.revD7), formatCurrency(r.revD14), formatCurrency(r.revD21), formatCurrency(r.revD30)
      ];
    });
  } else if (blockId === 'block_retention') {
    header = [
      '投放策略/版本变化日志', '版本', '日期', '消耗($)', 
      '首日ROI', '2日ROI', '3日ROI', '4日ROI', '5日ROI', '6日ROI', '7日ROI', '14日ROI', '21日ROI', '30日ROI', 
      '2日倍率', '3日倍率', '4日倍率', '5日倍率', '6日倍率', '7日倍率', '14日倍率', '21日倍率', '30日倍率', 
      '3/2', '7/2', '14/7', 
      '7日回收金额', '14回收金额', '21日回收金额'
    ];
    rows = data.map(r => {
      const roas0 = r.roiD0 || 0;
      const roas1 = r.roiD1 || 0;
      const roas2 = r.roiD2 || 0;
      const roas3 = r.roiD3 || 0;
      const roas4 = r.roiD4 || 0;
      const roas5 = r.roiD5 || 0;
      const roas6 = r.roiD6 || 0;
      const roas14 = r.roiD14 || 0;
      const roas21 = r.roiD21 || 0;
      const roas30 = r.roiD30 || 0;

      return [
        '', r.appName || '', r.dateStr, formatCurrency(r.cost), 
        formatPercent(roas0), formatPercent(roas1), formatPercent(roas2), formatPercent(roas3), formatPercent(roas4), formatPercent(roas5), formatPercent(roas6), formatPercent(roas14), formatPercent(roas21), formatPercent(roas30),
        calcRatio(roas1, roas0), calcRatio(roas2, roas0), calcRatio(roas3, roas0), calcRatio(roas4, roas0), calcRatio(roas5, roas0), calcRatio(roas6, roas0), calcRatio(roas14, roas0), calcRatio(roas21, roas0), calcRatio(roas30, roas0),
        calcRatio(roas2, roas1), calcRatio(roas6, roas1), calcRatio(roas14, roas6),
        formatCurrency(r.revD7), formatCurrency(r.revD14), formatCurrency(r.revD21)
      ];
    });
  } else if (blockId === 'block_retention_network' || blockId === 'block_spend_details') {
    header = [
      '版本', '日期', '消耗($)', '新增用户', 'CPI', 'DAU', '首日ROI', '新增 arpu', 
      '新增首日用户付费数', '新增首日付费用户成本', '新增付费率', '新增付费arppu', 
      '新增首日付费金额', '新增广告收入', '新增首日收入', '总收入', '1日留存'
    ];
    rows = data.map(r => [
      \`\${r.appName || ''} - \${blockId === 'block_spend_details' ? r.campaignName : r.network}\`,
      r.dateStr, formatCurrency(r.cost), r.installs, formatCurrency(r.cpa), r.daus || 0, formatPercent(r.roiD0), formatCurrency(r.arpu), 
      r.paidInstalls, formatCurrency(r.userPayCost), formatPercent(r.payRate), formatCurrency(r.paidArppu), 
      formatCurrency(r.iapRevenue), formatCurrency(r.adRevenue), formatCurrency(r.cohortRevenue), formatCurrency(r.totalRevenue), formatPercent(r.retention1)
    ]);
  } else if (blockId === 'block_basic') {
    header = [
      '说明', '版本', '日期', '消耗($)', '新增用户', 'CPI', 'DAU', '首日ROI', '新增 arpu',
      '新增首日用户付费数', '新增首日付费用户成本', '新增付费率', '新增付费arppu', '新增首日付费金额',
      '新增广告收入', '新增首日收入', '总收入', '1日留存', '活跃回收', '0月回收', '1月回收', '2月回收',
      '3月回收', '4月回收', '5月回收'
    ];
    rows = data.map(r => [
      '', r.appName || '', r.dateStr, formatCurrency(r.cost), r.installs, formatCurrency(r.cpa), r.daus || 0, formatPercent(r.roiD0 || 0), formatCurrency(r.arpu),
      r.paidInstalls, formatCurrency(r.userPayCost), formatPercent(r.payRate), formatCurrency(r.paidArppu), formatCurrency(r.iapRevenue),
      formatCurrency(r.adRevenue), formatCurrency(r.cohortRevenue), formatCurrency(r.totalRevenue), formatPercent(r.retention1),
      '', formatPercent(r.cost > 0 ? r.revM0 / r.cost : 0), formatPercent(r.cost > 0 ? r.revM1 / r.cost : 0), formatPercent(r.cost > 0 ? r.revM2 / r.cost : 0),
      formatPercent(r.cost > 0 ? r.revM3 / r.cost : 0), formatPercent(r.cost > 0 ? r.revM4 / r.cost : 0), formatPercent(r.cost > 0 ? r.revM5 / r.cost : 0)
    ]);
  } else {
    header = ["日期/周期", "应用名称", "合作伙伴", "国家", "商店", "消耗($)", "安装", "CPI", "总收入($)", "ROI", "1日留存"];
    rows = data.map(r => [
      String(r.dateStr), String(r.appName || '-'), String(r.network || '-'), String(r.country || 'Global'), String(r.storeType || 'all'),
      Number(r.cost.toFixed(2)), Number(r.installs), Number(r.cpa.toFixed(2)), Number(r.totalRevenue.toFixed(2)), Number((r.roi * 100).toFixed(2)), Number((r.retention1 * 100).toFixed(2))
    ]);
  }
  return { header, rows };
}

export async function syncToFeishu(config: AppConfig, data: ProcessedRow[], overrideToken?: string, overrideSheetId?: string) {
  if (!config.feishu_config || !config.feishu_config.app_id) {
    throw new Error("请先在设置中完整配置飞书参数");
  }

  const spreadsheet_token = overrideToken || config.feishu_config.spreadsheet_token;
  const sheet_id = overrideSheetId || config.feishu_config.sheet_id;

  if (!spreadsheet_token || !sheet_id) throw new Error("请选择同步目的地表格及子表");
  if (!data || data.length === 0) throw new Error("没有可同步的数据");

  if (sheet_id === 'auto') {
    const sheets = await getSpreadsheetSheets(config, spreadsheet_token);
    const sheetDataMap = new Map<string, ProcessedRow[]>();
    const baseSheet = sheets.find(s => s.title.includes('基础数据')) || sheets[0];

    for (const row of data) {
      const os = (row.storeType || '').toLowerCase();
      const net = (row.network || '').toLowerCase();
      
      let osKey = '';
      if (os.includes('android') || os.includes('google')) osKey = 'AND';
      else if (os.includes('ios') || os.includes('apple')) osKey = 'IOS';
      
      let netKey = '';
      if (net.includes('facebook') || net.includes('fb') || net.includes('instagram')) netKey = 'FB';
      else if (net.includes('google') || net.includes('adwords')) netKey = 'GG';
      else if (net.includes('applovin')) netKey = 'AL';
      else if (net.includes('tiktok')) netKey = 'TT';
      else if (net.includes('mintegral')) netKey = 'MTG';
      else if (net.includes('unity')) netKey = 'UADS';
      else if (net.includes('ironsource')) netKey = 'IS';

      let matchedSheetId = null;
      if (osKey && netKey) {
        for (const s of sheets) {
          const title = s.title.toUpperCase();
          if (title.includes(osKey) && title.includes(netKey)) {
            matchedSheetId = s.sheet_id;
            break;
          }
        }
      }

      // Always add to base sheet
      if (!sheetDataMap.has(baseSheet.sheet_id)) sheetDataMap.set(baseSheet.sheet_id, []);
      sheetDataMap.get(baseSheet.sheet_id)!.push(row);

      // Also add to specific sheet if matched
      if (matchedSheetId && matchedSheetId !== baseSheet.sheet_id) {
        if (!sheetDataMap.has(matchedSheetId)) sheetDataMap.set(matchedSheetId, []);
        sheetDataMap.get(matchedSheetId)!.push(row);
      }
    }

    let totalUpdated = 0;
    let totalAppended = 0;
    for (const [sId, rowsData] of sheetDataMap.entries()) {
      const { header, rows } = formatDataForFeishu(rowsData);
      const res = await upsertToFeishuSheet(config, spreadsheet_token, sId, header, rows);
      totalUpdated += res.updated;
      totalAppended += res.appended;
    }
    return { code: 0, msg: 'success', data: { updated: totalUpdated, appended: totalAppended } };
  } else {
    const { header, rows } = formatDataForFeishu(data);
    return await upsertToFeishuSheet(config, spreadsheet_token, sheet_id, header, rows);
  }
}
`;

fs.writeFileSync(filePath, content + newContent);
