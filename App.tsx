
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DEFAULT_BLOCKS } from './constants';
import { ProcessedRow, AppConfig } from './types';
import { fetchAndProcessData } from './services/adjustService';
import DataTable from './components/DataTable';
import RankingView from './components/RankingView';
import ComparisonView from './components/ComparisonView';
import RevenueTrendView from './components/RevenueTrendView';
import CountryRevenueView from './components/CountryRevenueView';
import DetailedRevenueView from './components/DetailedRevenueView';
import CostAnalysisView from './components/CostAnalysisView';
import ConfigModal from './components/ConfigModal';
import DateRangePicker from './components/DateRangePicker';
import LoadingSkeleton from './components/LoadingSkeleton';
import FeishuSyncModal from './components/FeishuSyncModal';
import AdSourceFilter from './components/AdSourceFilter';
import { 
  Settings, 
  Layers,
  Percent,
  Magnet,
  PieChart,
  DollarSign,
  Globe,
  Database,
  MessageSquare,
  RotateCcw,
  XCircle,
  ChevronDown,
  Loader2,
  Activity,
  History,
  TrendingUp,
  Filter,
  Smartphone,
  Share2,
  Table as TableIcon,
  LayoutDashboard,
  Trophy,
  GitCompare,
  BarChart3,
  Menu
} from 'lucide-react';

const STORAGE_KEY = 'adjust_dashboard_v5_core';
const DEFAULT_AUTO_SYNC_APP_MAPPINGS: Array<{
  appName: string;
  spreadsheet_token: string;
  sheet_mappings?: { blockId: string; sheetId: string }[];
}> = [];

const mergeFeishuAppMappings = (
  savedMappings: Array<{ appName: string; spreadsheet_token: string; sheet_mappings?: { blockId: string; sheetId: string }[] }> = []
) => {
  const merged = [...DEFAULT_AUTO_SYNC_APP_MAPPINGS];
  savedMappings.forEach(mapping => {
    const exists = merged.some(
      item => item.appName === mapping.appName && item.spreadsheet_token === mapping.spreadsheet_token
    );
    if (!exists) {
      merged.push(mapping);
    }
  });
  return merged;
};

interface PersistedState {
  config: AppConfig;
  ui: {
    activeBlockId: string;
    viewMode: 'dashboard' | 'rankings' | 'comparison' | 'revenue' | 'detail' | 'cost' | 'country';
    startDate: string;
    endDate: string;
    filters: {
      appName: string;
      storeType: string;
      network: string;
      adSources: string[];
    };
  };
}

const INITIAL_CONFIG: AppConfig = {
  adjust_api: { 
    user_token: '', 
    use_proxy: true 
  },
  feishu_config: { 
    app_id: '', 
    app_secret: '', 
    spreadsheet_token: '', 
    sheet_id: '', 
    enabled: true,
    auto_sync_start_date: '2025-12-01',
    selected_apps: [],
    app_mappings: DEFAULT_AUTO_SYNC_APP_MAPPINGS,
    selected_blocks: [
      "block_roi_all_80",
      "block_roi_ios_fb_80",
      "block_roi_gp_fb_80",
      "block_basic_all_80",
      "block_basic_gp_fb_80",
      "block_basic_ios_fb_80"
    ]
  },
  ai_config: { api_key: '', model: 'gemini-3.1-pro-preview' },
  data_blocks: DEFAULT_BLOCKS,
  kpis: []
};

const getDateString = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
};

const DEFAULT_FETCH_START_DATE = '2025-12-01';

const getBlockIcon = (id: string) => {
  if (id.includes('roi')) return <Percent className="w-3 h-3" />;
  if (id.includes('retention')) return <Magnet className="w-3 h-3" />;
  if (id.includes('spend')) return <DollarSign className="w-3 h-3" />;
  if (id.includes('country')) return <Globe className="w-3 h-3" />;
  if (id.includes('summary')) return <PieChart className="w-3 h-3" />;
  return <Database className="w-3 h-3" />;
};

function App() {
  const [fullState, setFullState] = useState<PersistedState>(() => {
    // 1. Try to load from URL Params (for shared links)
    const params = new URLSearchParams(window.location.search);
    if (params.has('view')) {
       // Attempt to recover config (especially API Token) from local storage
       let resolvedConfig = INITIAL_CONFIG;
       try {
         const saved = localStorage.getItem(STORAGE_KEY);
         if (saved) {
           const parsed = JSON.parse(saved);
           if (parsed.config) {
             const mergedBlocks = parsed.config.data_blocks ? [...parsed.config.data_blocks] : [...INITIAL_CONFIG.data_blocks];
             INITIAL_CONFIG.data_blocks.forEach(defaultBlock => {
               if (!mergedBlocks.some((b: any) => b.id === defaultBlock.id)) {
                 mergedBlocks.push(defaultBlock);
               }
             });
             resolvedConfig = {
               ...INITIAL_CONFIG,
               ...parsed.config,
               data_blocks: mergedBlocks,
               adjust_api: { 
                 ...INITIAL_CONFIG.adjust_api, 
                 ...(parsed.config.adjust_api || {}) 
               },
               feishu_config: {
                 ...INITIAL_CONFIG.feishu_config,
                 ...(parsed.config.feishu_config || {}),
                 app_mappings: mergeFeishuAppMappings(parsed.config.feishu_config?.app_mappings || []),
               }
             };
           }
         }
       } catch(e) {}

       return {
          config: resolvedConfig,
          ui: {
             activeBlockId: params.get('view') === 'country' ? 'block_country_revenue' : (params.get('block') || DEFAULT_BLOCKS[0].id),
             viewMode: (params.get('view') as any) || 'rankings',
             startDate: params.get('start') || DEFAULT_FETCH_START_DATE,
             endDate: params.get('end') || getDateString(1),
             filters: {
                appName: params.get('app') || '',
                storeType: params.get('store') || '',
                network: params.get('network') || '',
                adSources: params.get('sources')?.split(',').filter(Boolean) || []
             }
          }
       };
    }

    // 2. Try to load from localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PersistedState;
        const mergedBlocks = parsed.config?.data_blocks ? [...parsed.config.data_blocks] : [...INITIAL_CONFIG.data_blocks];
        INITIAL_CONFIG.data_blocks.forEach(defaultBlock => {
          if (!mergedBlocks.some((b: any) => b.id === defaultBlock.id)) {
            mergedBlocks.push(defaultBlock);
          }
        });
        return {
          config: {
            ...INITIAL_CONFIG,
            ...parsed.config,
            data_blocks: mergedBlocks,
            adjust_api: { 
              ...INITIAL_CONFIG.adjust_api, 
              ...(parsed.config?.adjust_api || {}),
            },
            feishu_config: {
              ...INITIAL_CONFIG.feishu_config,
              ...(parsed.config?.feishu_config || {}),
              app_mappings: mergeFeishuAppMappings(parsed.config?.feishu_config?.app_mappings || []),
            },
          },
          ui: {
            activeBlockId: parsed.ui?.viewMode === 'country' ? 'block_country_revenue' : (parsed.ui?.activeBlockId || DEFAULT_BLOCKS[0].id),
            viewMode: parsed.ui?.viewMode || 'rankings',
            startDate: parsed.ui?.startDate || DEFAULT_FETCH_START_DATE,
            endDate: parsed.ui?.endDate || getDateString(1),
            filters: {
              appName: '', storeType: '', network: '', adSources: [],
              ...(parsed.ui?.filters || {})
            }
          }
        };
      }
    } catch (e) {}
    
    // 3. Default fallback
    return {
      config: INITIAL_CONFIG,
      ui: {
        activeBlockId: DEFAULT_BLOCKS[0].id,
        viewMode: 'rankings',
        startDate: DEFAULT_FETCH_START_DATE,
        endDate: getDateString(1),
        filters: { appName: '', storeType: '', network: '', adSources: [] }
      }
    };
  });

  const { config, ui } = fullState;

  // 持久化 UI 状态，但不包含原始数据
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fullState));
  }, [fullState]);

  const [rawData, setRawData] = useState<ProcessedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  // isDataFromCache now implies data loaded fast (from service cache), we can infer it or just toggle it manually
  // For simplicity, we'll assume if loading was super fast (<500ms) it was cached, or we can update service to return a flag.
  // Here we just default to false and let the loading indicator handle it. 
  // But to keep the UI 'Cached' badge, we can update this logic if needed. 
  // For now, let's keep it simple.
  const [isDataFromCache, setIsDataFromCache] = useState(false); 
  const [error, setError] = useState<string | null>(null);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [feishuSyncModalOpen, setFeishuSyncModalOpen] = useState(false);
  
  // Track last loaded cache key to prevent redundant effects
  const lastLoadedParams = useRef<string | null>(null);
  
  const activeBlock = useMemo(() => 
    config.data_blocks.find(b => b.id === ui.activeBlockId) || config.data_blocks[0]
  , [config.data_blocks, ui.activeBlockId]);

  const loadData = useCallback(async (forceRefresh: boolean = false) => {
    if (!activeBlock) return;
    const token = config.adjust_api.user_token;
    if (!token) {
      if (forceRefresh) setConfigModalOpen(true);
      return;
    }

    // Determine current request signature
    const currentParams = JSON.stringify({
        blockId: ui.activeBlockId,
        start: ui.startDate,
        end: ui.endDate,
        sources: ui.filters.adSources.sort(),
        token: token.substring(0, 5),
        proxy: config.adjust_api.use_proxy
    });

    // OPTIMIZATION: If params haven't changed and we aren't forcing a refresh, skip.
    if (!forceRefresh && currentParams === lastLoadedParams.current && rawData.length > 0) {
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingProgress(0);
    setLoadingMessage("正在连接 Adjust API...");

    const startTime = Date.now();

    try {
      // Pass forceRefresh to the service
      const result = await fetchAndProcessData(
        config, 
        activeBlock, 
        ui.startDate, 
        ui.endDate, 
        ui.filters.adSources,
        (pct, msg) => {
            setLoadingProgress(pct);
            setLoadingMessage(msg);
        },
        forceRefresh
      );
      
      setRawData(result);
      lastLoadedParams.current = currentParams;
      
      // Simple heuristic: if data loaded very fast, it was likely cached
      setIsDataFromCache(Date.now() - startTime < 1000); 

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingProgress(100);
    }
  }, [
    ui.activeBlockId, 
    activeBlock, 
    ui.startDate, 
    ui.endDate, 
    ui.filters.adSources, 
    config.adjust_api.user_token, 
    config.adjust_api.use_proxy,
    config,
    rawData.length
  ]);

  useEffect(() => { 
    loadData(false); 
  }, [loadData]);

  const filterOptions = useMemo(() => {
    return {
      apps: Array.from(new Set(rawData.map(r => r.appName || ''))).filter(Boolean).sort(),
      stores: Array.from(new Set(rawData.map(r => r.storeType || ''))).filter(Boolean).sort(),
      networks: Array.from(new Set(rawData.map(r => r.network || ''))).filter(Boolean).sort(),
    };
  }, [rawData]);

  const filteredData = useMemo(() => {
    return rawData.filter(row => {
      const appMatch = !ui.filters.appName || row.appName === ui.filters.appName;
      const storeMatch = !ui.filters.storeType || row.storeType === ui.filters.storeType;
      const networkMatch = !ui.filters.network || row.network === ui.filters.network;
      return appMatch && storeMatch && networkMatch;
    });
  }, [rawData, ui.filters.appName, ui.filters.storeType, ui.filters.network]);

  useEffect(() => {
    // Sync initial config to server for auto-sync job
    fetch('/api/sync/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullState.config)
    }).catch(e => console.error("Failed to sync initial config to server", e));
  }, []);

  const updateUI = (updates: Partial<PersistedState['ui']>) => {
    setFullState(prev => ({
      ...prev,
      ui: { ...prev.ui, ...updates }
    }));
  };

  const updateFilters = (updates: Partial<PersistedState['ui']['filters']>) => {
    setFullState(prev => ({
      ...prev,
      ui: { ...prev.ui, filters: { ...prev.ui.filters, ...updates } }
    }));
  };

  const updateConfig = (newConfig: AppConfig) => {
    setFullState(prev => ({ ...prev, config: newConfig }));
    // Also save to server for auto-sync
    fetch('/api/sync/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    }).catch(e => console.error("Failed to save config to server", e));
  };

  const resetAll = () => {
    if (confirm("确定要重置应用吗？配置将恢复为默认值，且所有本地缓存将被清除。")) {
      localStorage.removeItem(STORAGE_KEY);
      // Also clear sessionStorage if any legacy keys exist
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('adj_cache_')) sessionStorage.removeItem(k);
      });
      window.history.pushState({}, document.title, window.location.pathname);
      window.location.reload();
    }
  };

  const feishuConfigured = !!(config.feishu_config?.app_id && config.feishu_config?.spreadsheet_token);

  // Sidebar Navigation Items
  const navItems = [
    // { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard }, // 暂时隐藏
    { id: 'rankings', label: '排行榜', icon: Trophy },
    { id: 'revenue', label: '收入趋势', icon: TrendingUp },
    { id: 'country', label: '国家收入', icon: Globe },
    { id: 'comparison', label: '对比分析', icon: GitCompare },
    { id: 'detail', label: '收入明细', icon: TableIcon },
    { id: 'cost', label: '消耗明细', icon: DollarSign },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 z-50">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
           <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-100">
             <Layers className="w-5 h-5 text-white" />
           </div>
           <div>
             <h1 className="text-sm font-black text-slate-800 tracking-tight leading-none">ADJUST</h1>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dashboard</span>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
           {navItems.map(item => (
             <button
               key={item.id}
               onClick={() => {
                 const updates: any = { viewMode: item.id };
                 if (item.id === 'country') {
                   updates.activeBlockId = 'block_country_revenue';
                 } else if (ui.activeBlockId === 'block_country_revenue') {
                   updates.activeBlockId = 'block_basic';
                 }
                 updateUI(updates);
               }}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200 group relative ${
                 ui.viewMode === item.id 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
               }`}
             >
               <item.icon className={`w-5 h-5 transition-colors ${ui.viewMode === item.id ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
               {item.label}
               {ui.viewMode === item.id && (
                 <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-blue-600 rounded-r-full"></div>
               )}
             </button>
           ))}
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2">
            <button 
              onClick={() => setFeishuSyncModalOpen(true)} 
              disabled={!feishuConfigured} 
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${feishuConfigured ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-50 text-slate-400 cursor-not-allowed'}`}
            >
              <MessageSquare className="w-4 h-4" />
              同步飞书
              {!feishuConfigured && <span className="ml-auto text-[9px] bg-slate-200 px-1.5 py-0.5 rounded">未配置</span>}
            </button>
            <button 
              onClick={() => setConfigModalOpen(true)} 
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              <Settings className="w-4 h-4" />
              系统设置
            </button>
            <div className="pt-2 flex items-center justify-between px-4">
               <button onClick={resetAll} className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
                 <XCircle className="w-3 h-3" /> 重置
               </button>
               <span className="text-[10px] text-slate-300 font-mono">v2.3.0</span>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Bar (Filters & Tools) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-40 relative">
           
           <div className="flex items-center gap-4 flex-1">
              {/* Global Filters Group */}
              <div className="flex items-center gap-3 pr-4 border-r border-slate-100">
                  <div className="relative group">
                     <Layers className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
                     <select 
                       className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none min-w-[140px] cursor-pointer hover:border-blue-300 transition-all"
                       value={ui.filters.appName}
                       onChange={(e) => updateFilters({ appName: e.target.value })}
                     >
                       <option value="">所有应用 ({filterOptions.apps.length})</option>
                       {filterOptions.apps.map(app => <option key={app} value={app}>{app}</option>)}
                     </select>
                     <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  <AdSourceFilter 
                    selectedSources={ui.filters.adSources}
                    onChange={(sources) => updateFilters({ adSources: sources })}
                  />

                  <div className="relative group hidden xl:block">
                     <Smartphone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
                     <select 
                       className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none min-w-[120px] cursor-pointer hover:border-blue-300 transition-all"
                       value={ui.filters.storeType}
                       onChange={(e) => updateFilters({ storeType: e.target.value })}
                     >
                       <option value="">所有商店</option>
                       {filterOptions.stores.map(store => (
                          <option key={store} value={store}>
                            {store === 'ios' ? ' iOS' : store === 'android' ? '🤖 Android' : store}
                          </option>
                       ))}
                     </select>
                     <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  
                  {(ui.filters.appName || ui.filters.storeType || ui.filters.network || ui.filters.adSources.length > 0) && (
                    <button 
                      onClick={() => updateFilters({ appName: '', storeType: '', network: '', adSources: [] })}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="重置筛选"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
              </div>
              
              {/* API Status Indicator */}
              <div className="flex items-center gap-3">
                 {loading ? (
                   <span className="flex items-center gap-1.5 text-[10px] text-blue-600 font-bold uppercase tracking-tight animate-pulse">
                     <Loader2 className="w-3 h-3 animate-spin" /> {loadingMessage || 'Syncing...'}
                   </span>
                 ) : (
                   <div className="flex items-center gap-2">
                     <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                     </span>
                     <span className="text-[10px] text-slate-400 font-bold tracking-tight">API READY</span>
                     {isDataFromCache && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 font-bold flex items-center gap-1">
                          <History className="w-3 h-3" /> Cached
                        </span>
                     )}
                   </div>
                 )}
              </div>
           </div>

           <div className="flex items-center gap-3">
              <DateRangePicker 
                startDate={ui.startDate} 
                endDate={ui.endDate} 
                onStartDateChange={(d) => updateUI({ startDate: d })} 
                onEndDateChange={(d) => updateUI({ endDate: d })} 
              />
              <div className="h-8 w-px bg-slate-100 mx-1"></div>
              <button 
                onClick={() => loadData(true)} 
                title="Refresh Data"
                className={`p-2 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm active:scale-95 ${loading ? 'animate-spin text-blue-500 border-blue-200' : ''}`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
           </div>
        </header>
        
        {/* Loading Bar */}
        {loading && (
          <div className="absolute top-16 left-0 w-full h-[2px] bg-slate-100 overflow-hidden z-50">
             <div 
               className="h-full bg-blue-600 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(37,99,235,0.6)]" 
               style={{ width: `${loadingProgress}%` }}
             ></div>
          </div>
        )}

        {/* Scrollable View Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-6 pb-12">
            
            {loading && rawData.length === 0 && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-[1px] transition-all duration-500">
                <div className="relative w-24 h-24 mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-200" />
                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="6" strokeDasharray={276} strokeDashoffset={276 - (276 * loadingProgress) / 100} strokeLinecap="round" fill="transparent" className="text-blue-600 transition-all duration-300" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-black text-slate-800">{loadingProgress}%</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <p className="text-slate-600 text-sm font-bold animate-pulse">{loadingMessage}</p>
                   <p className="text-slate-400 text-xs">正在从 Adjust 获取实时数据...</p>
                </div>
              </div>
            )}

            {ui.viewMode === 'dashboard' && (
              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-2">
                <div className="flex flex-wrap gap-2 items-center">
                    <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex gap-1">
                      {config.data_blocks.filter(b => !b.id.endsWith('_80') && !b.id.includes('summary') && !b.id.includes('country') && !b.id.includes('spend')).map(block => (
                        <button
                          key={block.id}
                          onClick={() => updateUI({ activeBlockId: block.id })}
                          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2
                            ${ui.activeBlockId === block.id ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                        >
                          {getBlockIcon(block.id)}
                          {block.name.replace(/数据|报表/g, '')}
                        </button>
                      ))}
                    </div>
                    
                    <div className="h-8 w-px bg-slate-200 mx-2"></div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">More Views</span>
                      <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm flex gap-1">
                        {config.data_blocks.filter(b => b.id.includes('summary')).map(block => (
                          <button
                            key={block.id}
                            onClick={() => updateUI({ activeBlockId: block.id })}
                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2
                              ${ui.activeBlockId === block.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}
                          >
                            {getBlockIcon(block.id)}
                            {block.name.replace(/数据|报表/g, '')}
                          </button>
                        ))}
                      </div>
                    </div>
                </div>
                
                <div className="text-[11px] font-bold text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-200 flex items-center gap-2 shadow-sm">
                   Matches: <span className="font-mono text-blue-600 text-sm">{filteredData.length}</span> / {rawData.length}
                </div>
              </div>
            )}

            {loading && rawData.length === 0 ? (
              <LoadingSkeleton viewMode={ui.viewMode === 'revenue' || ui.viewMode === 'detail' || ui.viewMode === 'cost' || ui.viewMode === 'country' ? 'rankings' : ui.viewMode} />
            ) : error ? (
              <div className="max-w-2xl mx-auto py-12">
                 <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-xl space-y-6 text-center">
                    <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto"><XCircle className="w-10 h-10 text-red-500" /></div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">数据同步失败</h3>
                      <p className="text-slate-500 text-sm mt-2 font-medium">{error}</p>
                    </div>
                    <div className="flex gap-3 justify-center pt-2">
                      <button onClick={() => loadData(true)} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-95 transition-all">重试</button>
                      <button onClick={() => setConfigModalOpen(true)} className="px-6 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all">检查配置</button>
                    </div>
                 </div>
              </div>
            ) : ui.viewMode === 'revenue' ? (
              <RevenueTrendView data={filteredData} />
            ) : ui.viewMode === 'country' ? (
              <CountryRevenueView data={filteredData} />
            ) : ui.viewMode === 'rankings' ? (
              <RankingView data={filteredData} dateRangeLabel={`${ui.startDate} - ${ui.endDate}`} />
            ) : ui.viewMode === 'comparison' ? (
              <ComparisonView data={filteredData} />
            ) : ui.viewMode === 'detail' ? (
              <DetailedRevenueView 
                 data={filteredData} 
                 dateRange={{ start: ui.startDate, end: ui.endDate }}
                 filters={ui.filters}
              />
            ) : ui.viewMode === 'cost' ? (
              <CostAnalysisView 
                 data={filteredData} 
                 dateRange={{ start: ui.startDate, end: ui.endDate }}
                 filters={ui.filters}
              />
            ) : (
              <div className="space-y-6 animate-in fade-in duration-500">
                <DataTable key={ui.activeBlockId} data={filteredData} activeBlockId={ui.activeBlockId} />
              </div>
            )}
          </div>
        </div>
      </main>

      <ConfigModal isOpen={configModalOpen} onClose={() => setConfigModalOpen(false)} config={config} onSave={updateConfig} />
      <FeishuSyncModal isOpen={feishuSyncModalOpen} onClose={() => setFeishuSyncModalOpen(false)} config={config} onConfigUpdate={updateConfig} currentData={filteredData} />
    </div>
  );
}

export default App;
