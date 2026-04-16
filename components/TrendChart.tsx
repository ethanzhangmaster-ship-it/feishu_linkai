
import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush,
} from 'recharts';
import { ProcessedRow } from '../types';
import { TrendingUp, Table as TableIcon, PieChart as PieIcon, Activity, Download } from 'lucide-react';
import { exportToCsv } from '../utils/csvExport';

interface TrendChartProps {
  data: ProcessedRow[];
}

type ChartType = 'trend' | 'cumulative' | 'distribution' | 'table';

// Helper for Net Calculation (Consistent with SummaryCards)
const getNetFactor = (store: string) => {
  const s = (store || '').toLowerCase();
  if (s.includes('amazon')) return 0.8;
  if (s.includes('google') || s.includes('android') || s.includes('play')) return 0.85; // 15% cut
  if (s === 'ios' || s.includes('apple') || s.includes('itunes')) return 0.7; // 30% cut
  return 0.7; 
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isCumulative = data.cumulativeRevenue !== undefined;
    
    // Gross Metrics
    const rev = isCumulative ? data.cumulativeRevenue : data.totalRevenue;
    const cost = isCumulative ? data.cumulativeCost : data.cost;
    const profit = isCumulative ? data.cumulativeProfit : data.profit;
    
    // Net Metrics
    const netRev = isCumulative ? data.cumulativeNetRevenue : data.netRevenue;
    const netProfit = isCumulative ? data.cumulativeNetProfit : data.netProfit;

    const roi = cost > 0 ? (rev / cost) * 100 : 0;
    const netRoi = cost > 0 ? (netRev / cost) * 100 : 0;

    const revGrowth = !isCumulative ? data.revenueGrowth : undefined;
    const costGrowth = !isCumulative ? data.costGrowth : undefined;
    const profitGrowth = !isCumulative ? data.profitGrowth : undefined;

    const renderGrowth = (val: number | undefined, inverse: boolean = false) => {
      if (val === undefined || val === null || isNaN(val) || Math.abs(val) < 0.001) return null;
      const pct = val * 100;
      const isPos = pct > 0;
      const isGood = inverse ? !isPos : isPos;
      const colorClass = isGood ? 'text-emerald-500' : 'text-rose-500';
      const arrow = isPos ? '▲' : '▼';
      return (
        <span className={`text-[10px] ml-1.5 font-medium ${colorClass}`}>
          {arrow}{Math.abs(pct).toFixed(1)}%
        </span>
      );
    };

    return (
      <div className="bg-white/95 backdrop-blur-sm p-3 border border-slate-200 shadow-xl rounded-lg text-xs z-50 min-w-[200px]">
        <p className="font-bold text-slate-700 mb-2 pb-1 border-b border-slate-100 flex justify-between">
          <span>{label} {isCumulative ? '(累计)' : ''}</span>
        </p>
        <div className="space-y-2">
          {/* Revenue Group */}
          <div className="flex justify-between items-start gap-4">
             <span className="text-slate-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>收入 (Gross)</span>
             <div className="text-right">
               <span className="font-mono font-medium text-slate-700 block">${rev.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
               {renderGrowth(revGrowth)}
             </div>
          </div>
          <div className="flex justify-between items-center gap-4 pl-3.5 opacity-80">
             <span className="text-emerald-700 font-medium text-[10px]">↳ 净收入 (Net)</span>
             <span className="font-mono font-medium text-emerald-700">${netRev.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
          </div>

          {/* Cost */}
          <div className="flex justify-between items-center gap-4 pt-1">
             <span className="text-slate-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span>消耗</span>
             <div className="text-right">
                <span className="font-mono font-medium text-slate-700 block">${cost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>
                {renderGrowth(costGrowth, true)}
             </div>
          </div>

          {/* Profit Group */}
          <div className="flex justify-between items-center gap-4 pt-1">
             <span className="text-slate-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500"></span>利润 (Gross)</span>
             <div className="text-right">
               <span className={`font-mono font-bold block ${profit >= 0 ? 'text-purple-600' : 'text-orange-500'}`}>
                 {profit >= 0 ? '+' : ''}{profit.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
               </span>
               {renderGrowth(profitGrowth)}
             </div>
          </div>
          <div className="flex justify-between items-center gap-4 pl-3.5 opacity-80">
             <span className="text-indigo-700 font-medium text-[10px]">↳ 净利润 (Net)</span>
             <span className={`font-mono font-medium ${netProfit >= 0 ? 'text-indigo-700' : 'text-orange-600'}`}>
               {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
             </span>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center gap-4">
             <span className="text-slate-500 font-semibold">ROI (Gross)</span>
             <span className={`font-mono font-bold ${roi >= 100 ? 'text-emerald-600' : 'text-orange-500'}`}>
               {roi.toFixed(2)}%
             </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const [chartType, setChartType] = useState<ChartType>('trend');

  const dailyData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];
    
    // Aggregate Map
    const map = new Map<string, { 
      dateStr: string; 
      cost: number; 
      totalRevenue: number; 
      netRevenue: number;
      iapRevenue: number; 
      adRevenue: number; 
      netProfit: number;
    }>();

    data.forEach(row => {
      if (!row || !row.dateStr) return;
      const key = row.dateStr.trim();
      
      if (!map.has(key)) {
        map.set(key, { 
          dateStr: key, cost: 0, totalRevenue: 0, netRevenue: 0, 
          iapRevenue: 0, adRevenue: 0, netProfit: 0 
        });
      }
      
      const existing = map.get(key)!;
      existing.cost += (row.cost || 0);
      existing.totalRevenue += (row.totalRevenue || 0);
      existing.iapRevenue += (row.iapRevenue || 0);
      existing.adRevenue += (row.adRevenue || 0);

      // Net Calculations per row
      const rate = getNetFactor(row.storeType);
      const netIap = (row.iapRevenue || 0) * rate;
      const rowNetRev = netIap + (row.adRevenue || 0);
      
      existing.netRevenue += rowNetRev;

      // Net Profit Logic (Consistent with RankingView)
      const rowGrossProfit = (row.totalRevenue || 0) - (row.cost || 0);
      const rowNetProfitRaw = rowNetRev - (row.cost || 0);
      // If Gross Profit < 0, Net Profit = Gross Profit (loss is loss)
      // Else Net Profit = Net Revenue - Cost
      const rowNetProfit = rowGrossProfit < 0 ? rowGrossProfit : rowNetProfitRaw;
      
      existing.netProfit += rowNetProfit;
    });

    const sorted = Array.from(map.values()).map(item => ({
      ...item,
      profit: item.totalRevenue - item.cost,
      // Formatting for display if needed
      costDisplay: Number(item.cost.toFixed(2)),
      revenueDisplay: Number(item.totalRevenue.toFixed(2)),
      profitDisplay: Number((item.totalRevenue - item.cost).toFixed(2)),
      netRevenueDisplay: Number(item.netRevenue.toFixed(2)),
      netProfitDisplay: Number(item.netProfit.toFixed(2))
    })).sort((a, b) => {
      const getDateVal = (str: string) => {
        const match = str.match(/\d{4}-\d{2}-\d{2}/);
        return match ? match[0] : str;
      };
      return getDateVal(a.dateStr).localeCompare(getDateVal(b.dateStr));
    });

    return sorted.map((item, index) => {
        const prev = sorted[index - 1];
        let revenueGrowth = 0;
        let costGrowth = 0;
        let profitGrowth = 0;
        if (prev) {
            if (prev.totalRevenue > 0) revenueGrowth = (item.totalRevenue - prev.totalRevenue) / prev.totalRevenue;
            if (prev.cost > 0) costGrowth = (item.cost - prev.cost) / prev.cost;
            if (Math.abs(prev.profit) > 0) profitGrowth = (item.profit - prev.profit) / Math.abs(prev.profit);
        }
        return { ...item, revenueGrowth, costGrowth, profitGrowth };
    });
  }, [data]);

  const cumulativeData = useMemo(() => {
    let accCost = 0;
    let accRevenue = 0;
    let accNetRevenue = 0;
    let accProfit = 0;
    let accNetProfit = 0;

    return dailyData.map(d => {
      accCost += d.cost;
      accRevenue += d.totalRevenue;
      accNetRevenue += d.netRevenue;
      accProfit += d.profit;
      accNetProfit += d.netProfit;

      return {
        ...d,
        cumulativeCost: Number(accCost.toFixed(2)),
        cumulativeRevenue: Number(accRevenue.toFixed(2)),
        cumulativeNetRevenue: Number(accNetRevenue.toFixed(2)),
        cumulativeProfit: Number(accProfit.toFixed(2)),
        cumulativeNetProfit: Number(accNetProfit.toFixed(2))
      };
    });
  }, [dailyData]);

  const distributionData = useMemo(() => {
    const totalCost = dailyData.reduce((acc, curr) => acc + curr.cost, 0);
    const totalRevenue = dailyData.reduce((acc, curr) => acc + curr.totalRevenue, 0);
    const totalNetRevenue = dailyData.reduce((acc, curr) => acc + curr.netRevenue, 0);
    const totalProfit = dailyData.reduce((acc, curr) => acc + curr.profit, 0);
    const totalNetProfit = dailyData.reduce((acc, curr) => acc + curr.netProfit, 0);
    const totalIap = dailyData.reduce((acc, curr) => acc + curr.iapRevenue, 0);
    const totalAd = dailyData.reduce((acc, curr) => acc + curr.adRevenue, 0);
    const roi = totalCost > 0 ? (totalRevenue / totalCost) * 100 : 0;
    
    return { totalCost, totalRevenue, totalNetRevenue, totalProfit, totalNetProfit, totalIap, totalAd, roi };
  }, [dailyData]);

  const handleExportCsv = () => {
    if (!dailyData.length) return;
    const headers = ["日期", "总收入(Gross)", "净收入(Net)", "内购", "广告", "消耗", "总利润(Gross)", "净利润(Net)", "ROI", "收入增长率", "利润增长率"];
    const rows = dailyData.map(d => [
      d.dateStr, 
      d.totalRevenue.toFixed(2), 
      d.netRevenue.toFixed(2),
      d.iapRevenue.toFixed(2),
      d.adRevenue.toFixed(2),
      d.cost.toFixed(2), 
      d.profit.toFixed(2), 
      d.netProfit.toFixed(2),
      d.cost > 0 ? (d.totalRevenue / d.cost * 100).toFixed(2) + '%' : '0%',
      (d.revenueGrowth * 100).toFixed(2) + '%',
      (d.profitGrowth * 100).toFixed(2) + '%'
    ]);
    exportToCsv(headers, rows, `daily_trend_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const safeDateFormatter = (val: any) => {
    if (!val) return '';
    const str = String(val);
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[2]}-${isoMatch[3]}`;
    const weekMatch = str.match(/^(\d{4})-(W\d+)/);
    if (weekMatch) return weekMatch[2];
    return str.length > 8 ? str.substring(5, 10) : str;
  };

  const safeCurrencyFormatter = (value: any) => {
    if (typeof value === 'number') return [`$${value.toLocaleString()}`, ''];
    return ['--', ''];
  };

  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-[450px] flex items-center justify-center text-slate-400">
        暂无趋势数据
      </div>
    );
  }

  const renderContent = () => {
    switch (chartType) {
      case 'cumulative':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeData} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                <linearGradient id="colorNetRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.1}/><stop offset="95%" stopColor="#059669" stopOpacity={0}/></linearGradient>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="dateStr" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={safeDateFormatter} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Brush dataKey="dateStr" height={30} stroke="#94a3b8" tickFormatter={safeDateFormatter} alwaysShowText={false} />
              <Area type="monotone" dataKey="cumulativeRevenue" name="累计收入(Gross)" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
              <Area type="monotone" dataKey="cumulativeNetRevenue" name="累计净收入(Net)" stroke="#059669" strokeDasharray="5 5" fillOpacity={0} />
              <Area type="monotone" dataKey="cumulativeCost" name="累计消耗" stroke="#ef4444" fillOpacity={1} fill="url(#colorCost)" />
              <Area type="monotone" dataKey="cumulativeProfit" name="累计利润(Gross)" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorProfit)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'distribution':
        const hasValues = distributionData.totalCost > 0 || distributionData.totalRevenue > 0;
        if (distributionData.totalProfit >= 0 && hasValues) {
          const pieData = [{ name: '消耗 (Cost)', value: distributionData.totalCost, color: '#ef4444' }, { name: '净利润 (Net Profit)', value: distributionData.totalNetProfit, color: '#4f46e5' }];
          return (
            <div className="flex h-full">
              <div className="flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">{pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Pie><Tooltip formatter={safeCurrencyFormatter} /><Legend verticalAlign="middle" align="right" layout="vertical" /></PieChart></ResponsiveContainer></div>
              <div className="flex flex-col justify-center gap-4 pr-10 text-sm text-slate-600">
                <div><div className="font-semibold text-slate-400">总收入</div><div className="text-xl font-bold text-emerald-600">${distributionData.totalRevenue.toLocaleString()}</div></div>
                <div><div className="font-semibold text-slate-400">净利润率</div><div className="text-xl font-bold text-indigo-600">{distributionData.totalRevenue > 0 ? ((distributionData.totalNetProfit / distributionData.totalRevenue) * 100).toFixed(1) : '0.0'}%</div></div>
              </div>
            </div>
          );
        } else {
          const barData = [{ name: '总收入', value: distributionData.totalRevenue, fill: '#10b981' }, { name: '总消耗', value: distributionData.totalCost, fill: '#ef4444' }, { name: '净利润', value: distributionData.totalNetProfit, fill: '#4f46e5' }];
          return (
             <ResponsiveContainer width="100%" height="100%"><BarChart data={barData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={60} /><Tooltip cursor={{fill: '#f8fafc'}} formatter={safeCurrencyFormatter} /><Bar dataKey="value" barSize={40} radius={[0, 4, 4, 0]}>{barData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}</Bar></BarChart></ResponsiveContainer>
          );
        }
      case 'table':
        return (
          <div className="h-full overflow-auto pr-2 relative">
            <div className="sticky top-0 right-0 z-20 flex justify-end mb-2">
               <button onClick={handleExportCsv} className="bg-white hover:bg-slate-50 border border-slate-200 p-1.5 rounded-md text-slate-500 shadow-sm transition-all flex items-center gap-1 text-[10px] font-bold"><Download className="w-3 h-3"/> 导出 CSV</button>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-[34px] z-10">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg bg-slate-50">日期</th>
                  <th className="px-4 py-3 text-right bg-slate-50">收入(Gross)</th>
                  <th className="px-4 py-3 text-right bg-slate-50 text-emerald-700">净收入(Net)</th>
                  <th className="px-4 py-3 text-right bg-slate-50">消耗</th>
                  <th className="px-4 py-3 text-right bg-slate-50">利润(Gross)</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg bg-slate-50 text-indigo-700">净利润(Net)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyData.map((row) => (
                  <tr key={row.dateStr} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-700 whitespace-nowrap">{row.dateStr}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600">${row.revenueDisplay.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-700 font-medium">${row.netRevenueDisplay.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-mono text-red-500">${row.costDisplay.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${row.profitDisplay >= 0 ? 'text-purple-600' : 'text-orange-500'}`}>${row.profitDisplay.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${row.netProfitDisplay >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>${row.netProfitDisplay.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'trend':
      default:
        return (
          <ResponsiveContainer width="100%" height="100%"><LineChart data={dailyData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="dateStr" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={safeDateFormatter} /><YAxis tick={{ fontSize: 12, fill: '#64748b' }} /><Tooltip content={<CustomTooltip />} /><Legend /><ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" /><Brush dataKey="dateStr" height={30} stroke="#94a3b8" tickFormatter={safeDateFormatter} alwaysShowText={false} />
            <Line type="monotone" dataKey="totalRevenue" name="收入 (Gross)" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="netRevenue" name="净收入 (Net)" stroke="#059669" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            
            <Line type="monotone" dataKey="cost" name="消耗" stroke="#ef4444" strokeWidth={2} dot={false} />
            
            <Line type="monotone" dataKey="profit" name="利润 (Gross)" stroke="#a855f7" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="netProfit" name="净利润 (Net)" stroke="#4f46e5" strokeWidth={3} strokeDasharray="3 3" dot={{ r: 3, strokeWidth: 1, fill: '#fff' }} activeDot={{ r: 6 }} />
          </LineChart></ResponsiveContainer>
        );
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-[480px] flex flex-col">
      <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-slate-800">财务趋势: 利润, 收入 & 消耗</h3><div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200"><button onClick={() => setChartType('trend')} className={`p-1.5 rounded-md transition-all ${chartType === 'trend' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="趋势 (线性图)"><TrendingUp className="w-4 h-4" /></button><button onClick={() => setChartType('cumulative')} className={`p-1.5 rounded-md transition-all ${chartType === 'cumulative' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="累计 (面积图)"><Activity className="w-4 h-4" /></button><button onClick={() => setChartType('distribution')} className={`p-1.5 rounded-md transition-all ${chartType === 'distribution' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="分布 (饼图/柱图)"><PieIcon className="w-4 h-4" /></button><button onClick={() => setChartType('table')} className={`p-1.5 rounded-md transition-all ${chartType === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="数据表格"><TableIcon className="w-4 h-4" /></button></div></div>
      
      {/* Summary Header */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4 px-2 border-b border-slate-100 pb-2">
         <div className="flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">总消耗 (Spend)</span><span className="text-lg font-bold text-red-500 font-mono">${distributionData.totalCost.toLocaleString(undefined, {maximumFractionDigits: 0})}</span></div>
         <div className="flex flex-col group relative">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">总收入 (Gross)</span>
            <span className="text-lg font-bold text-emerald-600 font-mono">${distributionData.totalRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
            <span className="absolute -bottom-3 left-0 text-[9px] text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-50 px-1 rounded">Net: ${distributionData.totalNetRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
         </div>
         <div className="flex flex-col group relative">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">总利润 (Gross)</span>
            <span className={`text-lg font-bold font-mono ${distributionData.totalProfit >= 0 ? 'text-purple-600' : 'text-orange-500'}`}>{distributionData.totalProfit < 0 ? '-' : ''}${Math.abs(distributionData.totalProfit).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
            <span className="absolute -bottom-3 left-0 text-[9px] text-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 px-1 rounded">Net: ${distributionData.totalNetProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
         </div>
         <div className="flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">ROI (Gross)</span><span className={`text-lg font-bold font-mono ${distributionData.roi >= 100 ? 'text-emerald-600' : 'text-orange-500'}`}>{distributionData.roi.toFixed(1)}%</span></div>
         
         <div className="flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">内购 (IAP)</span><span className="text-lg font-bold text-blue-500 font-mono">${distributionData.totalIap.toLocaleString(undefined, {maximumFractionDigits: 0})}</span></div>
         <div className="flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">广告 (AD)</span><span className="text-lg font-bold text-purple-500 font-mono">${distributionData.totalAd.toLocaleString(undefined, {maximumFractionDigits: 0})}</span></div>
      </div>

      <div className="flex-1 min-h-0 w-full">{renderContent()}</div>
    </div>
  );
};

export default TrendChart;
