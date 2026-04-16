
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Table } from 'lucide-react';

const RoiReferenceTable: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Data extraction from the user provided image
  const headers = [
    "投放策略/版本变化日志", "累计回收", "总消耗", "总收入", 
    "首日ROI", "2日ROI", "3日ROI", "4日ROI", "5日ROI", "6日ROI", "7日ROI", "14日ROI", "21日ROI",
    "2日倍率", "3日倍率", "4日倍率", "5日倍率", "6日倍率", "7日倍率", "14日倍率", "21日倍率",
    "3/2", "7/2", "14/7"
  ];

  const rows = [
    {
      name: "GG历史回收模型",
      recovery: "126.44%", cost: "975626.23", revenue: "1233533.45",
      roi: ["8.21%", "11.51%", "13.99%", "15.97%", "17.75%", "19.35%", "21.02%", "29.86%", "36.67%"],
      multiplier: ["1.40", "1.70", "1.95", "2.16", "2.36", "2.56", "3.64", "4.47"],
      ratios: ["1.22", "1.83", "1.42"]
    },
    {
      name: "60天回本模型",
      recovery: "276.18%", cost: "19337.77", revenue: "53406.94",
      roi: ["23.86%", "32.35%", "38.20%", "40.92%", "44.72%", "47.28%", "51.63%", "66.20%", "84.85%"],
      multiplier: ["1.36", "1.60", "1.71", "1.87", "1.98", "2.16", "2.77", "3.56"],
      ratios: ["1.18", "1.60", "1.28"]
    },
    {
      name: "90天回本同60天一致",
      recovery: "", cost: "", revenue: "",
      roi: Array(9).fill(""), multiplier: Array(8).fill(""), ratios: Array(3).fill("")
    },
    {
      name: "美国回收模型（6个月回本）",
      recovery: "143.94%", cost: "450904.61", revenue: "649054.58",
      roi: ["9.12%", "12.66%", "15.32%", "17.66%", "19.70%", "21.44%", "23.39%", "33.39%", "41.10%"],
      multiplier: ["1.39", "1.68", "1.94", "2.16", "2.35", "2.56", "3.66", "4.51"],
      ratios: ["1.21", "1.85", "1.43"]
    },
    {
      name: "项目2",
      isHeader: true,
      recovery: "", cost: "", revenue: "",
      roi: Array(9).fill(""), multiplier: Array(8).fill(""), ratios: Array(3).fill("")
    },
    {
      name: "合计",
      recovery: "145.05%", cost: "1,259,846.24", revenue: "1,827,421.26",
      roi: ["12.19%", "16.09%", "19.34%", "22.14%", "24.73%", "27.16%", "29.53%", "42.43%", "51.41%"],
      multiplier: ["1.32", "1.59", "1.82", "2.03", "2.23", "2.42", "3.48", "4.22"],
      ratios: ["1.20", "1.84", "1.44"]
    },
    {
      name: "四个回本模型（历史数据）",
      recovery: "144.20%", cost: "953171.36", revenue: "1374515.51",
      roi: ["11.95%", "15.91%", "19.16%", "21.92%", "24.46%", "26.78%", "29.08%", "42.06%", "51.21%"],
      multiplier: ["1.33", "1.60", "1.83", "2.05", "2.24", "2.43", "3.52", "4.28"],
      ratios: ["1.20", "1.83", "1.45"]
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden mb-6 sticky top-16 z-30">
      <div 
        className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Table className="w-4 h-4 text-emerald-600" />
          回收模型参考数据 (Reference Model)
        </h3>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </div>
      
      {isExpanded && (
        <div className="overflow-x-auto max-h-[40vh] overflow-y-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#e2efda] text-slate-800 shadow-sm">
                <th className="border border-slate-300 px-2 py-1 min-w-[150px] text-left">投放策略/版本变化日志</th>
                <th className="border border-slate-300 px-2 py-1 bg-[#fff2cc]">累计回收</th>
                <th className="border border-slate-300 px-2 py-1">总消耗</th>
                <th className="border border-slate-300 px-2 py-1">总收入</th>
                
                {/* ROI Headers */}
                <th className="border border-slate-300 px-1 py-1 bg-[#d0cece]">首日ROI</th>
                {[2,3,4,5,6,7,14,21].map(d => (
                  <th key={`h-roi-${d}`} className="border border-slate-300 px-1 py-1 bg-[#d0cece]">{d}日ROI</th>
                ))}
                
                {/* Multiplier Headers */}
                {[2,3,4,5,6,7,14,21].map(d => (
                   <th key={`h-mult-${d}`} className="border border-slate-300 px-1 py-1 bg-[#fff2cc]">{d}日倍率</th>
                ))}

                {/* Ratio Headers */}
                <th className="border border-slate-300 px-1 py-1 bg-[#fce4d6]">3/2</th>
                <th className="border border-slate-300 px-1 py-1 bg-[#fce4d6]">7/2</th>
                <th className="border border-slate-300 px-1 py-1 bg-[#fce4d6]">14/7</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                if (row.isHeader) {
                   return (
                     <tr key={idx} className="bg-slate-50 font-bold">
                       <td className="border border-slate-300 px-2 py-1" colSpan={24}>{row.name}</td>
                     </tr>
                   )
                }
                return (
                  <tr key={idx} className="hover:bg-blue-50 transition-colors bg-white">
                    <td className="border border-slate-300 px-2 py-1 font-medium whitespace-nowrap">{row.name}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right bg-[#fff2cc]">{row.recovery}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{row.cost}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{row.revenue}</td>
                    
                    {row.roi.map((val, i) => (
                      <td key={`roi-${i}`} className="border border-slate-300 px-1 py-1 text-right bg-[#f2f2f2]">{val}</td>
                    ))}
                    
                    {row.multiplier.map((val, i) => (
                      <td key={`mult-${i}`} className="border border-slate-300 px-1 py-1 text-right bg-[#fff9e6]">{val}</td>
                    ))}
                    
                    {row.ratios.map((val, i) => (
                      <td key={`ratio-${i}`} className="border border-slate-300 px-1 py-1 text-right bg-[#fff0e6]">{val}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RoiReferenceTable;
