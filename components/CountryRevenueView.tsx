import React, { useMemo } from 'react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { ProcessedRow } from '../types';
import { Globe, Download, PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { exportToCsv } from '../utils/csvExport';

interface CountryRevenueViewProps {
  data: ProcessedRow[];
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#ec4899', '#84cc16'];

const CountryRevenueView: React.FC<CountryRevenueViewProps> = ({ data }) => {
  const countryRevenue = useMemo(() => {
    const map = new Map<string, { country: string, revenue: number, iap: number, ad: number }>();
    data.forEach(row => {
      const country = (row.country && row.country !== 'Global') ? row.country.toUpperCase() : (row.country || 'Unknown');
      if (!map.has(country)) map.set(country, { country, revenue: 0, iap: 0, ad: 0 });
      const entry = map.get(country)!;
      entry.revenue += (row.totalRevenue || 0);
      entry.iap += (row.iapRevenue || 0);
      entry.ad += (row.adRevenue || 0);
    });
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .filter(c => c.revenue > 0);
  }, [data]);

  const topCountries = useMemo(() => {
    if (countryRevenue.length <= 10) return countryRevenue;
    const top = countryRevenue.slice(0, 9);
    const others = countryRevenue.slice(9).reduce((acc, curr) => {
      acc.revenue += curr.revenue;
      acc.iap += curr.iap;
      acc.ad += curr.ad;
      return acc;
    }, { country: 'Other', revenue: 0, iap: 0, ad: 0 });
    return [...top, others].sort((a, b) => b.revenue - a.revenue);
  }, [countryRevenue]);

  const totalRevenue = useMemo(() => countryRevenue.reduce((sum, c) => sum + c.revenue, 0), [countryRevenue]);

  const handleExport = () => {
    const headers = ["排名", "国家/地区", "总收入", "内购收入", "广告收入", "收入占比"];
    const rows = countryRevenue.map((c, idx) => [
      idx + 1,
      c.country,
      c.revenue.toFixed(2),
      c.iap.toFixed(2),
      c.ad.toFixed(2),
      totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(2) + '%' : '0%'
    ]);
    exportToCsv(headers, rows, `country_revenue_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
             <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600 shadow-sm"><Globe className="w-5 h-5" /></div>
             <div>
               <h3 className="text-lg font-black text-slate-800 leading-tight">国家/地区收入分布</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Revenue by Country</p>
             </div>
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <Download className="w-3.5 h-3.5" /> 导出国家数据
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-[350px] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
               <PieIcon className="w-4 h-4 text-slate-400" />
               <h4 className="font-bold text-slate-600 text-sm">收入占比 (Top 10)</h4>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topCountries}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="revenue"
                  nameKey="country"
                >
                  {topCountries.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`, '收入']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="h-[350px] flex flex-col">
            <div className="flex items-center gap-2 mb-4">
               <BarChart3 className="w-4 h-4 text-slate-400" />
               <h4 className="font-bold text-slate-600 text-sm">收入构成 (Top 10)</h4>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCountries} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(v) => `$${v >= 1000 ? (v/1000)+'k' : v}`} />
                <YAxis dataKey="country" type="category" tick={{fontSize: 10, fill: '#64748b'}} width={80} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  formatter={(value: number, name: string) => [
                    `$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`, 
                    name === 'iap' ? '内购收入' : name === 'ad' ? '广告收入' : '总收入'
                  ]} 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="iap" name="内购收入" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={20} />
                <Bar dataKey="ad" name="广告收入" stackId="a" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider mb-4">国家收入明细表</h4>
        <div className="overflow-x-auto">
           <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-400 border-b border-slate-100">
                 <tr>
                    <th className="px-4 py-3 font-black uppercase tracking-tighter">排名</th>
                    <th className="px-4 py-3 font-black uppercase tracking-tighter">国家/地区</th>
                    <th className="px-4 py-3 font-black uppercase tracking-tighter text-right">总收入</th>
                    <th className="px-4 py-3 font-black uppercase tracking-tighter text-right">内购 (IAP)</th>
                    <th className="px-4 py-3 font-black uppercase tracking-tighter text-right">广告 (AD)</th>
                    <th className="px-4 py-3 font-black uppercase tracking-tighter text-right">占比</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                 {countryRevenue.map((c, idx) => (
                    <tr key={c.country} className="hover:bg-slate-50 transition-colors">
                       <td className="px-4 py-3 text-slate-500 font-bold">{idx + 1}</td>
                       <td className="px-4 py-3 font-bold text-slate-700">{c.country}</td>
                       <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                         ${c.revenue.toLocaleString(undefined, {maximumFractionDigits: 2})}
                       </td>
                       <td className="px-4 py-3 text-right font-mono text-blue-500">
                         ${c.iap.toLocaleString(undefined, {maximumFractionDigits: 2})}
                       </td>
                       <td className="px-4 py-3 text-right font-mono text-purple-500">
                         ${c.ad.toLocaleString(undefined, {maximumFractionDigits: 2})}
                       </td>
                       <td className="px-4 py-3 text-right font-mono font-bold text-slate-600">
                         {totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100).toFixed(2) : '0.00'}%
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

export default CountryRevenueView;
