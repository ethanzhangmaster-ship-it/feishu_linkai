
import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell
} from 'recharts';
import { ProcessedRow } from '../types';
import { 
  TrendingUp, DollarSign, PieChart as PieIcon, 
  Zap, Download, Wallet, CreditCard
} from 'lucide-react';
import { exportToCsv } from '../utils/csvExport';

interface RevenueTrendViewProps {
  data: ProcessedRow[];
}

const RevenueTrendView: React.FC<RevenueTrendViewProps> = ({ data }) => {
  // 1. Daily aggregate revenue data
  const dailyRevenue = useMemo(() => {
    const map = new Map<string, { date: string, revenue: number, iap: number, ad: number }>();
    data.forEach(row => {
      // Normalize date to YYYY-MM-DD
      const rawDate = row.dateStr.split('(')[0].trim();
      const date = rawDate;
      if (!map.has(date)) map.set(date, { date, revenue: 0, iap: 0, ad: 0 });
      const entry = map.get(date)!;
      entry.revenue += (row.totalRevenue || 0);
      entry.iap += (row.iapRevenue || 0);
      entry.ad += (row.adRevenue || 0);
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // 2. App-level contribution
  const appRevenueRanking = useMemo(() => {
    const map = new Map<string, { name: string, revenue: number, iap: number, ad: number }>();
    data.forEach(row => {
      const name = row.appName || 'Unknown';
      if (!map.has(name)) map.set(name, { name, revenue: 0, iap: 0, ad: 0 });
      const entry = map.get(name)!;
      entry.revenue += (row.totalRevenue || 0);
      entry.iap += (row.iapRevenue || 0);
      entry.ad += (row.adRevenue || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [data]);

  const stats = useMemo(() => {
    const total = appRevenueRanking.reduce((acc, c) => acc + c.revenue, 0);
    const iap = appRevenueRanking.reduce((acc, c) => acc + c.iap, 0);
    const ad = appRevenueRanking.reduce((acc, c) => acc + c.ad, 0);
    const peak = Math.max(...dailyRevenue.map(d => d.revenue), 0);
    return { total, iap, ad, peak, iapRatio: total > 0 ? (iap / total) : 0 };
  }, [appRevenueRanking, dailyRevenue]);

  const handleExportTrend = () => {
    const headers = ["日期", "总收入", "内购收入", "广告收入"];
    const rows = dailyRevenue.map(d => [d.date, d.revenue.toFixed(2), d.iap.toFixed(2), d.ad.toFixed(2)]);
    exportToCsv(headers, rows, `global_revenue_trends_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportLeaderboard = () => {
    const headers = ["排名", "应用名称", "总收入", "内购收入", "广告收入", "IAP占比", "AD占比"];
    const rows = appRevenueRanking.map((app, idx) => [
       idx + 1,
       app.name,
       app.revenue.toFixed(2),
       app.iap.toFixed(2),
       app.ad.toFixed(2),
       (app.revenue > 0 ? (app.iap / app.revenue * 100).toFixed(0) + '%' : '0%'),
       (app.revenue > 0 ? (app.ad / app.revenue * 100).toFixed(0) + '%' : '0%')
    ]);
    exportToCsv(headers, rows, `revenue_leaderboard_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-colors">
           <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="w-12 h-12" /></div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">累计总收入</span>
           <div className="text-2xl font-black text-emerald-600 font-mono">${stats.total.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-200 transition-colors">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">内购占比</span>
           <div className="text-2xl font-black text-blue-600 font-mono">{(stats.iapRatio * 100).toFixed(1)}%</div>
           <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${stats.iapRatio * 100}%` }}></div>
           </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">单日收入峰值</span>
           <div className="text-2xl font-black text-slate-800 font-mono">${stats.peak.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-purple-200 transition-colors">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">广告变现收入</span>
           <div className="text-2xl font-black text-purple-600 font-mono">${stats.ad.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
        </div>
      </div>

      {/* Main Trend Chart */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600 shadow-sm"><TrendingUp className="w-5 h-5" /></div>
             <div>
               <h3 className="text-lg font-black text-slate-800 leading-tight">全应用收入趋势脉动</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global revenue flow over time</p>
             </div>
          </div>
          <button onClick={handleExportTrend} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <Download className="w-3.5 h-3.5" /> 导出趋势数据
          </button>
        </div>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="date" 
                tick={{fontSize: 10, fill: '#94a3b8'}} 
                tickFormatter={(v) => v.split('-').slice(1).join('/')} 
              />
              <YAxis 
                tick={{fontSize: 10, fill: '#94a3b8'}} 
                tickFormatter={(v) => `$${v >= 1000 ? (v/1000)+'k' : v}`} 
              />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}
                formatter={(val: number) => [`$${val.toLocaleString()}`, '总收入']}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                strokeWidth={4} 
                fillOpacity={1} 
                fill="url(#colorRev)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Contribution Comparison */}
         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center gap-2 mb-6">
               <PieIcon className="w-4 h-4 text-blue-500" />
               <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">TOP 应用收入贡献分布</h4>
            </div>
            <div className="flex-1 min-h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={appRevenueRanking.slice(0, 8)} layout="vertical" margin={{ left: 40, right: 40 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 10, fill: '#64748b'}} width={120} />
                    <Tooltip cursor={{fill: '#f8fafc'}} formatter={(v: number) => [`$${v.toLocaleString()}`, '累计收入']} />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={24}>
                       {appRevenueRanking.slice(0, 8).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#34d399'} />
                       ))}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Revenue Leaderboard Table */}
         <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">全线产品创收排行榜</h4>
              </div>
              <button 
                onClick={handleExportLeaderboard} 
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold transition-all border border-slate-200"
                title="导出榜单数据"
              >
                <Download className="w-3.5 h-3.5" /> 导出 CSV
              </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-400 border-b border-slate-100">
                     <tr>
                        <th className="px-4 py-3 font-black uppercase tracking-tighter">应用名称</th>
                        <th className="px-4 py-3 font-black uppercase tracking-tighter text-right">总收入</th>
                        <th className="px-4 py-3 font-black uppercase tracking-tighter text-right">内购 (IAP)</th>
                        <th className="px-4 py-3 font-black uppercase tracking-tighter text-right">广告 (AD)</th>
                        <th className="px-4 py-3 font-black uppercase tracking-tighter text-right">收入构成</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {appRevenueRanking.slice(0, 15).map((app, idx) => (
                        <tr key={app.name} className="hover:bg-slate-50 transition-colors group">
                           <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                 <span className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">{idx + 1}</span>
                                 <span className="font-bold text-slate-700 truncate max-w-[120px]">{app.name}</span>
                              </div>
                           </td>
                           <td className="px-4 py-4 text-right font-mono font-bold text-emerald-600 text-sm whitespace-nowrap">
                             ${app.revenue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                           </td>
                           <td className="px-4 py-4 text-right font-mono font-medium text-blue-500 whitespace-nowrap">
                             ${app.iap.toLocaleString(undefined, {maximumFractionDigits: 0})}
                           </td>
                           <td className="px-4 py-4 text-right font-mono font-medium text-purple-500 whitespace-nowrap">
                             ${app.ad.toLocaleString(undefined, {maximumFractionDigits: 0})}
                           </td>
                           <td className="px-4 py-4 text-right min-w-[100px]">
                              <div className="flex items-center justify-end gap-3">
                                 <div className="flex flex-col items-end shrink-0">
                                    <span className="text-[9px] font-bold text-blue-500">IAP: {(app.iap / app.revenue * 100).toFixed(0)}%</span>
                                    <span className="text-[9px] font-bold text-purple-500">AD: {(app.ad / app.revenue * 100).toFixed(0)}%</span>
                                 </div>
                                 <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner shrink-0">
                                    <div className="bg-blue-500 h-full transition-all duration-700" style={{ width: `${(app.iap / app.revenue) * 100}%` }}></div>
                                    <div className="bg-purple-500 h-full transition-all duration-700" style={{ width: `${(app.ad / app.revenue) * 100}%` }}></div>
                                 </div>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};

export default RevenueTrendView;
