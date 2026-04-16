
import { ProcessedRow, AppConfig } from '../types';

/**
 * 获取飞书 Tenant Access Token
 */
export async function getTenantAccessToken(config: AppConfig) {
  const { app_id, app_secret } = config.feishu_config;
  const useProxy = typeof window !== 'undefined' && config.adjust_api.use_proxy;
  
  if (!app_id || !app_secret) throw new Error("缺失 App ID 或 App Secret");

  let url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
  if (useProxy) {
    url = `/api/feishu/open-apis/auth/v3/tenant_access_token/internal`;
  }

  let retries = 3;
  while (retries > 0) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id, app_secret })
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`鉴权失败: 飞书 API 返回了非 JSON 格式的数据。这可能是由于网络代理错误或 API 暂时不可用导致。`);
    }
    
    if (response.ok && data.code === 0) {
      return data.tenant_access_token;
    } else if (data.msg && data.msg.toLowerCase().includes('too many request')) {
      retries--;
      if (retries === 0) throw new Error(`鉴权失败 (${data.code}): ${data.msg}`);
      console.log(`Rate limited on getTenantAccessToken. Retrying in 2 seconds... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      throw new Error(`鉴权失败 (${data.code}): ${data.msg || "请检查 App ID 和 Secret"}`);
    }
  }
}

/**
 * 获取表格下的所有子表 (Sheets)
 */
export async function getSpreadsheetSheets(config: AppConfig, spreadsheetToken: string) {
  const token = await getTenantAccessToken(config);
  const useProxy = typeof window !== 'undefined' && config.adjust_api.use_proxy;

  let url = `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`;
  if (useProxy) {
    url = `/api/feishu/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`;
  }

  let retries = 3;
  while (retries > 0) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(`获取子表列表失败: 飞书 API 返回了非 JSON 格式的数据。这可能是由于网络代理错误或 API 暂时不可用导致。`);
    }
    
    if (result.code === 0) {
      return result.data.sheets.map((s: any) => ({
        title: s.title,
        sheet_id: s.sheet_id
      }));
    } else if (result.msg && result.msg.toLowerCase().includes('too many request')) {
      retries--;
      if (retries === 0) throw new Error(result.msg);
      console.log(`Rate limited on getSpreadsheetSheets. Retrying in 2 seconds... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      throw new Error(result.msg || "获取子表列表失败");
    }
  }
}

/**
 * 测试飞书连接及表格权限
 */
export async function testFeishuConnection(config: AppConfig) {
  try {
    const token = await getTenantAccessToken(config);
    const { spreadsheet_token } = config.feishu_config;
    const useProxy = typeof window !== 'undefined' && config.adjust_api.use_proxy;

    let url = `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheet_token}`;
    if (useProxy) {
      url = `/api/feishu/open-apis/sheets/v3/spreadsheets/${spreadsheet_token}`;
    }

    let retries = 3;
    while (retries > 0) {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error(`无法访问表格: 飞书 API 返回了非 JSON 格式的数据。这可能是由于网络代理错误或 API 暂时不可用导致。`);
      }
      
      if (result.code === 0) {
        return true;
      } else if (result.msg && result.msg.toLowerCase().includes('too many request')) {
        retries--;
        if (retries === 0) throw new Error(result.msg);
        console.log(`Rate limited on testFeishuConnection. Retrying in 2 seconds... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
         if (result.code === 1310243) throw new Error("无权限。请在飞书文档右上角点击‘分享’，搜寻并添加该自建应用为成员。");
         throw new Error(result.msg || "无法访问表格");
      }
    }
  } catch (e: any) {
    throw e;
  }
}

function formatPercent(val: any) {
  if (val === null || val === undefined || val === '') return '0.00%';
  const num = parseFloat(val);
  if (isNaN(num)) return '0.00%';
  return `${(num * 100).toFixed(2)}%`;
}

function formatCurrency(val: any) {
  if (val === null || val === undefined || val === '') return '$0.00';
  const num = parseFloat(val);
  if (isNaN(num)) return '$0.00';
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function calcRatio(num: any, den: any) {
  const n = parseFloat(num);
  const d = parseFloat(den);
  if (isNaN(n) || isNaN(d) || d === 0) return '';
  return (n / d).toFixed(2);
}

function getColStr(idx: number) {
  if (idx >= 26) {
    const firstChar = String.fromCharCode(64 + Math.floor(idx / 26));
    const secondChar = String.fromCharCode(65 + (idx % 26));
    return `${firstChar}${secondChar}`;
  }
  return String.fromCharCode(65 + idx);
}

function safeNumber(val: any): number {
  const num = typeof val === 'number' ? val : parseFloat(String(val ?? ''));
  return Number.isFinite(num) ? num : 0;
}

function extractMonthKey(dateStr: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  const slashMatch = dateStr.match(/^(\d{4})\/(\d{1,2})/);
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}`;
  return '';
}

function extractDayKey(dateStr: string): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const slashMatch = dateStr.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}-${slashMatch[3].padStart(2, '0')}`;
  }
  return '';
}

function formatMonthLabel(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  return `${match[1]}年${Number(match[2])}月`;
}

function formatMonthSummaryLabel(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return `${monthKey}汇总`;
  return `${match[1]}年${Number(match[2])}月汇总`;
}

function parseSummaryMonthKey(label: any): string {
  if (typeof label !== 'string') return '';
  const trimmed = label.trim();
  const match = trimmed.match(/^(\d{4})年(\d{1,2})月汇总$/);
  if (!match) return '';
  return `${match[1]}-${match[2].padStart(2, '0')}`;
}

function getDaysInMonth(monthKey: string): number {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Date(year, month, 0).getDate();
}

const WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function formatDayLabel(dateStr: string): string {
  const dayKey = extractDayKey(dateStr);
  if (!dayKey) return dateStr;

  const [yearStr, monthStr, dayStr] = dayKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const weekday = WEEKDAY_LABELS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${year}/${month}/${day} ${weekday}`;
}

const MONTHLY_ROI_BLOCK_IDS = new Set([
  'block_roi_all_80',
  'block_roi_ios_fb_80',
  'block_roi_gp_fb_80'
]);

const MONTHLY_BASIC_BLOCK_IDS = new Set([
  'block_basic_all_80',
  'block_basic_gp_fb_80',
  'block_basic_ios_fb_80',
  'block_basic_gp_google_80',
  'block_basic_ios_asa_80'
]);

const MONTHLY_FEISHU_BLOCK_IDS = new Set([
  ...MONTHLY_ROI_BLOCK_IDS,
  ...MONTHLY_BASIC_BLOCK_IDS
]);

const MONTHLY_ROI_HEADERS = [
  '日期',
  '消耗($)',
  '7日回收金额',
  '14回收金额',
  '21日回收金额',
  '首日ROI',
  '2日ROI',
  '3日ROI',
  '4日ROI',
  '5日ROI',
  '6日ROI',
  '7日ROI',
  '14日ROI',
  '21日ROI',
  '30日ROI',
  '40日ROI',
  '50日ROI',
  '60日ROI',
  '70日ROI',
  '80日ROI',
  '90日ROI',
  '100日ROI',
  '',
  '2日倍率',
  '3日倍率\n（2？）',
  '4日倍率',
  '5日倍率',
  '6日倍率',
  '7日倍率\n（6？）',
  '14日倍率\n（10？）',
  '21日倍率',
  '30日倍率\n（15？）',
  '3/2',
  '7/2',
  '14/7\n（1.8-2）',
  '14/21',
  '7/30',
  '14/30',
  '21/30'
];

const MONTHLY_BASIC_HEADERS = [
  '日期',
  '消耗($)',
  '新增用户',
  'CPI',
  'DAU',
  '首日ROI',
  '新增 arpu',
  '新增首日用户付费数',
  '新增首日付费用户成本',
  '新增付费率',
  '新增付费arppu',
  '新增首日付费金额',
  '新增广告收入',
  '新增首日收入',
  '总收入',
  '1日留存',
  '活跃回收',
  '0月回收',
  '1月回收',
  '2月回收',
  '3月回收',
  '4月回收',
  '5月回收'
];

const ROI_FIELD_MAPPINGS = [
  { key: 'd0Revenue', field: 'roiD0' },
  { key: 'd1Revenue', field: 'roiD1' },
  { key: 'd2Revenue', field: 'roiD2' },
  { key: 'd3Revenue', field: 'roiD3' },
  { key: 'd4Revenue', field: 'roiD4' },
  { key: 'd5Revenue', field: 'roiD5' },
  { key: 'd6Revenue', field: 'roiD6' },
  { key: 'd13Revenue', field: 'roiD13' },
  { key: 'd20Revenue', field: 'roiD20' },
  { key: 'd29Revenue', field: 'roiD29' },
  { key: 'd39Revenue', field: 'roiD39' },
  { key: 'd49Revenue', field: 'roiD49' },
  { key: 'd59Revenue', field: 'roiD59' },
  { key: 'd69Revenue', field: 'roiD69' },
  { key: 'd79Revenue', field: 'roiD79' },
  { key: 'd89Revenue', field: 'roiD89' },
  { key: 'd99Revenue', field: 'roiD99' }
] as const;

function usesMonthlyFeishuFormat(blockId: string): boolean {
  return MONTHLY_FEISHU_BLOCK_IDS.has(blockId);
}

function hasPositiveSpend(rows: ProcessedRow[]): boolean {
  return rows.some(row => safeNumber(row.cost) > 0);
}

interface MonthlyFeishuBucket {
  monthKey: string;
  cost: number;
  installs: number;
  dausTotal: number;
  uniqueDays: Set<string>;
  paidInstalls: number;
  iapRevD0: number;
  adRevD0: number;
  revD0: number;
  revD6: number;
  revD13: number;
  revD20: number;
  totalRevenue: number;
  retention1Weighted: number;
  revM0: number;
  revM1: number;
  revM2: number;
  revM3: number;
  revM4: number;
  revM5: number;
  d0Revenue: number;
  d1Revenue: number;
  d2Revenue: number;
  d3Revenue: number;
  d4Revenue: number;
  d5Revenue: number;
  d6Revenue: number;
  d13Revenue: number;
  d20Revenue: number;
  d29Revenue: number;
  d39Revenue: number;
  d49Revenue: number;
  d59Revenue: number;
  d69Revenue: number;
  d79Revenue: number;
  d89Revenue: number;
  d99Revenue: number;
}

function createMonthlyBucket(monthKey: string): MonthlyFeishuBucket {
  return {
    monthKey,
    cost: 0,
    installs: 0,
    dausTotal: 0,
    uniqueDays: new Set<string>(),
    paidInstalls: 0,
    iapRevD0: 0,
    adRevD0: 0,
    revD0: 0,
    revD6: 0,
    revD13: 0,
    revD20: 0,
    totalRevenue: 0,
    retention1Weighted: 0,
    revM0: 0,
    revM1: 0,
    revM2: 0,
    revM3: 0,
    revM4: 0,
    revM5: 0,
    d0Revenue: 0,
    d1Revenue: 0,
    d2Revenue: 0,
    d3Revenue: 0,
    d4Revenue: 0,
    d5Revenue: 0,
    d6Revenue: 0,
    d13Revenue: 0,
    d20Revenue: 0,
    d29Revenue: 0,
    d39Revenue: 0,
    d49Revenue: 0,
    d59Revenue: 0,
    d69Revenue: 0,
    d79Revenue: 0,
    d89Revenue: 0,
    d99Revenue: 0
  };
}

function aggregateMonthlyFeishuData(data: ProcessedRow[]): MonthlyFeishuBucket[] {
  const monthlyMap = new Map<string, MonthlyFeishuBucket>();

  for (const row of data) {
    const monthKey = extractMonthKey(row.dateStr);
    if (!monthKey) continue;

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, createMonthlyBucket(monthKey));
    }

    const bucket = monthlyMap.get(monthKey)!;
    const cost = safeNumber(row.cost);
    const installs = safeNumber(row.installs);
    const dayKey = extractDayKey(row.dateStr);

    bucket.cost += cost;
    bucket.installs += installs;
    bucket.dausTotal += safeNumber(row.daus);
    bucket.paidInstalls += safeNumber(row.paidInstalls);
    bucket.iapRevD0 += safeNumber(row.iapRevD0);
    bucket.adRevD0 += safeNumber(row.adRevD0);
    bucket.revD0 += safeNumber(row.revD0);
    bucket.revD6 += safeNumber(row.revD6);
    bucket.revD13 += safeNumber(row.revD13);
    bucket.revD20 += safeNumber(row.revD20);
    bucket.totalRevenue += safeNumber(row.totalRevenue);
    bucket.retention1Weighted += safeNumber(row.retention1) * installs;
    bucket.revM0 += safeNumber(row.revM0);
    bucket.revM1 += safeNumber(row.revM1);
    bucket.revM2 += safeNumber(row.revM2);
    bucket.revM3 += safeNumber(row.revM3);
    bucket.revM4 += safeNumber(row.revM4);
    bucket.revM5 += safeNumber(row.revM5);

    for (const mapping of ROI_FIELD_MAPPINGS) {
      bucket[mapping.key] += safeNumber((row as any)[mapping.field]) * cost;
    }

    if (dayKey) {
      bucket.uniqueDays.add(dayKey);
    }
  }

  return Array.from(monthlyMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

function getMonthlyRoi(bucket: MonthlyFeishuBucket, key: keyof MonthlyFeishuBucket): number {
  return bucket.cost > 0 ? safeNumber(bucket[key]) / bucket.cost : 0;
}

function buildMonthlyRoiRow(bucket: MonthlyFeishuBucket, label: string = formatMonthLabel(bucket.monthKey)) {
  const roiD0 = getMonthlyRoi(bucket, 'd0Revenue');
  const roiD1 = getMonthlyRoi(bucket, 'd1Revenue');
  const roiD2 = getMonthlyRoi(bucket, 'd2Revenue');
  const roiD3 = getMonthlyRoi(bucket, 'd3Revenue');
  const roiD4 = getMonthlyRoi(bucket, 'd4Revenue');
  const roiD5 = getMonthlyRoi(bucket, 'd5Revenue');
  const roiD6 = getMonthlyRoi(bucket, 'd6Revenue');
  const roiD13 = getMonthlyRoi(bucket, 'd13Revenue');
  const roiD20 = getMonthlyRoi(bucket, 'd20Revenue');
  const roiD29 = getMonthlyRoi(bucket, 'd29Revenue');
  const roiD39 = getMonthlyRoi(bucket, 'd39Revenue');
  const roiD49 = getMonthlyRoi(bucket, 'd49Revenue');
  const roiD59 = getMonthlyRoi(bucket, 'd59Revenue');
  const roiD69 = getMonthlyRoi(bucket, 'd69Revenue');
  const roiD79 = getMonthlyRoi(bucket, 'd79Revenue');
  const roiD89 = getMonthlyRoi(bucket, 'd89Revenue');
  const roiD99 = getMonthlyRoi(bucket, 'd99Revenue');

  return [
    label,
    formatCurrency(bucket.cost),
    formatCurrency(bucket.revD6),
    formatCurrency(bucket.revD13),
    formatCurrency(bucket.revD20),
    formatPercent(roiD0),
    formatPercent(roiD1),
    formatPercent(roiD2),
    formatPercent(roiD3),
    formatPercent(roiD4),
    formatPercent(roiD5),
    formatPercent(roiD6),
    formatPercent(roiD13),
    formatPercent(roiD20),
    formatPercent(roiD29),
    formatPercent(roiD39),
    formatPercent(roiD49),
    formatPercent(roiD59),
    formatPercent(roiD69),
    formatPercent(roiD79),
    formatPercent(roiD89),
    formatPercent(roiD99),
    '',
    calcRatio(roiD1, roiD0),
    calcRatio(roiD2, roiD0),
    calcRatio(roiD3, roiD0),
    calcRatio(roiD4, roiD0),
    calcRatio(roiD5, roiD0),
    calcRatio(roiD6, roiD0),
    calcRatio(roiD13, roiD0),
    calcRatio(roiD20, roiD0),
    calcRatio(roiD29, roiD0),
    calcRatio(roiD2, roiD1),
    calcRatio(roiD6, roiD1),
    calcRatio(roiD13, roiD6),
    calcRatio(roiD13, roiD20),
    calcRatio(roiD6, roiD29),
    calcRatio(roiD13, roiD29),
    calcRatio(roiD20, roiD29)
  ];
}

function buildMonthlyBasicRow(bucket: MonthlyFeishuBucket, label: string = formatMonthLabel(bucket.monthKey)) {
  const dauAverage = bucket.uniqueDays.size > 0 ? bucket.dausTotal / bucket.uniqueDays.size : 0;
  const retention1 = bucket.installs > 0 ? bucket.retention1Weighted / bucket.installs : 0;
  const payRate = bucket.installs > 0 ? bucket.paidInstalls / bucket.installs : 0;
  const activeRecovery = bucket.cost > 0 ? bucket.totalRevenue / bucket.cost : 0;

  return [
    label,
    formatCurrency(bucket.cost),
    Math.round(bucket.installs),
    formatCurrency(bucket.installs > 0 ? bucket.cost / bucket.installs : 0),
    Math.round(dauAverage),
    formatPercent(getMonthlyRoi(bucket, 'd0Revenue')),
    formatCurrency(bucket.installs > 0 ? bucket.revD0 / bucket.installs : 0),
    Math.round(bucket.paidInstalls),
    formatCurrency(bucket.paidInstalls > 0 ? bucket.cost / bucket.paidInstalls : 0),
    formatPercent(payRate),
    formatCurrency(bucket.paidInstalls > 0 ? bucket.iapRevD0 / bucket.paidInstalls : 0),
    formatCurrency(bucket.iapRevD0),
    formatCurrency(bucket.adRevD0),
    formatCurrency(bucket.revD0),
    formatCurrency(bucket.totalRevenue),
    formatPercent(retention1),
    formatPercent(activeRecovery),
    formatPercent(bucket.cost > 0 ? bucket.revM0 / bucket.cost : 0),
    formatPercent(bucket.cost > 0 ? bucket.revM1 / bucket.cost : 0),
    formatPercent(bucket.cost > 0 ? bucket.revM2 / bucket.cost : 0),
    formatPercent(bucket.cost > 0 ? bucket.revM3 / bucket.cost : 0),
    formatPercent(bucket.cost > 0 ? bucket.revM4 / bucket.cost : 0),
    formatPercent(bucket.cost > 0 ? bucket.revM5 / bucket.cost : 0)
  ];
}

function buildDailyRoiRow(row: ProcessedRow) {
  const roiD0 = safeNumber(row.roiD0);
  const roiD1 = safeNumber(row.roiD1);
  const roiD2 = safeNumber(row.roiD2);
  const roiD3 = safeNumber(row.roiD3);
  const roiD4 = safeNumber(row.roiD4);
  const roiD5 = safeNumber(row.roiD5);
  const roiD6 = safeNumber(row.roiD6);
  const roiD13 = safeNumber(row.roiD13);
  const roiD20 = safeNumber(row.roiD20);
  const roiD29 = safeNumber(row.roiD29);
  const roiD39 = safeNumber(row.roiD39);
  const roiD49 = safeNumber(row.roiD49);
  const roiD59 = safeNumber(row.roiD59);
  const roiD69 = safeNumber(row.roiD69);
  const roiD79 = safeNumber(row.roiD79);
  const roiD89 = safeNumber(row.roiD89);
  const roiD99 = safeNumber(row.roiD99);

  return [
    formatDayLabel(row.dateStr),
    formatCurrency(row.cost),
    formatCurrency(row.revD6),
    formatCurrency(row.revD13),
    formatCurrency(row.revD20),
    formatPercent(roiD0),
    formatPercent(roiD1),
    formatPercent(roiD2),
    formatPercent(roiD3),
    formatPercent(roiD4),
    formatPercent(roiD5),
    formatPercent(roiD6),
    formatPercent(roiD13),
    formatPercent(roiD20),
    formatPercent(roiD29),
    formatPercent(roiD39),
    formatPercent(roiD49),
    formatPercent(roiD59),
    formatPercent(roiD69),
    formatPercent(roiD79),
    formatPercent(roiD89),
    formatPercent(roiD99),
    '',
    calcRatio(roiD1, roiD0),
    calcRatio(roiD2, roiD0),
    calcRatio(roiD3, roiD0),
    calcRatio(roiD4, roiD0),
    calcRatio(roiD5, roiD0),
    calcRatio(roiD6, roiD0),
    calcRatio(roiD13, roiD0),
    calcRatio(roiD20, roiD0),
    calcRatio(roiD29, roiD0),
    calcRatio(roiD2, roiD1),
    calcRatio(roiD6, roiD1),
    calcRatio(roiD13, roiD6),
    calcRatio(roiD13, roiD20),
    calcRatio(roiD6, roiD29),
    calcRatio(roiD13, roiD29),
    calcRatio(roiD20, roiD29)
  ];
}

function buildDailyBasicRow(row: ProcessedRow) {
  return [
    formatDayLabel(row.dateStr),
    formatCurrency(row.cost),
    Math.round(safeNumber(row.installs)),
    formatCurrency(row.cpa),
    Math.round(safeNumber(row.daus)),
    formatPercent(row.roiD0),
    formatCurrency(row.arpu),
    Math.round(safeNumber(row.paidInstalls)),
    formatCurrency(row.userPayCost),
    formatPercent(row.payRate),
    formatCurrency(row.paidArppu),
    formatCurrency(row.iapRevD0),
    formatCurrency(row.adRevD0),
    formatCurrency(row.revD0),
    formatCurrency(row.totalRevenue),
    formatPercent(row.retention1),
    formatPercent(safeNumber(row.cost) > 0 ? safeNumber(row.totalRevenue) / safeNumber(row.cost) : 0),
    formatPercent(row.roasM0),
    formatPercent(row.roasM1),
    formatPercent(row.roasM2),
    formatPercent(row.roasM3),
    formatPercent(row.roasM4),
    formatPercent(row.roasM5)
  ];
}

function buildMixedMonthlyDailyRows(data: ProcessedRow[]) {
  if (!data.length) return { header: [], rows: [] };

  const blockId = data[0].blockId || '';
  const isRoiBlock = MONTHLY_ROI_BLOCK_IDS.has(blockId);
  const monthlyBuckets = aggregateMonthlyFeishuData(data);
  const monthlyBucketMap = new Map(monthlyBuckets.map(bucket => [bucket.monthKey, bucket]));
  const dailyRowsByMonth = new Map<string, ProcessedRow[]>();

  for (const row of data) {
    const monthKey = extractMonthKey(row.dateStr);
    if (!monthKey) continue;
    if (!dailyRowsByMonth.has(monthKey)) {
      dailyRowsByMonth.set(monthKey, []);
    }
    dailyRowsByMonth.get(monthKey)!.push(row);
  }

  const orderedMonthKeys = Array.from(
    new Set([...monthlyBuckets.map(bucket => bucket.monthKey), ...dailyRowsByMonth.keys()])
  ).sort((a, b) => a.localeCompare(b));

  const rows: any[][] = [];
  for (const monthKey of orderedMonthKeys) {
    const bucket = monthlyBucketMap.get(monthKey);
    if (bucket) {
      rows.push(
        isRoiBlock
          ? buildMonthlyRoiRow(bucket, formatMonthSummaryLabel(monthKey))
          : buildMonthlyBasicRow(bucket, formatMonthSummaryLabel(monthKey))
      );
    }

    const monthRows = (dailyRowsByMonth.get(monthKey) || []).slice().sort((a, b) => {
      const dayA = extractDayKey(a.dateStr);
      const dayB = extractDayKey(b.dateStr);
      return dayA.localeCompare(dayB);
    });

    for (const row of monthRows) {
      rows.push(isRoiBlock ? buildDailyRoiRow(row) : buildDailyBasicRow(row));
    }
  }

  return {
    header: isRoiBlock ? MONTHLY_ROI_HEADERS : MONTHLY_BASIC_HEADERS,
    rows
  };
}

/**
 * 创建新的子表 (Sheet)
 */
export async function createSheet(config: AppConfig, spreadsheetToken: string, title: string) {
  const token = await getTenantAccessToken(config);
  const useProxy = typeof window !== 'undefined' && config.adjust_api.use_proxy;

  let url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/sheets_batch_update`;
  if (useProxy) {
    url = `/api/feishu/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/sheets_batch_update`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      requests: [{
        addSheet: {
          properties: {
            title: title
          }
        }
      }]
    })
  });

  const result = await response.json();
  if (result.code !== 0) {
    throw new Error(`创建子表失败: ${result.msg}`);
  }
  const properties = result.data?.replies?.[0]?.addSheet?.properties || {};
  const createdSheetId = properties.sheet_id || properties.sheetId;
  if (!createdSheetId) {
    throw new Error('创建子表失败: 未返回 sheet_id');
  }
  return createdSheetId;
}

async function highlightMonthlySummaryRows(
  config: AppConfig,
  spreadsheetToken: string,
  sheetId: string,
  headerLength: number
) {
  const token = await getTenantAccessToken(config);
  const useProxy = typeof window !== 'undefined' && config.adjust_api.use_proxy;

  let readUrl = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A:AZ`;
  if (useProxy) {
    readUrl = `/api/feishu/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A:AZ`;
  }

  const readRes = await fetch(readUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const readData = await readRes.json();
  const values: any[][] = readData.data?.valueRange?.values || [];
  if (values.length === 0) return;

  const summaryRowNumbers: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    if (row.some(cell => typeof cell === 'string' && cell.includes('汇总'))) {
      summaryRowNumbers.push(i + 1);
    }
  }

  if (summaryRowNumbers.length === 0) return;

  const endCol = getColStr(headerLength - 1);
  const ranges = summaryRowNumbers.map(rowNum => `${sheetId}!A${rowNum}:${endCol}${rowNum}`);

  let styleUrl = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/styles_batch_update`;
  if (useProxy) {
    styleUrl = `/api/feishu/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/styles_batch_update`;
  }

  const response = await fetch(styleUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: [{
        ranges,
        style: {
          backColor: '#FFF2CC'
        }
      }]
    })
  });

  const result = await response.json();
  if (result.code !== 0) {
    throw new Error(`设置月汇总行颜色失败: ${result.msg}`);
  }
}

async function setSheetRowVisibility(
  config: AppConfig,
  spreadsheetToken: string,
  sheetId: string,
  startRowNumber: number,
  endRowNumber: number,
  visible: boolean
) {
  if (endRowNumber < startRowNumber) return;

  const token = await getTenantAccessToken(config);
  const useProxy = typeof window !== 'undefined' && config.adjust_api.use_proxy;

  let url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/dimension_range`;
  if (useProxy) {
    url = `/api/feishu/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/dimension_range`;
  }

  let retries = 3;
  while (retries > 0) {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dimension: {
          sheetId,
          majorDimension: 'ROWS',
          startIndex: startRowNumber - 1,
          endIndex: endRowNumber
        },
        dimensionProperties: {
          visible
        }
      })
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error('设置行显示状态失败: 飞书 API 返回了非 JSON 数据');
    }

    if (result.code === 0) {
      return;
    }

    if (result.msg && result.msg.toLowerCase().includes('too many request')) {
      retries--;
      if (retries === 0) throw new Error(`设置行显示状态失败: ${result.msg}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      continue;
    }

    throw new Error(`设置行显示状态失败: ${result.msg || 'unknown error'}`);
  }
}

async function collapseCompletedMonthRows(
  config: AppConfig,
  spreadsheetToken: string,
  sheetId: string
) {
  const token = await getTenantAccessToken(config);
  const useProxy = typeof window !== 'undefined' && config.adjust_api.use_proxy;

  let readUrl = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A:A?valueRenderOption=ToString`;
  if (useProxy) {
    readUrl = `/api/feishu/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A:A?valueRenderOption=ToString`;
  }

  const readRes = await fetch(readUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const readData = await readRes.json();
  const values: any[][] = readData.data?.valueRange?.values || [];
  if (values.length === 0) return;

  const sections: Array<{
    monthKey: string;
    dailyStartRowNumber: number;
    dailyEndRowNumber: number;
    dailyCount: number;
  }> = [];

  let currentSection: {
    monthKey: string;
    dailyStartRowNumber: number;
    dailyEndRowNumber: number;
    dailyCount: number;
  } | null = null;

  const flushSection = () => {
    if (!currentSection || currentSection.dailyCount === 0) return;
    sections.push({ ...currentSection });
  };

  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    const cell = typeof row[0] === 'string' ? row[0].trim() : '';
    const rowNumber = i + 1;

    const summaryMonthKey = parseSummaryMonthKey(cell);
    if (summaryMonthKey) {
      flushSection();
      currentSection = {
        monthKey: summaryMonthKey,
        dailyStartRowNumber: 0,
        dailyEndRowNumber: 0,
        dailyCount: 0
      };
      continue;
    }

    if (!currentSection) continue;

    const dayKey = extractDayKey(cell);
    if (!dayKey || extractMonthKey(dayKey) !== currentSection.monthKey) continue;

    if (currentSection.dailyStartRowNumber === 0) {
      currentSection.dailyStartRowNumber = rowNumber;
    }
    currentSection.dailyEndRowNumber = rowNumber;
    currentSection.dailyCount += 1;
  }

  flushSection();

  if (sections.length === 0) return;

  const latestMonthKey = sections
    .map(section => section.monthKey)
    .sort((a, b) => a.localeCompare(b))
    .at(-1);

  if (!latestMonthKey) return;

  for (const section of sections) {
    if (section.monthKey === latestMonthKey) {
      continue;
    }

    await setSheetRowVisibility(config, spreadsheetToken, sheetId, section.dailyStartRowNumber, section.dailyEndRowNumber, false);
  }
}

/**
 * 将数据同步到飞书电子表格
 */
import { upsertToFeishuSheet } from './feishuUpsert';
import { verifySync } from './feishuValidator';


function formatDataForFeishu(data: ProcessedRow[], mode: 'daily' | 'monthly' | 'mixed' = 'daily') {
  if (!data || data.length === 0) return { header: [], rows: [] };
  const blockId = data[0].blockId || '';

  let header: string[] = [];
  let rows: any[][] = [];

  if (usesMonthlyFeishuFormat(blockId) && mode === 'mixed') {
    return buildMixedMonthlyDailyRows(data);
  }

  if (usesMonthlyFeishuFormat(blockId) && mode === 'monthly') {
    const monthlyBuckets = aggregateMonthlyFeishuData(data);

    if (MONTHLY_ROI_BLOCK_IDS.has(blockId)) {
      header = MONTHLY_ROI_HEADERS;
      rows = monthlyBuckets.map(bucket => buildMonthlyRoiRow(bucket));
    } else {
      header = MONTHLY_BASIC_HEADERS;
      rows = monthlyBuckets.map(bucket => buildMonthlyBasicRow(bucket));
    }
  } else if (usesMonthlyFeishuFormat(blockId)) {
    if (MONTHLY_ROI_BLOCK_IDS.has(blockId)) {
      header = MONTHLY_ROI_HEADERS;
      rows = data.map(row => buildDailyRoiRow(row));
    } else {
      header = MONTHLY_BASIC_HEADERS;
      rows = data.map(row => buildDailyBasicRow(row));
    }
  } else if (blockId === 'block_retention') {
    header = [
      '投放策略/版本变化日志', '版本', '日期', '消耗($)', 
      '1日留存', '2日留存', '3日留存', '4日留存', '5日留存', '6日留存', '7日留存', '14日留存', '20日留存', 
      '7日回收金额', '14回收金额', '21日回收金额'
    ];
    rows = data.map(r => {
      return [
        '', r.appName || '', r.dateStr, formatCurrency(r.cost), 
        formatPercent(r.retention1), formatPercent(r.retention2), formatPercent(r.retention3), formatPercent(r.retention4), formatPercent(r.retention5), formatPercent(r.retention6), formatPercent(r.retention7), formatPercent(r.retention14), formatPercent(r.retention20),
        formatCurrency(r.revD7), formatCurrency(r.revD14), formatCurrency(r.revD21)
      ];
    });
  } else if (blockId === 'block_retention_network' || blockId === 'block_spend_details') {
    header = [
      '版本', '日期', '消耗($)', '新增用户', 'CPI', 'DAU', '首日ROI', '新增 arpu', 
      '新增首日用户付费数', '新增首日付费用户成本', '新增付费率', '新增付费arppu', 
      '新增首日付费金额', '新增广告收入', '新增首日收入', '总收入', '1日留存', '7日留存', '14日留存'
    ];
    rows = data.map(r => [
      `${r.appName || ''} - ${blockId === 'block_spend_details' ? r.campaignName : r.network}`,
      r.dateStr, formatCurrency(r.cost), r.installs, formatCurrency(r.cpa), r.daus || 0, formatPercent(r.roiD0), formatCurrency(r.arpu), 
      r.paidInstalls, formatCurrency(r.userPayCost), formatPercent(r.payRate), formatCurrency(r.paidArppu), 
      formatCurrency(r.iapRevenue), formatCurrency(r.adRevenue), formatCurrency(r.cohortRevenue), formatCurrency(r.totalRevenue), formatPercent(r.retention1), formatPercent(r.retention7), formatPercent(r.retention14)
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
  let sheet_id = overrideSheetId || config.feishu_config.sheet_id;

  if (!spreadsheet_token) throw new Error("请选择同步目的地表格");
  if (!data || data.length === 0) throw new Error("没有可同步的数据");

  const uniqueBlockIds = Array.from(new Set(data.map(row => row.blockId).filter(Boolean))) as string[];
  const shouldForceAutoRouting = uniqueBlockIds.length >= 1 && uniqueBlockIds.every(blockId => usesMonthlyFeishuFormat(blockId));
  if (shouldForceAutoRouting) {
    sheet_id = 'auto';
  }

  // 获取当前表格的所有子表，用于校验 sheet_id 是否有效
  const sheets = await getSpreadsheetSheets(config, spreadsheet_token);

  // 用户要求不要在这些老 Sheet 上叠加数据，强制新创建
  const blacklistedIds = ['1hFpiu', '4shxvY', '5PnClN', 'KrjaRy', 'qp7sOz', '2mmDaV', '3zjVBF', '5pjlhP', 'hLvcEU'];
  
  // 校验指定的 sheet_id 是否存在
  const sheetExists = sheet_id !== 'auto' && sheets.some(s => s.sheet_id === sheet_id);

  if (blacklistedIds.includes(sheet_id) || (sheet_id !== 'auto' && !sheetExists)) {
    if (!sheetExists && sheet_id !== 'auto') {
      console.log(`DEBUG: Sheet ID ${sheet_id} not found in spreadsheet, falling back to 'auto' creation.`);
    } else {
      console.log(`DEBUG: Sheet ID ${sheet_id} is blacklisted, forcing auto-creation of new sheets.`);
    }
    sheet_id = 'auto';
  }

  if (!sheet_id) throw new Error("请选择同步目的地子表");

  // Sort data by date ascending, then appName, then network
  data.sort((a, b) => {
    if (a.dateStr < b.dateStr) return -1;
    if (a.dateStr > b.dateStr) return 1;
    const appA = a.appName || '';
    const appB = b.appName || '';
    if (appA < appB) return -1;
    if (appA > appB) return 1;
    const netA = a.network || '';
    const netB = b.network || '';
    if (netA < netB) return -1;
    if (netA > netB) return 1;
    return 0;
  });

  if (sheet_id === 'auto') {
    const sheetDataMap = new Map<string, ProcessedRow[]>();
    const sheetTitleMap = new Map<string, string>();

    for (const row of data) {
      const os = (row.storeType || '').toLowerCase();
      const net = (row.network || '').toLowerCase();
      const blockId = row.blockId || '';
      
      let osKey = '';
      if (os.includes('android') || os.includes('google') || os.includes('gp')) osKey = 'AND';
      else if (os.includes('ios') || os.includes('apple') || os.includes('iphone')) osKey = 'IOS';
      else osKey = os.toUpperCase() || 'UNKNOWN';
      
      let netKey = '';
      if (net.includes('facebook') || net.includes('fb') || net.includes('instagram')) netKey = 'FB';
      else if (net.includes('google') || net.includes('adwords')) netKey = 'GG';
      else if (net.includes('applovin')) netKey = 'AL';
      else if (net.includes('tiktok')) netKey = 'TT';
      else if (net.includes('mintegral')) netKey = 'MTG';
      else if (net.includes('unity')) netKey = 'UADS';
      else if (net.includes('ironsource')) netKey = 'IS';
      else netKey = net.toUpperCase() || 'UNKNOWN';

      let targetSheetTitle = '';
      if (blockId === 'block_roi_all_80') targetSheetTitle = 'ROI-发行-市场部门';
      else if (blockId === 'block_roi_ios_fb_80') targetSheetTitle = 'ROI-IOS-FB';
      else if (blockId === 'block_roi_gp_fb_80') targetSheetTitle = 'ROI-GP-FB';
      else if (blockId === 'block_basic_all_80') targetSheetTitle = '基础数据-发行-市场部门';
      else if (blockId === 'block_basic_gp_google_80') targetSheetTitle = '基础数据-GP-Google';
      else if (blockId === 'block_basic_ios_asa_80') targetSheetTitle = '基础数据-IOS-ASA';
      else if (blockId === 'block_basic_gp_fb_80') targetSheetTitle = '基础数据-GP-FB';
      else if (blockId === 'block_basic_ios_fb_80') targetSheetTitle = '基础数据-IOS-FB';
      else if (blockId === 'block_basic') targetSheetTitle = '基础数据';
      else if (blockId === 'block_roi') targetSheetTitle = '总回收ROI';
      else if (blockId === 'block_retention') targetSheetTitle = '留存';
      else if (blockId === 'block_roi_network' || blockId.includes('_roi')) targetSheetTitle = `ROI-${osKey}-${netKey}`;
      else if (blockId === 'block_spend_details') targetSheetTitle = `数据-${osKey}-${netKey}`;
      else if (blockId === 'block_retention_network') targetSheetTitle = `留存-${netKey}`;
      else targetSheetTitle = `其他-${blockId}`; // 兜底 Sheet

      const targetTitles = [targetSheetTitle];

      for (const fullTitle of targetTitles) {
        let targetSheetId = sheets.find(s => s.title === fullTitle)?.sheet_id;

        if (!targetSheetId) {
          const latestSheets = await getSpreadsheetSheets(config, spreadsheet_token);
          const doubleCheck = latestSheets.find(s => s.title === fullTitle);
          
          if (doubleCheck) {
            targetSheetId = doubleCheck.sheet_id;
            if (!sheets.find(s => s.title === fullTitle)) {
               sheets.push({ title: fullTitle, sheet_id: targetSheetId });
            }
          } else {
            console.log(`DEBUG: Creating new sync sheet: ${fullTitle}`);
            targetSheetId = await createSheet(config, spreadsheet_token, fullTitle);
            sheets.push({ title: fullTitle, sheet_id: targetSheetId });
          }
        }

        if (targetSheetId) {
          if (!sheetDataMap.has(targetSheetId)) {
            sheetDataMap.set(targetSheetId, []);
            sheetTitleMap.set(targetSheetId, fullTitle);
          }
          sheetDataMap.get(targetSheetId)!.push(row);
        }
      }
    }

    let totalUpdated = 0;
    let totalAppended = 0;
    
    for (const [sId, rowsData] of sheetDataMap.entries()) {
      const currentTitle = sheetTitleMap.get(sId);
      const blockDataMap = new Map<string, ProcessedRow[]>();
      for (const row of rowsData) {
        const bId = row.blockId || 'unknown';
        if (!blockDataMap.has(bId)) blockDataMap.set(bId, []);
        blockDataMap.get(bId)!.push(row);
      }
      
      for (const [bId, blockRows] of blockDataMap.entries()) {
        if (!hasPositiveSpend(blockRows)) {
          console.log(`DEBUG: Skipping inactive block '${bId}' for sheet '${currentTitle}' because total spend is 0.`);
          continue;
        }

        const mode = usesMonthlyFeishuFormat(bId) ? 'mixed' : 'daily';
        const { header, rows } = formatDataForFeishu(blockRows, mode);
        const res = await upsertToFeishuSheet(config, spreadsheet_token, sId, header, rows, currentTitle);
        if (mode === 'mixed') {
          await highlightMonthlySummaryRows(config, spreadsheet_token, sId, header.length);
          await collapseCompletedMonthRows(config, spreadsheet_token, sId);
        }
        totalUpdated += res.updated;
        totalAppended += res.appended;
        
        if (!usesMonthlyFeishuFormat(bId)) {
          await verifySync(config, spreadsheet_token, sId, blockRows, header);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return { code: 0, msg: 'success', data: { updated: totalUpdated, appended: totalAppended } };
  } else {
    // 使用指定的 sheet_id
    let totalUpdated = 0;
    let totalAppended = 0;
    
    const blockDataMap = new Map<string, ProcessedRow[]>();
    for (const row of data) {
      const bId = row.blockId || 'unknown';
      if (!blockDataMap.has(bId)) blockDataMap.set(bId, []);
      blockDataMap.get(bId)!.push(row);
    }
    
    for (const [bId, blockRows] of blockDataMap.entries()) {
      if (!hasPositiveSpend(blockRows)) {
        console.log(`DEBUG: Skipping inactive block '${bId}' because total spend is 0.`);
        continue;
      }

      const mode = usesMonthlyFeishuFormat(bId) ? 'mixed' : 'daily';
      const { header, rows } = formatDataForFeishu(blockRows, mode);
      const res = await upsertToFeishuSheet(config, spreadsheet_token, sheet_id, header, rows);
      if (mode === 'mixed') {
        await highlightMonthlySummaryRows(config, spreadsheet_token, sheet_id, header.length);
        await collapseCompletedMonthRows(config, spreadsheet_token, sheet_id);
      }
      totalUpdated += res.updated;
      totalAppended += res.appended;
      
      if (!usesMonthlyFeishuFormat(bId)) {
        await verifySync(config, spreadsheet_token, sheet_id, blockRows, header);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return { code: 0, msg: 'success', data: { updated: totalUpdated, appended: totalAppended } };
  }
}
