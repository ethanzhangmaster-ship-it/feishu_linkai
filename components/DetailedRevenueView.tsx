
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ProcessedRow } from '../types';
import { 
  Table, 
  Download, 
  Calendar, 
  Search, 
  Filter,
  CreditCard,
  Wallet,
  Share2,
  ChevronDown,
  X,
  Layers,
  CalendarDays,
  Clock,
  DollarSign,
  TrendingUp,
  Activity,
  Coins,
  Scale,
  PiggyBank,
  Smartphone,
  Globe,
  Box,
  Check
} from 'lucide-react';
import { exportToCsv } from '../utils/csvExport';

interface DetailedRevenueViewProps {
  data: ProcessedRow[];
  dateRange: { start: string; end: string };
  filters: { appName: string; storeType: string; network: string; adSources: string[] };
}

const STORAGE_KEY = 'adjust_detailed_view_state';

// Robust Date Parsing Helper (UTC based)
const parseDate = (str: string) => {
  if (!str) return null;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
};

// Helper: Get ISO Week (YYYY-Wxx)
const getISOWeek = (dateStr: string) => {
  const d = parseDate(dateStr);
  if (!d) return dateStr; // Fallback if parsing fails
  
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

// Helper: Get Month (YYYY-MM)
const getMonthKey = (dateStr: string) => {
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

const getStoreBadge = (store: string) => {
  const s = (store || '').toLowerCase();
  if (s.includes('google') || s.includes('android')) return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200 uppercase tracking-tighter">Android</span>;
  if (s.includes('itunes') || s.includes('ios') || s.includes('app_store')) return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 uppercase tracking-tighter">iOS</span>;
  if (s.includes('amazon')) return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-yellow-50 text-yellow-700 rounded border border-yellow-200 uppercase tracking-tighter">Amazon</span>;
  return <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-200">{store || '-'}</span>;
};

// Commission Rate Helper
// Updated: Android 15% cut (0.85), Amazon 20% cut (0.8), iOS/Other 30% cut (0.7)
const getNetIapRate = (store: string) => {
  const s = (store || '').toLowerCase();
  if (s.includes('amazon')) return 0.8; // Amazon 20%
  // Android now uses 15% cut (Google Play Small Business likely) -> 0.85 factor
  if (s.includes('google') || s.includes('android') || s.includes('play')) return 0.85; 
  if (s === 'ios' || s.includes('apple') || s.includes('itunes') || s.includes('app_store')) return 0.7; 
  
  // Default to 0.7 (30% cut) for unknown stores
  return 0.7; 
};

// Available dimensions for grouping
const DIMENSIONS = [
  { key: 'appName', label: '应用名称', icon: Layers },
  { key: 'storeType', label: '商店', icon: Smartphone },
  { key: 'network', label: '合作伙伴', icon: Share2 },
  { key: 'country', label: '国家/地区', icon: Globe },
] as const;

type DimensionKey = typeof DIMENSIONS[number]['key'];

const DetailedRevenueView: React.FC<DetailedRevenueViewProps> = ({ data, dateRange, filters }) => {
  // Initialize state from sessionStorage -> URL -> Default
  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).searchTerm || '';
    } catch(e) {}
    const p = new URLSearchParams(window.location.search);
    return p.get('detailSearch') || '';
  });
  
  const [selectedNetwork, setSelectedNetwork] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).selectedNetwork || '';
    } catch(e) {}
    const p = new URLSearchParams(window.location.search);
    return p.get('detailNetwork') || '';
  });

  const [selectedStore, setSelectedStore] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).selectedStore || '';
    } catch(e) {}
    const p = new URLSearchParams(window.location.search);
    return p.get('detailStore') || '';
  });

  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const g = JSON.parse(saved).groupBy;
        if (g === 'week' || g === 'month' || g === 'day') return g;
      }
    } catch(e) {}
    const p = new URLSearchParams(window.location.search);
    const g = p.get('groupBy');
    return (g === 'week' || g === 'month') ? g : 'day';
  });

  // New State: Active Dimensions for Grouping
  const [activeDimensions, setActiveDimensions] = useState<DimensionKey[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved).activeDimensions;
        if (Array.isArray(d)) return d;
      }
    } catch(e) {}
    return ['appName', 'storeType']; // Default grouping
  });

  const [isDimDropdownOpen, setIsDimDropdownOpen] = useState(false);
  const dimDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dimDropdownRef.current && !dimDropdownRef.current.contains(e.target as Node)) {
        setIsDimDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Persist state changes
  useEffect(() => {
    const state = { searchTerm, selectedNetwork, selectedStore, groupBy, activeDimensions };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [searchTerm, selectedNetwork, selectedStore, groupBy, activeDimensions]);

  // Toggle dimension
  const toggleDimension = (key: DimensionKey) => {
    setActiveDimensions(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        const newSet = new Set([...prev, key]);
        const ordered: DimensionKey[] = [];
        if (newSet.has('appName')) ordered.push('appName');
        if (newSet.has('storeType')) ordered.push('storeType');
        if (newSet.has('network')) ordered.push('network');
        if (newSet.has('country')) ordered.push('country');
        return ordered;
      }
    });
  };

  // Extract unique network options for the local filter
  const networkOptions = useMemo(() => {
    return Array.from(new Set(data.map(r => r.network))).filter(Boolean).sort();
  }, [data]);

  // Extract unique store options
  const storeOptions = useMemo(() => {
    return Array.from(new Set(data.map(r => r.storeType))).filter(Boolean).sort();
  }, [data]);

  const tableData = useMemo(() => {
    // 1. Filter raw data first
    let rows = data;
    if (selectedNetwork) {
      rows = rows.filter(r => r.network === selectedNetwork);
    }
    if (selectedStore) {
      rows = rows.filter(r => r.storeType === selectedStore);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      rows = rows.filter(r => (r.appName || '').toLowerCase().includes(lower));
    }

    // 2. Aggregate by Period + Active Dimensions
    const aggMap = new Map<string, ProcessedRow & { cost: number, netIapRevenue: number, netTotalRevenue: number, profit: number, netProfit: number }>();
    
    rows.forEach(row => {
        let periodKey = row.dateStr;
        if (groupBy === 'week') periodKey = getISOWeek(row.dateStr);
        else if (groupBy === 'month') periodKey = getMonthKey(row.dateStr);

        // Build key based on active dimensions
        const dimValues = activeDimensions.map(d => row[d] || 'Unknown');
        const key = `${periodKey}|${dimValues.join('|')}`;
        
        if (!aggMap.has(key)) {
            aggMap.set(key, { 
              ...row, // Copy properties
              dateStr: periodKey,
              // Set grouped properties
              appName: activeDimensions.includes('appName') ? row.appName : undefined,
              storeType: activeDimensions.includes('storeType') ? row.storeType : 'All Stores',
              network: activeDimensions.includes('network') ? row.network : 'All Networks',
              country: activeDimensions.includes('country') ? (row.country || 'Global') : 'Global',
              // Initialize sums
              iapRevenue: 0, 
              adRevenue: 0, 
              totalRevenue: 0,
              cost: 0,
              netIapRevenue: 0,
              netTotalRevenue: 0,
              profit: 0,
              netProfit: 0,
              daus: 0,
              sessions: 0
            });
        }
        
        const entry = aggMap.get(key)!;
        entry.iapRevenue += (row.iapRevenue || 0);
        entry.adRevenue += (row.adRevenue || 0);
        entry.totalRevenue += (row.totalRevenue || 0);
        entry.cost += (row.cost || 0);
        entry.daus = (entry.daus || 0) + (row.daus || 0);
        entry.sessions = (entry.sessions || 0) + (row.sessions || 0);
        
        // Accurate Net Calculation: Calculate based on individual row's store type
        // Use row.storeType to get precise rate for each record before aggregation
        const rate = getNetIapRate(row.storeType);
        const netIap = (row.iapRevenue || 0) * rate;
        
        entry.netIapRevenue += netIap;
        // Net Total = Net IAP + Ad Revenue
        entry.netTotalRevenue += (netIap + (row.adRevenue || 0));
    });

    // 3. Calculate final profit for each aggregated row
    const aggregatedRows = Array.from(aggMap.values()).map(row => {
      const profit = row.totalRevenue - row.cost;
      // Logic: If Profit is negative, Net Profit equals Profit (Gross Loss).
      // If Profit is positive, Net Profit = Net Total Revenue - Cost.
      const standardNetProfit = row.netTotalRevenue - row.cost;
      const netProfit = profit < 0 ? profit : standardNetProfit;

      return {
        ...row,
        profit,
        netProfit
      };
    });

    // 4. Sort
    return aggregatedRows.sort((a, b) => {
       if (b.dateStr !== a.dateStr) return b.dateStr.localeCompare(a.dateStr);
       // Sort by revenue desc within same date
       return b.totalRevenue - a.totalRevenue;
    });
  }, [data, searchTerm, selectedNetwork, selectedStore, groupBy, activeDimensions]);

  const stats = useMemo(() => {
    const totalRev = tableData.reduce((acc, r) => acc + r.totalRevenue, 0);
    const totalNetRev = tableData.reduce((acc, r) => acc + r.netTotalRevenue, 0);
    const totalCost = tableData.reduce((acc, r) => acc + r.cost, 0);
    const totalProfit = totalRev - totalCost;
    // Sum of row-level net profits to maintain consistency with table logic
    const totalNetProfit = tableData.reduce((acc, r) => acc + r.netProfit, 0);

    return {
        total: totalRev,
        cost: totalCost,
        iap: tableData.reduce((acc, r) => acc + r.iapRevenue, 0),
        netIap: tableData.reduce((acc, r) => acc + r.netIapRevenue, 0),
        ad: tableData.reduce((acc, r) => acc + r.adRevenue, 0),
        netTotal: totalNetRev,
        roi: totalCost > 0 ? (totalRev / totalCost) : 0,
        netRoi: totalCost > 0 ? (totalNetRev / totalCost) : 0,
        profit: totalProfit,
        netProfit: totalNetProfit,
        daus: tableData.reduce((acc, r) => acc + (r.daus || 0), 0),
        sessions: tableData.reduce((acc, r) => acc + (r.sessions || 0), 0),
        count: tableData.length
    }
  }, [tableData]);

  const handleExport = () => {
    if (!tableData.length) return;
    
    // Dynamic headers based on active dimensions
    const headers = ["日期/周期"];
    if (activeDimensions.includes('appName')) headers.push("应用名称");
    if (activeDimensions.includes('storeType')) headers.push("商店");
    if (activeDimensions.includes('network')) headers.push("合作伙伴");
    if (activeDimensions.includes('country')) headers.push("国家/地区");

    headers.push(
      "消耗", "内购收入(Gross)", "净内购(Net)", "广告收入", 
      "总收入(Gross)", "净总收入(Net Total)", 
      "DAU", "Sessions",
      "ROI (Gross)", "净 ROI (Net)", 
      "利润 (Gross)", "净利润 (Net)"
    );

    const rows = tableData.map(r => {
      const rowData = [r.dateStr];
      if (activeDimensions.includes('appName')) rowData.push(r.appName || '');
      if (activeDimensions.includes('storeType')) rowData.push(r.storeType === 'All Stores' ? 'All' : r.storeType);
      if (activeDimensions.includes('network')) rowData.push(r.network === 'All Networks' ? 'All' : r.network);
      if (activeDimensions.includes('country')) rowData.push(r.country || 'Global');
      
      rowData.push(
        r.cost.toFixed(2),
        r.iapRevenue.toFixed(2),
        r.netIapRevenue.toFixed(2),
        r.adRevenue.toFixed(2),
        r.totalRevenue.toFixed(2),
        r.netTotalRevenue.toFixed(2),
        r.daus || 0,
        r.sessions || 0,
        (r.cost > 0 ? (r.totalRevenue / r.cost * 100).toFixed(2) + '%' : '0%'),
        (r.cost > 0 ? (r.netTotalRevenue / r.cost * 100).toFixed(2) + '%' : '0%'),
        r.profit.toFixed(2),
        r.netProfit.toFixed(2)
      );
      return rowData;
    });

    exportToCsv(headers, rows, `revenue_breakdown_${groupBy}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const renderRoi = (revenue: number, cost: number) => {
    if (cost === 0) return <span className="text-slate-300">-</span>;
    const roi = revenue / cost;
    const isProfitable = roi >= 1;
    return (
      <span className={`font-mono font-bold ${isProfitable ? 'text-emerald-600' : 'text-orange-500'}`}>
        {(roi * 100).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header & Stats - Expanded to 8 columns for DAU and Sessions */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3"/> 总消耗 (Spend)</span>
             <div className="text-xl font-bold text-red-500 font-mono">${stats.cost.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> 总收入 (Gross)</span>
             <div className="flex items-baseline gap-2">
               <div className="text-xl font-black text-emerald-600 font-mono">${stats.total.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
               <div className="text-[10px] text-slate-400 font-mono">Net: ${stats.netTotal.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
             </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><PiggyBank className="w-3 h-3"/> 总利润 (Gross)</span>
             <div className="flex items-baseline gap-2">
               <div className={`text-xl font-black font-mono ${stats.profit >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>
                  {stats.profit < 0 ? '-' : ''}${Math.abs(stats.profit).toLocaleString(undefined, {maximumFractionDigits: 0})}
               </div>
               <div className="text-[10px] text-slate-400 font-mono">Net: ${stats.netProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
             </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> ROI (Gross)</span>
             <div className="flex items-baseline gap-2">
                <div className={`text-xl font-bold font-mono ${stats.roi >= 1 ? 'text-emerald-600' : 'text-orange-500'}`}>
                    {(stats.roi * 100).toFixed(0)}%
                </div>
                <div className={`text-[10px] font-mono ${stats.netRoi >= 1 ? 'text-emerald-600' : 'text-slate-400'}`}>
                    Net: {(stats.netRoi * 100).toFixed(0)}%
                </div>
             </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">内购 (IAP)</span>
             <div className="flex items-baseline gap-2">
                <div className="text-lg font-bold text-blue-600 font-mono">${stats.iap.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                <div className="text-[10px] text-slate-400 font-mono">Net: ${stats.netIap.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
             </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">广告 (AD)</span>
             <div className="text-lg font-bold text-purple-600 font-mono">${stats.ad.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-orange-500">DAU</span>
             <div className="text-lg font-bold text-orange-500 font-mono">{stats.daus.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 text-amber-500">Sessions</span>
             <div className="text-lg font-bold text-amber-500 font-mono">{stats.sessions.toLocaleString()}</div>
          </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
           <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600">
              <Table className="w-5 h-5" />
           </div>
           <div>
              <h2 className="text-lg font-bold text-slate-800">收入与消耗明细表 (含多维分析)</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Layers className="w-3 h-3" />
                <span>当前聚合: 日期 + {activeDimensions.length > 0 ? activeDimensions.map(d => DIMENSIONS.find(x => x.key === d)?.label).join(' + ') : '无'}</span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-end flex-wrap">
           
           {/* Date Aggregation Toggle */}
           <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200 mr-2">
              <button 
                onClick={() => setGroupBy('day')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${groupBy === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Calendar className="w-3 h-3" /> 按日
              </button>
              <button 
                onClick={() => setGroupBy('week')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${groupBy === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <CalendarDays className="w-3 h-3" /> 按周
              </button>
              <button 
                onClick={() => setGroupBy('month')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${groupBy === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Clock className="w-3 h-3" /> 按月
              </button>
           </div>

           {/* Dimensional Grouping Dropdown */}
           <div className="relative group" ref={dimDropdownRef}>
              <button
                onClick={() => setIsDimDropdownOpen(!isDimDropdownOpen)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm ${activeDimensions.length > 2 ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}
              >
                <Box className="w-4 h-4" />
                聚合维度 ({activeDimensions.length})
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDimDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isDimDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in duration-200">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">选择分组维度</div>
                   <div className="space-y-1">
                      {DIMENSIONS.map(dim => (
                         <button
                           key={dim.key}
                           onClick={() => toggleDimension(dim.key)}
                           className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                         >
                           <div className="flex items-center gap-2">
                              <dim.icon className={`w-4 h-4 ${activeDimensions.includes(dim.key) ? 'text-purple-600' : 'text-slate-400'}`} />
                              <span className={`text-xs font-bold ${activeDimensions.includes(dim.key) ? 'text-purple-700' : 'text-slate-600'}`}>{dim.label}</span>
                           </div>
                           {activeDimensions.includes(dim.key) && <Check className="w-3.5 h-3.5 text-purple-600" />}
                         </button>
                      ))}
                   </div>
                </div>
              )}
           </div>

           {/* Store Filter */}
           <div className="relative group">
              <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
              <select
                className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none min-w-[120px] cursor-pointer hover:border-blue-300 transition-all"
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
              >
                <option value="">所有商店 (筛选)</option>
                {storeOptions.map(store => (
                  <option key={store} value={store}>
                     {store === 'ios' ? 'iOS' : store === 'android' ? 'Android' : store}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
           </div>

           {/* Network Filter */}
           <div className="relative group">
              <Share2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
              <select
                className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none min-w-[140px] cursor-pointer hover:border-blue-300 transition-all"
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
              >
                <option value="">所有合作伙伴 (筛选)</option>
                {networkOptions.map(net => (
                  <option key={net} value={net}>{net}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
           </div>

           {/* Search Input */}
           <div className="relative group max-w-xs w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="搜索应用..." 
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>

           {/* Clear Filters */}
           {(searchTerm || selectedNetwork || selectedStore) && (
              <button 
                onClick={() => { setSearchTerm(''); setSelectedNetwork(''); setSelectedStore(''); }}
                className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
              </button>
           )}

           <button 
             onClick={handleExport}
             className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm active:scale-95 whitespace-nowrap"
           >
             <Download className="w-3.5 h-3.5" /> 导出
           </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full text-xs text-left">
             <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
               <tr>
                 <th className="px-5 py-4 font-black uppercase tracking-wider w-[120px]">
                   {groupBy === 'week' ? '周期 (周)' : groupBy === 'month' ? '周期 (月)' : '日期'}
                 </th>
                 
                 {/* Dynamic Headers based on active dimensions */}
                 {activeDimensions.includes('appName') && (
                    <th className="px-5 py-4 font-black uppercase tracking-wider">应用名称</th>
                 )}
                 {activeDimensions.includes('storeType') && (
                    <th className="px-5 py-4 font-black uppercase tracking-wider w-[100px]">商店</th>
                 )}
                 {activeDimensions.includes('network') && (
                    <th className="px-5 py-4 font-black uppercase tracking-wider">合作伙伴</th>
                 )}
                 {activeDimensions.includes('country') && (
                    <th className="px-5 py-4 font-black uppercase tracking-wider">国家/地区</th>
                 )}

                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-red-600">
                    <div className="flex items-center justify-end gap-1"><DollarSign className="w-3 h-3"/> 消耗 (Spend)</div>
                 </th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-blue-600">
                    <div className="flex items-center justify-end gap-1"><CreditCard className="w-3 h-3"/> 内购 (Gross)</div>
                 </th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-sky-600">
                    <div className="flex items-center justify-end gap-1"><Coins className="w-3 h-3"/> 净内购 (Net)</div>
                 </th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-purple-600">
                    <div className="flex items-center justify-end gap-1"><Wallet className="w-3 h-3"/> 广告 (AD)</div>
                 </th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-emerald-600">总收入 (Gross)</th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-teal-600">
                    <div className="flex items-center justify-end gap-1"><Scale className="w-3 h-3"/> 净总收入 (Net)</div>
                 </th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-orange-500">DAU</th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-amber-500">Sessions</th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right">ROI (Gross)</th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right">净 ROI (Net)</th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-indigo-700">利润 (Gross)</th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-slate-600">净利润 (Net)</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {tableData.length === 0 ? (
                 <tr>
                    <td colSpan={13 + activeDimensions.length} className="px-5 py-12 text-center text-slate-400 italic">
                       <div className="flex flex-col items-center gap-2">
                          <Filter className="w-8 h-8 text-slate-200" />
                          <span>没有符合条件的数据</span>
                       </div>
                    </td>
                 </tr>
               ) : (
                 tableData.slice(0, 1000).map((row, idx) => {
                   const cpi = row.installs > 0 ? row.cost / row.installs : 0;
                   const paidCpi = row.paidInstalls > 0 ? row.cost / row.paidInstalls : 0;
                   const roi = row.cost > 0 ? row.totalRevenue / row.cost : 0;
                   
                   return (
                   <tr key={`${row.id}_${idx}`} className="hover:bg-slate-50 transition-colors group">
                     <td className="px-5 py-3 font-mono text-slate-600 font-medium flex items-center gap-2">
                        {groupBy === 'week' ? <CalendarDays className="w-3 h-3 text-slate-300" /> : groupBy === 'month' ? <Clock className="w-3 h-3 text-slate-300" /> : <Calendar className="w-3 h-3 text-slate-300" />}
                        {row.dateStr}
                     </td>
                     
                     {activeDimensions.includes('appName') && <td className="px-5 py-3 font-bold text-slate-700 truncate max-w-[150px]">{row.appName}</td>}
                     {activeDimensions.includes('storeType') && <td className="px-5 py-3">{getStoreBadge(row.storeType)}</td>}
                     {activeDimensions.includes('network') && <td className="px-5 py-3 font-medium text-slate-600 text-[11px] truncate max-w-[120px]">{row.network}</td>}
                     {activeDimensions.includes('country') && <td className="px-5 py-3 font-medium text-slate-600 text-[11px]">{row.country}</td>}

                     <td className="px-5 py-3 text-right font-mono text-red-500 font-bold">${row.cost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                     <td className="px-5 py-3 text-right font-mono text-blue-600 bg-blue-50/10">${row.iapRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                     <td className="px-5 py-3 text-right font-mono text-sky-600 font-medium bg-sky-50/10">${row.netIapRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                     <td className="px-5 py-3 text-right font-mono text-purple-600 bg-purple-50/10">${row.adRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                     <td className="px-5 py-3 text-right font-mono font-bold text-emerald-600 bg-emerald-50/20">${row.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                     <td className="px-5 py-3 text-right font-mono font-bold text-teal-600 bg-teal-50/20">${row.netTotalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                     <td className="px-5 py-3 text-right font-mono text-orange-500">{(row.daus || 0).toLocaleString()}</td>
                     <td className="px-5 py-3 text-right font-mono text-amber-500">{(row.sessions || 0).toLocaleString()}</td>
                     <td className="px-5 py-3 text-right">
                        {renderRoi(row.totalRevenue, row.cost)}
                     </td>
                     <td className="px-5 py-3 text-right">
                        {renderRoi(row.netTotalRevenue, row.cost)}
                     </td>
                     <td className={`px-5 py-3 text-right font-mono font-bold ${row.profit >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>
                        {row.profit < 0 ? '-' : ''}${Math.abs(row.profit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                     </td>
                     <td className={`px-5 py-3 text-right font-mono font-medium ${row.netProfit >= 0 ? 'text-slate-700' : 'text-orange-400'}`}>
                        {row.netProfit < 0 ? '-' : ''}${Math.abs(row.netProfit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                     </td>
                   </tr>
                 )})
               )}
             </tbody>
           </table>
         </div>
         <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-xs font-bold text-slate-500 flex justify-between items-center">
            <span>显示 {tableData.length > 1000 ? 1000 : tableData.length} 条记录 / 共 {tableData.length} 条</span>
            {tableData.length > 1000 && <span className="text-orange-500 text-[10px]">仅展示前 1000 条 (请导出查看完整数据)</span>}
         </div>
      </div>
    </div>
  );
};

export default DetailedRevenueView;
