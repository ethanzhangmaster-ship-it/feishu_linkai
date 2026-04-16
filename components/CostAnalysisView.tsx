
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ProcessedRow } from '../types';
import { 
  Table, 
  Download, 
  Calendar, 
  Search, 
  Filter,
  Share2,
  ChevronDown,
  X,
  Layers,
  CalendarDays,
  Clock,
  DollarSign,
  TrendingUp,
  Activity,
  Smartphone,
  Globe,
  Box,
  Check,
  Users,
  Target,
  BarChart3,
  CreditCard,
  Wallet
} from 'lucide-react';
import { exportToCsv } from '../utils/csvExport';

interface CostAnalysisViewProps {
  data: ProcessedRow[];
  dateRange: { start: string; end: string };
  filters: { appName: string; storeType: string; network: string; adSources: string[] };
}

const STORAGE_KEY = 'adjust_cost_view_state';

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
  if (!d) return dateStr;
  
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

// Available dimensions for grouping
const DIMENSIONS = [
  { key: 'appName', label: '应用名称', icon: Layers },
  { key: 'storeType', label: '商店', icon: Smartphone },
  { key: 'network', label: '合作伙伴', icon: Share2 },
  { key: 'country', label: '国家/地区', icon: Globe },
] as const;

type DimensionKey = typeof DIMENSIONS[number]['key'];

const CostAnalysisView: React.FC<CostAnalysisViewProps> = ({ data, dateRange, filters }) => {
  // Initialize state from sessionStorage -> URL -> Default
  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).searchTerm || '';
    } catch(e) {}
    const p = new URLSearchParams(window.location.search);
    return p.get('costSearch') || '';
  });
  
  const [selectedNetwork, setSelectedNetwork] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).selectedNetwork || '';
    } catch(e) {}
    const p = new URLSearchParams(window.location.search);
    return p.get('costNetwork') || '';
  });

  const [selectedStore, setSelectedStore] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).selectedStore || '';
    } catch(e) {}
    const p = new URLSearchParams(window.location.search);
    return p.get('costStore') || '';
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

  // Active Dimensions for Grouping
  const [activeDimensions, setActiveDimensions] = useState<DimensionKey[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved).activeDimensions;
        if (Array.isArray(d)) return d;
      }
    } catch(e) {}
    return ['appName', 'network']; // Default grouping: App + Network for cost analysis
  });

  const [isDimDropdownOpen, setIsDimDropdownOpen] = useState(false);
  const dimDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dimDropdownRef.current && !dimDropdownRef.current.contains(e.target as Node)) {
        setIsDimDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const state = { searchTerm, selectedNetwork, selectedStore, groupBy, activeDimensions };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [searchTerm, selectedNetwork, selectedStore, groupBy, activeDimensions]);

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

  const networkOptions = useMemo(() => {
    return Array.from(new Set(data.map(r => r.network))).filter(Boolean).sort();
  }, [data]);

  const storeOptions = useMemo(() => {
    return Array.from(new Set(data.map(r => r.storeType))).filter(Boolean).sort();
  }, [data]);

  const tableData = useMemo(() => {
    // 1. Filter raw data
    let rows = data;
    if (selectedNetwork) rows = rows.filter(r => r.network === selectedNetwork);
    if (selectedStore) rows = rows.filter(r => r.storeType === selectedStore);
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      rows = rows.filter(r => (r.appName || '').toLowerCase().includes(lower));
    }

    // 2. Aggregate
    const aggMap = new Map<string, ProcessedRow & { cost: number, installs: number, paidInstalls: number, iapRevenue: number, adRevenue: number }>();
    
    rows.forEach(row => {
        let periodKey = row.dateStr;
        if (groupBy === 'week') periodKey = getISOWeek(row.dateStr);
        else if (groupBy === 'month') periodKey = getMonthKey(row.dateStr);

        const dimValues = activeDimensions.map(d => row[d] || 'Unknown');
        const key = `${periodKey}|${dimValues.join('|')}`;
        
        if (!aggMap.has(key)) {
            aggMap.set(key, { 
              ...row,
              dateStr: periodKey,
              appName: activeDimensions.includes('appName') ? row.appName : undefined,
              storeType: activeDimensions.includes('storeType') ? row.storeType : 'All Stores',
              network: activeDimensions.includes('network') ? row.network : 'All Networks',
              country: activeDimensions.includes('country') ? (row.country || 'Global') : 'Global',
              cost: 0,
              installs: 0,
              paidInstalls: 0,
              totalRevenue: 0,
              iapRevenue: 0,
              adRevenue: 0,
            });
        }
        
        const entry = aggMap.get(key)!;
        entry.cost += (row.cost || 0);
        entry.installs += (row.installs || 0);
        entry.paidInstalls += (row.paidInstalls || 0); 
        entry.totalRevenue += (row.totalRevenue || 0);
        entry.iapRevenue += (row.iapRevenue || 0);
        entry.adRevenue += (row.adRevenue || 0);
    });

    const aggregatedRows = Array.from(aggMap.values());

    // 3. Sort by Date Desc, then Cost Desc
    return aggregatedRows.sort((a, b) => {
       if (b.dateStr !== a.dateStr) return b.dateStr.localeCompare(a.dateStr);
       return b.cost - a.cost;
    });
  }, [data, searchTerm, selectedNetwork, selectedStore, groupBy, activeDimensions]);

  const stats = useMemo(() => {
    const totalCost = tableData.reduce((acc, r) => acc + r.cost, 0);
    const totalInstalls = tableData.reduce((acc, r) => acc + r.installs, 0);
    const totalPaidInstalls = tableData.reduce((acc, r) => acc + (r.paidInstalls || 0), 0);
    const totalRevenue = tableData.reduce((acc, r) => acc + r.totalRevenue, 0);

    return {
        cost: totalCost,
        installs: totalInstalls,
        paidInstalls: totalPaidInstalls,
        cpi: totalInstalls > 0 ? totalCost / totalInstalls : 0,
        paidCpi: totalPaidInstalls > 0 ? totalCost / totalPaidInstalls : 0,
        revenue: totalRevenue,
        roi: totalCost > 0 ? totalRevenue / totalCost : 0,
    }
  }, [tableData]);

  const handleExport = () => {
    if (!tableData.length) return;
    
    const headers = ["日期/周期"];
    if (activeDimensions.includes('appName')) headers.push("应用名称");
    if (activeDimensions.includes('storeType')) headers.push("商店");
    if (activeDimensions.includes('network')) headers.push("合作伙伴");
    if (activeDimensions.includes('country')) headers.push("国家/地区");

    headers.push("消耗", "安装数", "CPI (平均)", "付费安装 (Est.)", "付费 CPI", "内购收入", "广告收入", "总收入 (Ref)", "ROI (Ref)");

    const rows = tableData.map(r => {
      const rowData = [r.dateStr];
      if (activeDimensions.includes('appName')) rowData.push(r.appName || '');
      if (activeDimensions.includes('storeType')) rowData.push(r.storeType === 'All Stores' ? 'All' : r.storeType);
      if (activeDimensions.includes('network')) rowData.push(r.network === 'All Networks' ? 'All' : r.network);
      if (activeDimensions.includes('country')) rowData.push(r.country || 'Global');
      
      const cpi = r.installs > 0 ? r.cost / r.installs : 0;
      const paidCpi = r.paidInstalls > 0 ? r.cost / r.paidInstalls : 0;
      const roi = r.cost > 0 ? r.totalRevenue / r.cost : 0;

      rowData.push(
        r.cost.toFixed(2),
        r.installs.toString(),
        cpi.toFixed(2),
        r.paidInstalls.toString(),
        paidCpi.toFixed(2),
        r.iapRevenue.toFixed(2),
        r.adRevenue.toFixed(2),
        r.totalRevenue.toFixed(2),
        (roi * 100).toFixed(2) + '%'
      );
      return rowData;
    });

    exportToCsv(headers, rows, `cost_breakdown_${groupBy}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Stats Cards - Cost Focused */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3"/> 总消耗 (Total Spend)</span>
             <div className="text-xl font-black text-red-500 font-mono">${stats.cost.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Users className="w-3 h-3"/> 总安装 (Installs)</span>
             <div className="text-xl font-bold text-slate-700 font-mono">{stats.installs.toLocaleString()}</div>
             <div className="text-[10px] text-slate-400 font-mono mt-1">Paid: {stats.paidInstalls.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> 平均 CPI (Cost Per Install)</span>
             <div className="text-xl font-bold text-blue-600 font-mono">${stats.cpi.toFixed(2)}</div>
             <div className="text-[10px] text-slate-400 font-mono mt-1">Paid CPI: ${stats.paidCpi.toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center bg-slate-50/50">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3"/> 参考 ROI (Ref)</span>
             <div className={`text-xl font-bold font-mono ${stats.roi >= 1 ? 'text-emerald-600' : 'text-orange-500'}`}>
                {(stats.roi * 100).toFixed(1)}%
             </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center bg-slate-50/50">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Activity className="w-3 h-3"/> 参考收入 (Ref Revenue)</span>
             <div className="text-xl font-bold text-emerald-600 font-mono">${stats.revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
          </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
           <div className="bg-red-50 p-2 rounded-lg text-red-600">
              <BarChart3 className="w-5 h-5" />
           </div>
           <div>
              <h2 className="text-lg font-bold text-slate-800">消耗与成本明细</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Layers className="w-3 h-3" />
                <span>当前聚合: 日期 + {activeDimensions.length > 0 ? activeDimensions.map(d => DIMENSIONS.find(x => x.key === d)?.label).join(' + ') : '无'}</span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-end flex-wrap">
           
           <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200 mr-2">
              <button onClick={() => setGroupBy('day')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${groupBy === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Calendar className="w-3 h-3" /> 按日</button>
              <button onClick={() => setGroupBy('week')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${groupBy === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><CalendarDays className="w-3 h-3" /> 按周</button>
              <button onClick={() => setGroupBy('month')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${groupBy === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Clock className="w-3 h-3" /> 按月</button>
           </div>

           {/* Dimensional Grouping */}
           <div className="relative group" ref={dimDropdownRef}>
              <button onClick={() => setIsDimDropdownOpen(!isDimDropdownOpen)} className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm ${activeDimensions.length > 2 ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}>
                <Box className="w-4 h-4" />
                聚合维度 ({activeDimensions.length})
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDimDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isDimDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in duration-200">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">选择分组维度</div>
                   <div className="space-y-1">
                      {DIMENSIONS.map(dim => (
                         <button key={dim.key} onClick={() => toggleDimension(dim.key)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors">
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
              <select className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none min-w-[120px] cursor-pointer hover:border-blue-300 transition-all" value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)}>
                <option value="">所有商店</option>
                {storeOptions.map(store => (<option key={store} value={store}>{store === 'ios' ? 'iOS' : store === 'android' ? 'Android' : store}</option>))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
           </div>

           {/* Network Filter */}
           <div className="relative group">
              <Share2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
              <select className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none min-w-[140px] cursor-pointer hover:border-blue-300 transition-all" value={selectedNetwork} onChange={(e) => setSelectedNetwork(e.target.value)}>
                <option value="">所有合作伙伴</option>
                {networkOptions.map(net => (<option key={net} value={net}>{net}</option>))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
           </div>

           {/* Search Input */}
           <div className="relative group max-w-xs w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input type="text" placeholder="搜索应用..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           </div>

           {(searchTerm || selectedNetwork || selectedStore) && (
              <button onClick={() => { setSearchTerm(''); setSelectedNetwork(''); setSelectedStore(''); }} className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                <X className="w-3 h-3" />
              </button>
           )}

           <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all shadow-sm active:scale-95 whitespace-nowrap">
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
                 
                 {activeDimensions.includes('appName') && <th className="px-5 py-4 font-black uppercase tracking-wider">应用名称</th>}
                 {activeDimensions.includes('storeType') && <th className="px-5 py-4 font-black uppercase tracking-wider w-[100px]">商店</th>}
                 {activeDimensions.includes('network') && <th className="px-5 py-4 font-black uppercase tracking-wider">合作伙伴</th>}
                 {activeDimensions.includes('country') && <th className="px-5 py-4 font-black uppercase tracking-wider">国家/地区</th>}

                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-red-600"><div className="flex items-center justify-end gap-1"><DollarSign className="w-3 h-3"/> 消耗 (Spend)</div></th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-slate-600"><div className="flex items-center justify-end gap-1"><Users className="w-3 h-3"/> 安装 (Installs)</div></th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-blue-600"><div className="flex items-center justify-end gap-1"><Target className="w-3 h-3"/> CPI (Average)</div></th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-slate-400">付费安装 (Est.)</th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-blue-400">付费 CPI</th>
                 
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-blue-600"><div className="flex items-center justify-end gap-1"><CreditCard className="w-3 h-3"/> 内购收入 (IAP)</div></th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-purple-600"><div className="flex items-center justify-end gap-1"><Wallet className="w-3 h-3"/> 广告收入 (Ad)</div></th>
                 
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right text-emerald-600">总收入 (Ref)</th>
                 <th className="px-5 py-4 font-black uppercase tracking-wider text-right">ROI (Ref)</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100">
               {tableData.length === 0 ? (
                 <tr>
                    <td colSpan={12 + activeDimensions.length} className="px-5 py-12 text-center text-slate-400 italic">
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
                     <td className="px-5 py-3 text-right font-mono text-slate-700">{row.installs.toLocaleString()}</td>
                     <td className="px-5 py-3 text-right font-mono text-blue-600 font-bold">${cpi.toFixed(2)}</td>
                     <td className="px-5 py-3 text-right font-mono text-slate-400 text-xs">{row.paidInstalls.toLocaleString()}</td>
                     <td className="px-5 py-3 text-right font-mono text-blue-400 text-xs">${paidCpi.toFixed(2)}</td>
                     <td className="px-5 py-3 text-right font-mono text-blue-600 text-xs">${row.iapRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                     <td className="px-5 py-3 text-right font-mono text-purple-600 text-xs">${row.adRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                     <td className="px-5 py-3 text-right font-mono text-emerald-600 text-xs">${row.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                     <td className={`px-5 py-3 text-right font-mono font-medium ${roi >= 1 ? 'text-emerald-600' : 'text-orange-500'}`}>
                        {(roi * 100).toFixed(1)}%
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

export default CostAnalysisView;
