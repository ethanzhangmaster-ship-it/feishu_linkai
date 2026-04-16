
import React from 'react';
import { ProcessedRow } from '../types';
import { DollarSign, Users, TrendingUp, Activity, Wallet, PiggyBank, CreditCard } from 'lucide-react';

interface SummaryCardsProps {
  data: ProcessedRow[];
}

// Helper for Net Calculation (Duplicated from RankingView for component isolation)
const getNetFactor = (store: string) => {
  const s = (store || '').toLowerCase();
  if (s.includes('amazon')) return 0.8;
  if (s.includes('google') || s.includes('android') || s.includes('play')) return 0.85; // 15% cut for Android
  if (s === 'ios' || s.includes('apple') || s.includes('itunes')) return 0.7; // 30% cut
  return 0.7; 
};

const SummaryCards: React.FC<SummaryCardsProps> = ({ data }) => {
  if (!data) return null;

  const stats = data.reduce((acc, row) => {
    // Standard Metrics
    const cost = row.cost || 0;
    const grossRev = row.totalRevenue || 0;
    const grossIap = row.iapRevenue || 0;
    const adRev = row.adRevenue || 0;
    
    // Net Calculation Logic
    const rate = getNetFactor(row.storeType);
    const netIap = grossIap * rate;
    const netTotalRev = netIap + adRev;
    
    // Profit Logic: 
    // If Gross Profit < 0 (Loss), Net Profit = Gross Profit (Actual Loss)
    // If Gross Profit >= 0 (Profit), Net Profit = Net Revenue - Cost
    const grossProfit = grossRev - cost;
    const standardNetProfit = netTotalRev - cost;
    const netProfit = grossProfit < 0 ? grossProfit : standardNetProfit;

    return {
        cost: acc.cost + cost,
        grossRev: acc.grossRev + grossRev,
        netRev: acc.netRev + netTotalRev,
        grossProfit: acc.grossProfit + grossProfit,
        netProfit: acc.netProfit + netProfit,
        grossIap: acc.grossIap + grossIap,
        netIap: acc.netIap + netIap,
        ad: acc.ad + adRev,
    };
  }, { cost: 0, grossRev: 0, netRev: 0, grossProfit: 0, netProfit: 0, grossIap: 0, netIap: 0, ad: 0 });

  // ROI Calculations
  const grossRoi = stats.cost > 0 ? (stats.grossRev / stats.cost) : 0;
  const netRoi = stats.cost > 0 ? (stats.netRev / stats.cost) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      {/* 1. Spend */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3"/> 总消耗 (Spend)
         </span>
         <div className="text-xl font-bold text-red-500 font-mono">
            ${stats.cost.toLocaleString(undefined, {maximumFractionDigits: 0})}
         </div>
      </div>

      {/* 2. Revenue */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3"/> 总收入 (Gross)
         </span>
         <div className="flex items-baseline gap-2">
           <div className="text-xl font-black text-emerald-600 font-mono">
              ${stats.grossRev.toLocaleString(undefined, {maximumFractionDigits: 0})}
           </div>
           <div className="text-[10px] text-slate-400 font-mono">
              Net: ${stats.netRev.toLocaleString(undefined, {maximumFractionDigits: 0})}
           </div>
         </div>
      </div>

      {/* 3. Profit */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <PiggyBank className="w-3 h-3"/> 总利润 (Gross)
         </span>
         <div className="flex items-baseline gap-2">
           <div className={`text-xl font-black font-mono ${stats.grossProfit >= 0 ? 'text-indigo-600' : 'text-orange-500'}`}>
              {stats.grossProfit < 0 ? '-' : ''}${Math.abs(stats.grossProfit).toLocaleString(undefined, {maximumFractionDigits: 0})}
           </div>
           <div className="text-[10px] text-slate-400 font-mono">
              Net: ${stats.netProfit.toLocaleString(undefined, {maximumFractionDigits: 0})}
           </div>
         </div>
      </div>

      {/* 4. ROI */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <Activity className="w-3 h-3"/> ROI (Gross)
         </span>
         <div className="flex items-baseline gap-2">
            <div className={`text-xl font-bold font-mono ${grossRoi >= 1 ? 'text-emerald-600' : 'text-orange-500'}`}>
                {(grossRoi * 100).toFixed(0)}%
            </div>
            <div className={`text-[10px] font-mono ${netRoi >= 1 ? 'text-emerald-600' : 'text-slate-400'}`}>
                Net: {(netRoi * 100).toFixed(0)}%
            </div>
         </div>
      </div>

      {/* 5. IAP */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <CreditCard className="w-3 h-3"/> 内购 (IAP)
         </span>
         <div className="flex items-baseline gap-2">
            <div className="text-lg font-bold text-blue-600 font-mono">
                ${stats.grossIap.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
                Net: ${stats.netIap.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </div>
         </div>
      </div>

      {/* 6. Ad */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
            <Wallet className="w-3 h-3"/> 广告 (AD)
         </span>
         <div className="text-lg font-bold text-purple-600 font-mono">
            ${stats.ad.toLocaleString(undefined, {maximumFractionDigits: 0})}
         </div>
      </div>
    </div>
  );
};

export default SummaryCards;
