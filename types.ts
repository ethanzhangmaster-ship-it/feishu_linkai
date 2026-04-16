
export interface DataBlockConfig {
  id: string;
  name: string;
  grouping: string[];
  filter: string;
  label_column: string;
  label_value_source?: string;
  label_value_fixed?: string;
  revenue_mode?: 'gross' | '80_gross';
}

export interface ProcessedRow {
  id: string;
  appName?: string; 
  appToken?: string;
  storeType: string; 
  network: string; 
  country?: string; 
  sourceAccountId?: string; 
  campaignName?: string;    
  version: string; 
  dateStr: string; 
  cost: number; 
  totalRevenue: number; 
  adRevenue: number;    
  iapRevenue: number;   
  cohortRevenue: number; 
  installs: number; 
  cpa: number; 
  roi: number; 
  arpu: number; 
  userPayCost: number; 
  paidInstalls: number; 
  paidArppu: number; 
  payRate: number; 
  retention1: number; 
  retention2?: number;
  retention3?: number;
  retention4?: number;
  retention5?: number;
  retention6?: number;
  retention7?: number;
  retention14?: number;
  retention20?: number;
  roiD0?: number;
  roiD1?: number;
  roiD2?: number;
  roiD3?: number;
  roiD4?: number;
  roiD5?: number;
  roiD6?: number;
  roiD7?: number;
  roiD13?: number; 
  roiD14?: number;
  roiD20?: number; 
  roiD21?: number;
  roiD29?: number;
  roiD30?: number;
  roiD39?: number;
  roiD49?: number;
  roiD59?: number;
  roiD69?: number;
  roiD79?: number;
  roiD89?: number;
  roiD99?: number;
  daus?: number;
  sessions?: number;
  
  // New fields for Feishu
  revD0?: number;
  iapRevD0?: number;
  adRevD0?: number;
  revD6?: number;
  revD7?: number;
  revD13?: number;
  revD14?: number;
  revD20?: number;
  revD21?: number;
  revD29?: number;
  revD30?: number;
  revM0?: number;
  revM1?: number;
  revM2?: number;
  revM3?: number;
  revM4?: number;
  revM5?: number;
  revM6?: number;
  blockId?: string; // To identify which block this row belongs to
  
  // Basic data additional fields
  allRevenuePerUserD0?: number;
  costPerPayingUserD0?: number;
  firstTimePayingUserConversionRateD0?: number;
  revenuePerPayingUserD0?: number;
  roasM0?: number;
  roasM1?: number;
  roasM2?: number;
  roasM3?: number;
  roasM4?: number;
  roasM5?: number;
  roasM6?: number;
}

export interface ValidationResult {
  status: 'success' | 'warning' | 'error';
  messages: string[];
}

export interface FeishuDestination {
  token: string;
  sheetId: string;
  sheetName: string;
  lastUsed: string;
}

export interface AppConfig {
  adjust_api: {
    user_token: string;
    use_proxy?: boolean;
  };
  feishu_config: {
    app_id: string;
    app_secret: string;
    spreadsheet_token: string;
    sheet_id: string;
    enabled: boolean;
    last_sync_time?: string;
    selected_apps?: string[];
    selected_blocks?: string[];
    recent_destinations?: FeishuDestination[];
    auto_sync_enabled?: boolean;
    auto_sync_days?: number;
    auto_sync_start_date?: string;
    app_mappings?: { 
      appName: string; 
      spreadsheet_token: string;
      sheet_mappings?: { blockId: string; sheetId: string }[];
    }[];
  };
  ai_config?: {
    api_key: string;
    model: string;
  };
  data_blocks: DataBlockConfig[];
  kpis: string[];
}
