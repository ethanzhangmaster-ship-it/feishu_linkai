
import React, { useMemo, useState } from 'react';
import { X, TrendingUp, TrendingDown, BrainCircuit, Activity, AlertCircle, ArrowRight, Target, ShieldCheck, AlertTriangle, Lightbulb, Share2, MapPin, Layout } from 'lucide-react';
import { ProcessedRow } from '../types';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProcessedRow[];
  dateRangeLabel: string;
}

interface PeriodMetrics {
  revenue: number;
  cost: number;
  profit: number;
  installs: number;
  cpi: number;
  roi: number;
}

interface DimensionDiagnosis {
  name: string;
  profitDelta: number;
  roiDelta: number;
  cpiDeltaPct: number;
  costDelta: number;
  isOrganic: boolean;
}

type AnalysisDimension = 'network' | 'country' | 'appName';

const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, data, dateRangeLabel }) => {
  const [dimension, setDimension] = useState<AnalysisDimension>('network');
  
  const analysis = useMemo(() => {
    if (!data || data.length === 0) return null;

    // 1. Sort & Split Data into two halves for comparison
    const sortedData = [...data].sort((a, b) => {
      const d1 = a.dateStr.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || a.dateStr;
      const d2 = b.dateStr.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || b.dateStr;
      return new Date(d1).getTime() - new Date(d2).getTime();
    });

    const uniqueDates = Array.from(new Set(sortedData.map(r => r.dateStr))).sort();
    if (uniqueDates.length < 2) return null;

    const midIndex = Math.floor(uniqueDates.length / 2);
    const prevDates = uniqueDates.slice(0, midIndex);
    const currDates = uniqueDates.slice(midIndex);

    const calcMetrics = (rows: ProcessedRow[]): PeriodMetrics => {
      const revenue = rows.reduce((acc, r) => acc + (r.totalRevenue || 0), 0);
      const cost = rows.reduce((acc, r) => acc + (r.cost || 0), 0);
      const installs = rows.reduce((acc, r) => acc + (r.installs || 0), 0);
      
      return {
        revenue,
        cost,
        profit: revenue - cost,
        installs,
        cpi: installs > 0 ? cost / installs : 0,
        roi: cost > 0 ? revenue / cost : 0
      };
    };

    const prevRows = sortedData.filter(r => prevDates.includes(r.dateStr));
    const currRows = sortedData.filter(r => currDates.includes(r.dateStr));

    const prevGlobal = calcMetrics(prevRows);
    const currGlobal = calcMetrics(currRows);

    // 2. Dimension Level Diagnosis
    const getDimensionValue = (row: ProcessedRow): string => {
        if (dimension === 'country') return row.country || 'Unknown';
        if (dimension === 'appName') return row.appName || 'Unknown App';
        return row.network || 'Unknown';
    };
    
    const uniqueItems = Array.from(new Set(data.map(r => getDimensionValue(r))));
    
    const itemDiagnoses: DimensionDiagnosis[] = uniqueItems.map((item: string) => {
      const pRows = prevRows.filter(r => getDimensionValue(r) === item);
      const cRows = currRows.filter(r => getDimensionValue(r) === item);
      
      const pM = calcMetrics(pRows);
      const cM = calcMetrics(cRows);
      
      return {
        name: item,
        profitDelta: cM.profit - pM.profit,
        costDelta: cM.cost - pM.cost,
        roiDelta: cM.roi - pM.roi,
        cpiDeltaPct: pM.cpi > 0 ? ((cM.cpi - pM.cpi) / pM.cpi) : 0,
        isOrganic: item.toLowerCase().includes('organic')
      };
    });

    const redList = [...itemDiagnoses].filter(n => n.profitDelta < 0).sort((a, b) => a.profitDelta - b.profitDelta).slice(0, 5);
    const greenList = [...itemDiagnoses].filter(n => n.profitDelta >= 0).sort((a, b) => b.profitDelta - a.profitDelta).slice(0, 5);

    // 3. Root Cause Analysis
    let rootCauseTitle = "";
    let rootCauseDesc = "";
    let specificAction = "";
    const profitDelta = currGlobal.profit - prevGlobal.profit;

    if (profitDelta < 0) {
      if (currGlobal.cost > prevGlobal.cost * 1.1 && currGlobal.revenue < prevGlobal.revenue * 1.05) {
        rootCauseTitle = "买量效率下降 (Inefficient Scale-up)";
        rootCauseDesc = "大盘消耗显著上涨，但收入产出未能达标。可能存在流量池过载、素材衰退或出价策略过激。";
        specificAction = "🎨 **素材与出价优化**: 1. 检查核心合作伙伴的 **点击率 (CTR)**。如果 CTR 下滑，请立即更新广告素材。 2. 分析 CPI 异常波动的地区，适当下调出价以筛选更高质量的流量。";
      } else if (currGlobal.cost <= prevGlobal.cost && currGlobal.revenue < prevGlobal.revenue * 0.9) {
        rootCauseTitle = "变现产出下滑 (Revenue Leakage)";
        rootCauseDesc = "获客成本相对稳定，但每个用户贡献的收入正在减少。建议从产品内变现逻辑入手分析。";
        specificAction = "🔧 **变现策略诊断**: 1. 检查广告聚合平台的 **eCPM** 走势。 2. 排查最近版本中是否由于数值调整导致 **留存率** 或 **付费意愿** 的连锁反应。";
      } else {
        rootCauseTitle = "大盘负向波动 (Profit Squeeze)";
        rootCauseDesc = "整体利润空间受到挤压。建议执行下方的“止损与优化”方案。";
      }
    } else {
      rootCauseTitle = "利润良性增长 (Profitable Growth)";
      rootCauseDesc = "整体业务表现强劲，目前的买量与变现策略协同良好。";
    }

    // 4. Action Plan Generation
    const actions: string[] = [];
    if (specificAction) actions.push(specificAction);

    if (currGlobal.cpi > prevGlobal.cpi * 1.1) {
      actions.push(`📉 **CPI 风险管控**: 全局 CPI 上涨 ${((currGlobal.cpi - prevGlobal.cpi)/prevGlobal.cpi*100).toFixed(1)}%。建议排查红榜${dimension === 'network' ? '合作伙伴' : dimension === 'country' ? '国家' : '应用'}。`);
    }

    if (redList.length > 0) {
      const worst = redList[0];
      actions.push(`🛑 **定向止损**: 针对 **${worst.name}**，利润贡献下滑了 $${Math.abs(Math.round(worst.profitDelta)).toLocaleString()}。建议减少该${dimension === 'network' ? '渠道' : dimension === 'country' ? '地区' : '应用'} 20% 的非核心预算。`);
    }

    if (greenList.length > 0 && currGlobal.roi > 1.2) {
      const best = greenList[0];
      actions.push(`🚀 **潜力扩量**: **${best.name}** 目前利润增长最稳健。在保持 ROI 的前提下，可尝试逐步提升 10-15% 的日预算测试弹性。`);
    }

    return {
      period: {
        prev: `${prevDates[0]}~${prevDates[prevDates.length - 1]}`,
        curr: `${currDates[0]}~${currDates[currDates.length - 1]}`
      },
      metrics: { prev: prevGlobal, curr: currGlobal },
      rootCause: { title: rootCauseTitle, desc: rootCauseDesc },
      lists: { red: redList, green: greenList },
      actions
    };
  }, [data, dimension]);

  if (!isOpen || !analysis) return null;

  const { metrics, rootCause, lists, actions } = analysis;

  const renderMetricCard = (label: string, prev: number, curr: number, isCurrency = false, isPercent = false, inverse = false) => {
    const delta = curr - prev;
    const isPos = delta > 0;
    const isGood = inverse ? !isPos : isPos;
    const colorClass = Math.abs(delta) < 0.0001 ? "text-slate-400" : isGood ? "text-green-600" : "text-red-500";
    
    return (
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 shadow-sm">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
        <div className="text-lg font-bold text-slate-800 font-mono">
          {isCurrency ? '$' : ''}{isPercent ? (curr*100).toFixed(2)+'%' : curr.toLocaleString(undefined, {maximumFractionDigits: 0})}
        </div>
        <div className={`text-xs font-semibold flex items-center gap-1 ${colorClass}`}>
          {isPos ? '▲' : '▼'} {isCurrency ? '$' : ''}{isPercent ? (Math.abs(delta)*100).toFixed(1)+'%' : Math.abs(delta).toLocaleString(undefined, {maximumFractionDigits: 0})}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col animate-in zoom-in duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-indigo-200 shadow-lg">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">利润波动深度诊断报告</h2>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                基准: {analysis.period.prev} <ArrowRight className="w-3 h-3"/> 当前: {analysis.period.curr}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8 no-scrollbar">
          
          {/* Main Diagnosis */}
          <div className={`p-5 rounded-2xl border-l-8 shadow-sm ${metrics.curr.profit < metrics.prev.profit ? 'bg-orange-50 border-orange-400 text-orange-900' : 'bg-emerald-50 border-emerald-500 text-emerald-900'}`}>
             <div className="flex items-start gap-4">
               {metrics.curr.profit < metrics.prev.profit ? <AlertTriangle className="w-8 h-8 shrink-0 text-orange-600"/> : <ShieldCheck className="w-8 h-8 shrink-0 text-emerald-600"/>}
               <div>
                 <h3 className="text-lg font-extrabold mb-1">{rootCause.title}</h3>
                 <p className="text-sm opacity-90 leading-relaxed">{rootCause.desc}</p>
               </div>
             </div>
          </div>

          {/* Core Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {renderMetricCard("总消耗 (Spend)", metrics.prev.cost, metrics.curr.cost, true, false, true)}
             {renderMetricCard("全局 CPI", metrics.prev.cpi, metrics.curr.cpi, true, false, true)}
             {renderMetricCard("大盘 ROI", metrics.prev.roi, metrics.curr.roi, false, true, false)}
             {renderMetricCard("周期利润 (Profit)", metrics.prev.profit, metrics.curr.profit, true, false, false)}
          </div>

          {/* Dimension Diagnosis */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
               <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                 <Target className="w-4 h-4 text-indigo-500" /> 
                 维度钻取分析 (Drill-down Analysis)
               </h4>
               <div className="bg-slate-100 p-1 rounded-xl flex border border-slate-200 shadow-inner">
                 <button 
                   onClick={() => setDimension('network')}
                   className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${dimension === 'network' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                 >
                   <Share2 className="w-3.5 h-3.5" /> 合作伙伴
                 </button>
                 <button 
                   onClick={() => setDimension('country')}
                   className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${dimension === 'country' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                 >
                   <MapPin className="w-3.5 h-3.5" /> 国家/地区
                 </button>
                 <button 
                   onClick={() => setDimension('appName')}
                   className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${dimension === 'appName' ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
                 >
                   <Layout className="w-3.5 h-3.5" /> 应用名称
                 </button>
               </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Negative List */}
              <div className="bg-white border border-red-100 rounded-2xl overflow-hidden shadow-sm">
                 <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center gap-2">
                   <AlertCircle className="w-4 h-4 text-red-600" />
                   <h4 className="font-bold text-red-800 text-xs uppercase">📉 利润负向波动榜 (Negative)</h4>
                 </div>
                 <div className="p-0">
                   <table className="w-full text-[11px] text-left">
                     <thead className="bg-slate-50/50 text-slate-400">
                       <tr>
                         <th className="p-3">名称</th>
                         <th className="p-3 text-right">利润变化</th>
                         <th className="p-3 text-right">ROI 变化</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {lists.red.length ? lists.red.map(item => (
                         <tr key={item.name} className="hover:bg-red-50/30 transition-colors">
                           <td className="p-3 font-bold text-slate-700 truncate max-w-[120px]">{item.name}</td>
                           <td className="p-3 text-right font-mono font-bold text-red-600">-${Math.abs(Math.round(item.profitDelta)).toLocaleString()}</td>
                           <td className="p-3 text-right font-mono text-slate-500">{(item.roiDelta * 100).toFixed(1)}%</td>
                         </tr>
                       )) : (
                         <tr><td colSpan={3} className="p-6 text-center text-slate-400 italic">暂无负向贡献数据</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
              </div>

              {/* Positive List */}
              <div className="bg-white border border-emerald-100 rounded-2xl overflow-hidden shadow-sm">
                 <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex items-center gap-2">
                   <TrendingUp className="w-4 h-4 text-emerald-600" />
                   <h4 className="font-bold text-emerald-800 text-xs uppercase">📈 利润正向贡献榜 (Positive)</h4>
                 </div>
                 <div className="p-0">
                   <table className="w-full text-[11px] text-left">
                     <thead className="bg-slate-50/50 text-slate-400">
                       <tr>
                         <th className="p-3">名称</th>
                         <th className="p-3 text-right">利润变化</th>
                         <th className="p-3 text-right">ROI 变化</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                       {lists.green.length ? lists.green.map(item => (
                         <tr key={item.name} className="hover:bg-emerald-50/30 transition-colors">
                           <td className="p-3 font-bold text-slate-700 truncate max-w-[120px]">{item.name}</td>
                           <td className="p-3 text-right font-mono font-bold text-emerald-600">+${Math.round(item.profitDelta).toLocaleString()}</td>
                           <td className={`p-3 text-right font-mono ${item.roiDelta >= 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                             {item.roiDelta > 0 ? '+' : ''}{(item.roiDelta * 100).toFixed(1)}%
                           </td>
                         </tr>
                       )) : (
                         <tr><td colSpan={3} className="p-6 text-center text-slate-400 italic">暂无正向贡献数据</td></tr>
                       )}
                     </tbody>
                   </table>
                 </div>
              </div>
            </div>
          </section>

          {/* Actionable Insights */}
          <section className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100 shadow-sm">
            <h4 className="text-sm font-bold text-indigo-800 mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              投放策略优化建议 (Optimization Roadmap)
            </h4>
            <div className="grid gap-3">
              {actions.map((action, idx) => (
                <div key={idx} className="flex gap-4 text-sm text-slate-700 bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-indigo-50 shadow-sm group hover:border-indigo-200 transition-all">
                   <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                     {idx + 1}
                   </span>
                   <div className="leading-relaxed pt-1" dangerouslySetInnerHTML={{ 
                     __html: action.replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-bold">$1</strong>') 
                   }} />
                </div>
              ))}
            </div>
          </section>

        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-between items-center px-6">
            <span className="text-[10px] text-slate-400 font-medium italic">
              * 诊断报告基于 Adjust Automate 接口实时数据通过内置 BI 模型计算生成，仅供决策参考。
            </span>
            <button 
              onClick={onClose}
              className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all text-sm"
            >
              完成诊断
            </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisModal;
