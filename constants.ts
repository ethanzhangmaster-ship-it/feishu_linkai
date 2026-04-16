
import { DataBlockConfig } from './types';

export const DEFAULT_BLOCKS: DataBlockConfig[] = [
  // --- UI 专用数据块 (用于前端 Dashboard 展示) ---
  {
    id: 'block_basic',
    name: "基础数据",
    grouping: ["date", "app", "network", "store_type"],
    filter: "",
    label_column: "说明",
    label_value_fixed: "All" 
  },
  {
    id: 'block_roi',
    name: "ROI (总)",
    grouping: ["date", "app", "network", "store_type"],
    filter: "",
    label_column: "说明",
    label_value_fixed: "All"
  },
  {
    id: 'block_roi_network',
    name: "ROI (分渠道)",
    grouping: ["date", "network"],
    filter: "",
    label_column: "渠道",
    label_value_source: "network"
  },
  {
    id: 'block_retention',
    name: "留存 (总)",
    grouping: ["date"],
    filter: "",
    label_column: "说明",
    label_value_fixed: "All"
  },
  {
    id: 'block_spend_details',
    name: "支出明细",
    grouping: ["date", "network", "campaign"],
    filter: "",
    label_column: "Campaign",
    label_value_source: "campaign"
  },
  {
    id: 'block_country_revenue',
    name: "国家收入",
    grouping: ["date", "country"],
    filter: "",
    label_column: "国家",
    label_value_source: "country"
  },
  {
    id: 'block_summary_app',
    name: "应用汇总报表",
    grouping: ["app"],
    filter: "",
    label_column: "应用",
    label_value_source: "app"
  },
  {
    id: 'block_summary_network',
    name: "渠道汇总报表",
    grouping: ["network"],
    filter: "",
    label_column: "渠道",
    label_value_source: "network"
  },

  // --- 飞书推送专用数据块 (80% Gross) ---
  {
    id: "block_roi_all_80",
    name: "ROI-发行-市场部门 (80% Gross)",
    grouping: ["date"],
    filter: "",
    label_column: "说明",
    label_value_fixed: "ROI All 80%",
    revenue_mode: "80_gross"
  },
  {
    id: "block_roi_ios_fb_80",
    name: "ROI-IOS-FB (80% Gross)",
    grouping: ["date"],
    filter: "store_type=ios&network=Facebook",
    label_column: "说明",
    label_value_fixed: "ROI IOS FB 80%",
    revenue_mode: "80_gross"
  },
  {
    id: "block_roi_gp_fb_80",
    name: "ROI-GP-FB (80% Gross)",
    grouping: ["date"],
    filter: "store_type=android&network=Facebook",
    label_column: "说明",
    label_value_fixed: "ROI GP FB 80%",
    revenue_mode: "80_gross"
  },
  {
    id: "block_basic_all_80",
    name: "基础数据-发行-市场部门 (80% Gross)",
    grouping: ["date"],
    filter: "",
    label_column: "说明",
    label_value_fixed: "Basic All 80%",
    revenue_mode: "80_gross"
  },
  {
    id: "block_basic_gp_fb_80",
    name: "基础数据-GP-FB (80% Gross)",
    grouping: ["date"],
    filter: "store_type=android&network=Facebook",
    label_column: "说明",
    label_value_fixed: "Basic GP FB 80%",
    revenue_mode: "80_gross"
  },
  {
    id: "block_basic_ios_fb_80",
    name: "基础数据-IOS-FB (80% Gross)",
    grouping: ["date"],
    filter: "store_type=ios&network=Facebook",
    label_column: "说明",
    label_value_fixed: "Basic IOS FB 80%",
    revenue_mode: "80_gross"
  },
  {
    id: "block_basic_gp_google_80",
    name: "基础数据-GP-Google (80% Gross)",
    grouping: ["date"],
    filter: "store_type=android&network=Google Ads",
    label_column: "说明",
    label_value_fixed: "Basic GP Google 80%",
    revenue_mode: "80_gross"
  },
  {
    id: "block_basic_ios_asa_80",
    name: "基础数据-IOS-ASA (80% Gross)",
    grouping: ["date"],
    filter: "store_type=ios&network=Apple",
    label_column: "说明",
    label_value_fixed: "Basic IOS ASA 80%",
    revenue_mode: "80_gross"
  }
];

export const BASIC_TABLE_HEADERS = [
  'day', 'cost', 'installs', 'ecpi_all', 'daus', 'roas_d0', 
  'all_revenue_per_user_d0', 'first_paying_users_d0', 'cost_per_paying_user_d0', 
  'first_time_paying_user_conversion_rate_d0', 'revenue_per_paying_user_d0', 
  'revenue_total_d0', 'ad_revenue_total_d0', 'all_revenue_total_d0', 'all_revenue', 
  'retention_rate_d1', 'roas_m0', 'roas_m1', 'roas_m2', 'roas_m3', 'roas_m4', 'roas_m5', 'roas_m6'
];

export const ROI_TABLE_HEADERS = [
  'day', 'cost', 'all_revenue_total_d6', 'all_revenue_total_d13', 'all_revenue_total_d20', 
  'roas_d0', 'roas_d1', 'roas_d2', 'roas_d3', 'roas_d4', 'roas_d5', 'roas_d6', 
  'roas_d13', 'roas_d20', 'roas_d29', 'roas_d39', 'roas_d49', 'roas_d59', 'roas_d69', 
  'roas_d79', 'roas_d89', 'roas_d99'
];

export const ROI_NETWORK_TABLE_HEADERS = [
  '日期', '应用名称', '渠道', '消耗($)', 
  'ROI D0', 'ROI D1', 'ROI D2', 'ROI D3', 'ROI D4', 'ROI D5', 'ROI D6', 
  'ROI D13', 'ROI D20'
];

export const RETENTION_TABLE_HEADERS = [
  '日期', '应用名称', '新增用户',
  '1日留存', '2日留存', '3日留存', '4日留存', '5日留存', '6日留存', '7日留存',
  '14日留存', '20日留存'
];

export const RETENTION_NETWORK_TABLE_HEADERS = [
  '日期', '应用名称', '渠道', '新增用户',
  '1日留存', '2日留存', '3日留存', '4日留存', '5日留存', '6日留存', '7日留存',
  '14日留存', '20日留存'
];

export const SPEND_DETAILS_TABLE_HEADERS = [
  '日期', '应用名称', '渠道', '推广活动', '消耗($)', '新增用户', 'CPI'
];

export const SPEND_DAILY_TABLE_HEADERS = SPEND_DETAILS_TABLE_HEADERS;
export const PERIOD_SUMMARY_HEADERS = ["日期/周期", "应用名称", "合作伙伴", "国家", "商店", "消耗($)", "安装", "CPI", "总收入($)", "ROI", "1日留存"];
