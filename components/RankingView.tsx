
import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { ProcessedRow } from '../types';
import { Trophy, TrendingDown, TrendingUp, ChevronRight, ArrowLeft, Layers, Share2, Sparkles, ArrowRight, CalendarDays, TableProperties, Filter, BarChart3, Download, CreditCard, Wallet } from 'lucide-react';
import SummaryCards from './SummaryCards';
import TrendChart from './TrendChart';
import { exportToCsv } from '../utils/csvExport';

interface RankingViewProps {
  data: ProcessedRow[];
  dateRangeLabel: string;
}

const getStoreBadge = (store: string) => {
  const s = (store || '').toLowerCase();
  if (s.includes('google')) return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 rounded border border-green-200 uppercase tracking-tighter">Android</span>;
  if (s.includes('itunes') || s.includes('ios')) return <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded border border-blue-200 uppercase tracking-tighter">iOS</span>;
  return <span className="text-[10px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">{store || 'All'}</span>;
};

// Commission Rate Helper for Net Profit Calculation
const getNetIapRate = (store: string) => {
  const s = (store || '').toLowerCase();
  if (s.includes('amazon')) return 0.8; // Amazon 20%
  // Android now uses 15% cut -> 0.85 factor
  if (s.includes('google') || s.includes('android') || s.includes('play')) return 0.85; 
  if (s === 'ios' || s.includes('apple') || s.includes('itunes') || s.includes('app_store')) return 0.7; // iOS 30%
  return 0.7; // Default 30% cut
};

const getISOWeek = (dateStr: string) => {
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
  const d = match ? new Date(match[0]) : new Date(dateStr.split('(')[0]);
  if (isNaN(d.getTime())) return 'Unknown';
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  const weekNo = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const getMonthKey = (dateStr: string) => {
  const match = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
  const d = match ? new Date(match[0]) : new Date(dateStr.split('(')[0]);
  if (isNaN(d.getTime())) return 'Unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-xs min-w-[160px]">
        <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-1"><p className="font-bold text-slate-800">{data.key || "Unknown Item"}</p>{data.storeType && getStoreBadge(data.storeType)}</div>
        <div className="space-y-1"><p className="flex justify-between gap-4 text-emerald-600 font-bold"><span>总收入:</span><span className="font-mono">${data.revenue.toLocaleString()}</span></p><p className="flex justify-between gap-4 text-blue-500 pl-2"><span>↳ 内购:</span><span className="font-mono">${data.iapRevenue.toLocaleString()}</span></p><p className="flex justify-between gap-4 text-purple-500 pl-2"><span>↳ 广告:</span><span className="font-mono">${data.adRevenue.toLocaleString()}</span></p><p className="flex justify-between gap-4 text-red-500 mt-1 border-t border-slate-50 pt-1"><span>总消耗:</span><span className="font-mono">${data.cost.toLocaleString()}</span></p></div>
      </div>
    );
  }
  return null;
};

const RankingView: React.FC<RankingViewProps> = ({ data, dateRangeLabel }) => {
  const [selectedAppName, setSelectedAppName] = useState<string | null>(null);
  const [summaryPeriod, setSummaryPeriod] = useState<'week' | 'month'>('week');

  const activeData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    let validData = data.filter(r => r !== null && r !== undefined);
    if (selectedAppName) return validData.filter(r => (r.appName || "Unknown App") === selectedAppName);
    return validData;
  }, [data, selectedAppName]);

  const globalPeriodSummary = useMemo(() => {
    const map = new Map<string, any>();
    activeData.forEach(row => {
      const pKey = summaryPeriod === 'week' ? getISOWeek(row.dateStr) : getMonthKey(row.dateStr);
      if (pKey === 'Unknown') return;
      if (!map.has(pKey)) map.set(pKey, { period: pKey, cost: 0, revenue: 0, adRevenue: 0, iapRevenue: 0, installs: 0, daus: 0, sessions: 0 });
      const entry = map.get(pKey);
      entry.cost += (row.cost || 0);
      entry.revenue += (row.totalRevenue || 0);
      entry.adRevenue += (row.adRevenue || 0);
      entry.iapRevenue += (row.iapRevenue || 0);
      entry.installs += (row.installs || 0);
      entry.daus += (row.daus || 0);
      entry.sessions += (row.sessions || 0);
    });
    return Array.from(map.values()).filter(row => row.cost > 0 || row.revenue > 0).sort((a, b) => b.period.localeCompare(a.period));
  }, [activeData, summaryPeriod]);

  // Updated aggregation logic with Net Profit calculation
  const periodProductTrends = useMemo(() => {
    const map = new Map<string, any>();
    activeData.forEach(row => {
      const pKey = summaryPeriod === 'week' ? getISOWeek(row.dateStr) : getMonthKey(row.dateStr);
      if (pKey === 'Unknown') return;
      const app = row.appName || "Unknown App";
      const compositeKey = `${pKey}_${app}`;
      
      if (!map.has(compositeKey)) {
          map.set(compositeKey, { 
              period: pKey, appName: app, 
              cost: 0, revenue: 0, adRevenue: 0, iapRevenue: 0, installs: 0,
              netTotalRevenue: 0, // Accumulator for accurate net revenue based on individual row store type
              daus: 0, sessions: 0
          });
      }
      const entry = map.get(compositeKey);
      
      entry.cost += (row.cost || 0);
      entry.revenue += (row.totalRevenue || 0);
      entry.adRevenue += (row.adRevenue || 0);
      entry.iapRevenue += (row.iapRevenue || 0);
      entry.installs += (row.installs || 0);
      entry.daus += (row.daus || 0);
      entry.sessions += (row.sessions || 0);

      // Net Revenue Calculation per row (to handle mixed store types correctly)
      const rate = getNetIapRate(row.storeType);
      const netIap = (row.iapRevenue || 0) * rate;
      entry.netTotalRevenue += (netIap + (row.adRevenue || 0));
    });

    return Array.from(map.values()).filter(row => row.cost > 0).map(item => {
        const grossProfit = item.revenue - item.cost;
        const netProfitRaw = item.netTotalRevenue - item.cost;
        // Logic: If Gross Profit is negative, Net Profit equals Gross Profit (preserve actual loss).
        // If Gross Profit is positive, calculate Net Profit with commissions deducted.
        const netProfit = grossProfit < 0 ? grossProfit : netProfitRaw;

        return {
            ...item,
            grossProfit,
            netProfit,
            roi: item.cost > 0 ? item.revenue / item.cost : 0,
            iapRoi: item.cost > 0 ? item.iapRevenue / item.cost : 0,
            adRoi: item.cost > 0 ? item.adRevenue / item.cost : 0,
        };
    }).sort((a, b) => {
      if (b.period !== a.period) return b.period.localeCompare(a.period);
      return b.revenue - a.revenue;
    });
  }, [activeData, summaryPeriod]);

  const exportGlobalSummary = () => {
    if (!globalPeriodSummary.length) return;
    const headers = ["周期", "消耗", "收入", "内购", "广告", "利润", "ROI", "安装", "DAU", "Sessions"];
    const rows = globalPeriodSummary.map(r => [
      r.period, 
      r.cost, 
      r.revenue, 
      r.iapRevenue, 
      r.adRevenue, 
      r.revenue - r.cost, 
      r.cost > 0 ? (r.revenue / r.cost * 100).toFixed(2) + '%' : '0%', 
      r.installs,
      r.daus,
      r.sessions
    ]);
    exportToCsv(headers, rows, `global_summary_${summaryPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportProductTrends = () => {
    if (!periodProductTrends.length) return;
    const headers = ["周期", "应用名称", "消耗", "总收入", "内购", "内购ROI", "广告", "广告ROI", "净利润(Net)", "总ROI", "DAU", "Sessions"];
    const rows = periodProductTrends.map(r => [
      r.period, 
      r.appName, 
      r.cost.toFixed(2), 
      r.revenue.toFixed(2), 
      r.iapRevenue.toFixed(2), 
      (r.iapRoi * 100).toFixed(2) + '%',
      r.adRevenue.toFixed(2), 
      (r.adRoi * 100).toFixed(2) + '%',
      r.netProfit.toFixed(2), 
      (r.roi * 100).toFixed(2) + '%',
      r.daus,
      r.sessions
    ]);
    exportToCsv(headers, rows, `product_trends_${summaryPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const trendAnalysis = useMemo(() => {
    if (!activeData || activeData.length === 0) return null;
    const dimensionKey = selectedAppName ? 'network' : 'appName';
    const sorted = [...activeData].sort((a, b) => {
      const d1 = a.dateStr.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || a.dateStr;
      const d2 = b.dateStr.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || b.dateStr;
      return new Date(d1).getTime() - new Date(d2).getTime();
    });
    const uniqueDates = Array.from(new Set(sorted.map(r => r.dateStr))).sort();
    if (uniqueDates.length < 2) return null;
    const mid = Math.floor(uniqueDates.length / 2);
    const prevDates = uniqueDates.slice(0, mid);
    const currDates = uniqueDates.slice(mid);
    const calcSum = (dates: string[], metric: 'totalRevenue' | 'cost') => sorted.filter(r => dates.includes(r.dateStr)).reduce((acc, c) => acc + (c[metric] || 0), 0);
    const prevRev = calcSum(prevDates, 'totalRevenue');
    const currRev = calcSum(currDates, 'totalRevenue');
    const prevCost = calcSum(prevDates, 'cost');
    const currCost = calcSum(currDates, 'cost');
    const prevProfit = prevRev - prevCost;
    const currProfit = currRev - currCost;
    const getTopMovers = (metric: 'revenue' | 'profit') => {
        const impactMap = new Map<string, number>();
        sorted.forEach(r => {
            const key = String(r[dimensionKey] || 'Unknown App');
            const val = metric === 'revenue' ? (r.totalRevenue || 0) : ((r.totalRevenue || 0) - (r.cost || 0)); 
            if (currDates.includes(r.dateStr)) impactMap.set(key, (impactMap.get(key) || 0) + val);
            else if (prevDates.includes(r.dateStr)) impactMap.set(key, (impactMap.get(key) || 0) - val);
        });
        const movers = Array.from(impactMap.entries()).map(([name, delta]) => ({ name, delta }));
        const topRiser = movers.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta)[0];
        const topFaller = movers.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta)[0];
        return { topRiser, topFaller };
    };
    return { hasData: true, periodLabel: { prev: `${prevDates[0]}~${prevDates[prevDates.length-1]}`, curr: `${currDates[0]}~${currDates[currDates.length-1]}` }, revenue: { delta: currRev - prevRev, pct: prevRev > 0 ? (currRev - prevRev) / prevRev : 0, ...getTopMovers('revenue') }, profit: { delta: currProfit - prevProfit, pct: prevProfit !== 0 ? (currProfit - prevProfit) / Math.abs(prevProfit) : 0, ...getTopMovers('profit') }, cost: { delta: currCost - prevCost, pct: prevCost > 0 ? (currCost - prevCost) / prevCost : 0 } };
  }, [activeData, selectedAppName]);

  const leaderboardData = useMemo(() => {
    const map = new Map<string, { key: string; storeType: string; cost: number; revenue: number; adRevenue: number; iapRevenue: number; installs: number; roi: number }>();
    const groupKey = selectedAppName ? 'network' : 'appName';
    activeData.forEach(row => {
      if (!row) return;
      const rawKey = (row as any)[groupKey];
      const keyVal = String(rawKey || "Unknown");
      const storeVal = row.storeType || "Unknown";
      const compositeKey = `${keyVal}||${storeVal}`;
      const current = map.get(compositeKey) || { key: keyVal, storeType: storeVal, cost: 0, revenue: 0, adRevenue: 0, iapRevenue: 0, installs: 0, roi: 0 };
      current.cost += (row.cost || 0);
      current.revenue += (row.totalRevenue || 0);
      current.adRevenue += (row.adRevenue || 0);
      current.iapRevenue += (row.iapRevenue || 0);
      current.installs += (row.installs || 0);
      map.set(compositeKey, current);
    });
    return Array.from(map.values()).map(item => ({ ...item, roi: item.cost > 0 ? (item.revenue / item.cost) : 0, profit: item.revenue - item.cost, revenueDisplay: Number(item.revenue.toFixed(2)), costDisplay: Number(item.cost.toFixed(2)), chartLabel: `${item.key} (${item.storeType.toLowerCase().includes('google') ? 'And' : 'iOS'})` }));
  }, [activeData, selectedAppName]);

  const revenueRanking = [...leaderboardData].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const costRanking = [...leaderboardData].sort((a, b) => b.cost - a.cost).slice(0, 10);
  const handleDrillDown = (key: string) => { if (!selectedAppName && key && key !== "Unknown App") setSelectedAppName(key); };
  const renderTrendPercent = (val: number, isInverse: boolean = false) => { const pct = val * 100; const isPositive = pct > 0; const isGood = isInverse ? !isPositive : isPositive; const color = isGood ? 'text-green-600' : 'text-red-500'; const Icon = isPositive ? TrendingUp : TrendingDown; return (<span className={`flex items-center gap-0.5 text-xs font-bold ${color}`}><Icon className="w-3 h-3" /> {Math.abs(pct).toFixed(1)}%</span>); };

  const renderPercentCell = (val: number, good = 1.0, ok = 0.5) => {
    const percent = val * 100;
    const color = percent >= (good * 100) ? 'text-green-600' : percent >= (ok * 100) ? 'text-blue-600' : 'text-orange-500';
    return <span className={`font-mono font-bold ${color}`}>{percent.toFixed(1)}%</span>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedAppName(null)} className={`flex items-center gap-1 text-sm font-semibold transition-colors ${selectedAppName ? 'text-slate-500 hover:text-blue-600' : 'text-slate-800'}`}>
            <Layers className="w-4 h-4" /> 所有应用
          </button>
          {selectedAppName && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-400" />
              <div className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                {selectedAppName}
                <button onClick={() => setSelectedAppName(null)} className="ml-2 p-0.5 hover:bg-blue-200 rounded-full text-blue-400 hover:text-blue-700">
                  <ArrowLeft className="w-3 h-3" />
                </button>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200 shadow-inner">
            <button onClick={() => setSummaryPeriod('week')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${summaryPeriod === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>按周查看</button>
            <button onClick={() => setSummaryPeriod('month')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${summaryPeriod === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>按月查看</button>
          </div>
        </div>
      </div>
      <SummaryCards data={activeData} />
      <TrendChart data={activeData} />
      {trendAnalysis && (<div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles className="w-24 h-24 text-purple-600" /></div><div className="flex items-center gap-2 mb-3 relative z-10"><Sparkles className="w-4 h-4 text-purple-600" /><h3 className="text-sm font-bold text-slate-700">智能趋势解读</h3><span className="text-xs text-slate-400 flex items-center gap-1 bg-white/50 px-2 py-0.5 rounded-full border border-purple-100">对比周期: {trendAnalysis.periodLabel.prev} <ArrowRight className="w-3 h-3"/> {trendAnalysis.periodLabel.curr}</span></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10"><div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-purple-100"><div className="flex justify-between items-start mb-2"><span className="text-xs font-semibold text-slate-500 uppercase">收入趋势</span>{renderTrendPercent(trendAnalysis.revenue.pct)}</div><div className="text-sm text-slate-600">{Math.abs(trendAnalysis.revenue.delta) < 5 ? (<span className="text-slate-400 text-xs italic">变化平稳</span>) : (<><p>收入增长 <span className="font-mono font-medium text-green-600">+${trendAnalysis.revenue.delta.toLocaleString(undefined, {maximumFractionDigits:0})}</span></p><div className="mt-1.5 pt-1.5 border-t border-slate-100 text-xs text-slate-500">{trendAnalysis.revenue.delta > 0 && trendAnalysis.revenue.topRiser && (<p className="flex items-center gap-1">主要动力: <span className="font-bold truncate max-w-[100px] text-slate-700">{trendAnalysis.revenue.topRiser.name}</span></p>)}</div></>)}</div></div><div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-purple-100"><div className="flex justify-between items-start mb-2"><span className="text-xs font-semibold text-slate-500 uppercase">利润趋势</span>{renderTrendPercent(trendAnalysis.profit.pct)}</div><div className="text-sm text-slate-600">{Math.abs(trendAnalysis.profit.delta) < 5 ? (<span className="text-slate-400 text-xs italic">变化平稳</span>) : (<>{trendAnalysis.profit.delta > 0 ? (<p>利润增长 <span className="font-mono font-medium text-purple-600">+${trendAnalysis.profit.delta.toLocaleString(undefined, {maximumFractionDigits:0})}</span></p>) : (<p>利润下降 <span className="font-mono font-medium text-orange-500">-${Math.abs(trendAnalysis.profit.delta).toLocaleString(undefined, {maximumFractionDigits:0})}</span></p>)}</>)}</div></div><div className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-slate-100"><div className="flex justify-between items-start mb-2"><span className="text-xs font-semibold text-slate-500 uppercase">消耗趋势</span>{renderTrendPercent(trendAnalysis.cost.pct, true)}</div><div className="text-sm text-slate-600">{Math.abs(trendAnalysis.cost.delta) < 5 ? (<span className="text-slate-400 text-xs italic">消耗持平</span>) : (<p>{trendAnalysis.cost.delta > 0 ? '消耗增加' : '消耗减少'} <span className={`font-mono font-medium ml-1 ${trendAnalysis.cost.delta > 0 ? 'text-red-500' : 'text-green-600'}`}>{trendAnalysis.cost.delta > 0 ? '+' : '-'}${Math.abs(trendAnalysis.cost.delta).toLocaleString(undefined, {maximumFractionDigits:0})}</span></p>)}</div></div></div></div>)}
      <div className="flex items-center gap-2 mt-8 mb-4">{selectedAppName ? <Share2 className="w-5 h-5 text-purple-500" /> : <Trophy className="w-5 h-5 text-yellow-500" />}<h3 className="text-lg font-bold text-slate-800">{selectedAppName ? '合作伙伴排行榜' : '重点推广应用排行榜'}</h3></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h4 className="font-bold text-slate-700 flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-green-500" />收入排行</h4><div className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={revenueRanking} margin={{ top: 5, right: 30, left: 60, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" hide /><YAxis dataKey="chartLabel" type="category" width={140} tick={{ fontSize: 10, fill: '#64748b' }} interval={0} /><Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} /><Bar dataKey="revenueDisplay" radius={[0, 4, 4, 0]} barSize={18} onClick={(data) => handleDrillDown(data.key)} cursor="pointer">{revenueRanking.map((entry, index) => (<Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#34d399'} />))}</Bar></BarChart></ResponsiveContainer></div></div><div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm"><h4 className="font-bold text-slate-700 flex items-center gap-2 mb-4"><TrendingDown className="w-5 h-5 text-red-500" />消耗排行</h4><div className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={costRanking} margin={{ top: 5, right: 30, left: 60, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" /><XAxis type="number" hide /><YAxis dataKey="chartLabel" type="category" width={140} tick={{ fontSize: 10, fill: '#64748b' }} interval={0} /><Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} /><Bar dataKey="costDisplay" radius={[0, 4, 4, 0]} barSize={18} onClick={(data) => handleDrillDown(data.key)} cursor="pointer">{costRanking.map((entry, index) => (<Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f87171'} />))}</Bar></BarChart></ResponsiveContainer></div></div></div>
      {!selectedAppName && (
        <div className="pt-10 space-y-4">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-600" /><h3 className="text-lg font-bold text-slate-800">全产品周期财务汇总 (Global Period Performance)</h3></div><button onClick={exportGlobalSummary} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"><Download className="w-3.5 h-3.5" /> 导出汇总数据</button></div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-[13px] text-left"><thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-tighter"><tr><th className="px-4 py-3 font-bold w-[120px]">周期</th><th className="px-4 py-3 font-bold text-right text-red-600">全局消耗 ($)</th><th className="px-4 py-3 font-bold text-right text-emerald-700">全局收入 ($)</th><th className="px-4 py-3 font-bold text-right text-blue-500">内购总额</th><th className="px-4 py-3 font-bold text-right text-purple-500">广告总额</th><th className="px-4 py-3 font-bold text-right text-indigo-700">总计利润 ($)</th><th className="px-4 py-3 font-bold text-right">平均 ROI</th><th className="px-4 py-3 font-bold text-right">安装总数</th><th className="px-4 py-3 font-bold text-right text-orange-500">DAU</th><th className="px-4 py-3 font-bold text-right text-amber-500">Sessions</th></tr></thead><tbody className="divide-y divide-slate-100">{globalPeriodSummary.map((row) => { const profit = row.revenue - row.cost; const roi = row.cost > 0 ? (row.revenue / row.cost) : 0; return (<tr key={row.period} className="hover:bg-slate-50 transition-colors"><td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{row.period}</td><td className="px-4 py-3 text-right font-mono text-red-500">${row.cost.toLocaleString(undefined, {maximumFractionDigits: 0})}</td><td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold">${row.revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</td><td className="px-4 py-3 text-right font-mono text-blue-500 text-xs">${row.iapRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</td><td className="px-4 py-3 text-right font-mono text-purple-500 text-xs">${row.adRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</td><td className={`px-4 py-3 text-right font-mono font-bold ${profit >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>${profit.toLocaleString(undefined, {maximumFractionDigits: 0})}</td><td className={`px-4 py-3 text-right font-bold font-mono ${roi >= 1 ? 'text-green-600' : 'text-orange-500'}`}>{(roi * 100).toFixed(1)}%</td><td className="px-4 py-3 text-right font-mono text-slate-600">{row.installs.toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-orange-500">{row.daus.toLocaleString()}</td><td className="px-4 py-3 text-right font-mono text-amber-500">{row.sessions.toLocaleString()}</td></tr>); })}</tbody></table></div></div>
        </div>
      )}
      <div className="pt-10 space-y-4">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><TableProperties className="w-5 h-5 text-indigo-600" /><h3 className="text-lg font-bold text-slate-800">{selectedAppName ? `${selectedAppName} 周期表现趋势` : '各产品周期财务趋势 (Detailed Period Trends)'}</h3></div><div className="flex items-center gap-3"><button onClick={exportProductTrends} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"><Download className="w-3.5 h-3.5" /> 导出趋势数据</button><div className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">{summaryPeriod === 'week' ? '按周聚合' : '按月聚合'}{selectedAppName ? ` · 已过滤: ${selectedAppName}` : ' · 所有产品'}</div></div></div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-[13px] text-left"><thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-tighter">
          <tr>
            <th className="px-4 py-3 font-bold w-[120px]">周期</th>
            {!selectedAppName && <th className="px-4 py-3 font-bold">应用名称</th>}
            <th className="px-4 py-3 font-bold text-right text-red-600">总消耗 ($)</th>
            <th className="px-4 py-3 font-bold text-right text-emerald-700">总收入 ($)</th>
            
            <th className="px-4 py-3 font-bold text-right text-blue-500">
               <div className="flex items-center justify-end gap-1"><CreditCard className="w-3 h-3"/> 内购</div>
            </th>
            <th className="px-4 py-3 font-bold text-right text-blue-400 text-[11px]">内购 ROI</th>
            
            <th className="px-4 py-3 font-bold text-right text-purple-500">
               <div className="flex items-center justify-end gap-1"><Wallet className="w-3 h-3"/> 广告</div>
            </th>
            <th className="px-4 py-3 font-bold text-right text-purple-400 text-[11px]">广告 ROI</th>

            <th className="px-4 py-3 font-bold text-right text-slate-600">净利润 (Net)</th>
            <th className="px-4 py-3 font-bold text-right">总 ROI</th>
            <th className="px-4 py-3 font-bold text-right text-orange-500">DAU</th>
            <th className="px-4 py-3 font-bold text-right text-amber-500">Sessions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {periodProductTrends.map((row) => { 
             const displayApp = row.appName || "Unknown App"; 
             return (
             <tr key={`${row.period}_${displayApp}`} className="hover:bg-slate-50 transition-colors">
               <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">{row.period}</td>
               {!selectedAppName && (<td className="px-4 py-3 font-medium text-blue-600"><button onClick={() => setSelectedAppName(displayApp)} className="hover:underline text-left">{displayApp}</button></td>)}
               <td className="px-4 py-3 text-right font-mono text-red-500">${row.cost.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
               <td className="px-4 py-3 text-right font-mono text-emerald-600 font-bold">${row.revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
               
               <td className="px-4 py-3 text-right font-mono text-blue-500 bg-blue-50/20">${row.iapRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
               <td className="px-4 py-3 text-right bg-blue-50/20">{renderPercentCell(row.iapRoi, 0.5, 0.1)}</td>
               
               <td className="px-4 py-3 text-right font-mono text-purple-500 bg-purple-50/20">${row.adRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
               <td className="px-4 py-3 text-right bg-purple-50/20">{renderPercentCell(row.adRoi, 0.5, 0.1)}</td>

               <td className={`px-4 py-3 text-right font-mono font-bold ${row.netProfit >= 0 ? 'text-slate-700' : 'text-orange-500'}`}>
                 {row.netProfit < 0 ? '-' : ''}${Math.abs(row.netProfit).toLocaleString(undefined, {maximumFractionDigits: 0})}
               </td>
               <td className={`px-4 py-3 text-right font-bold font-mono ${row.roi >= 1 ? 'text-green-600' : 'text-orange-500'}`}>{(row.roi * 100).toFixed(1)}%</td>
               <td className="px-4 py-3 text-right font-mono text-orange-500">{row.daus.toLocaleString()}</td>
               <td className="px-4 py-3 text-right font-mono text-amber-500">{row.sessions.toLocaleString()}</td>
             </tr>); 
          })}
        </tbody></table></div></div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between"><div className="flex items-center gap-3"><div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm"><Sparkles className="w-5 h-5 text-yellow-500" /></div><p className="text-sm text-slate-600"><strong>分析提示:</strong> 使用上方的“全产品周期汇总”查看大盘趋势，或通过“重点推广排行榜”点击特定应用进行详细分析。</p></div></div>
      </div>
    </div>
  );
};

export default RankingView;
