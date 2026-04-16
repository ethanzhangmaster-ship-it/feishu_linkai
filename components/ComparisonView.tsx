
import React, { useMemo, useState } from 'react';
import { ProcessedRow } from '../types';
import { 
  Search, 
  CheckSquare, 
  Square, 
  Trophy, 
  TrendingUp, 
  DollarSign, 
  Zap,
  BarChart,
  Target,
  Download
} from 'lucide-react';
import { exportToCsv } from '../utils/csvExport';

interface ComparisonViewProps {
  data: ProcessedRow[];
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApps, setSelectedApps] = useState<string[]>([]);

  // 聚合所有应用的基础数据
  const appAggregates = useMemo(() => {
    const map = new Map<string, any>();
    data.forEach(row => {
      const name = row.appName || 'Unknown';
      if (!map.has(name)) {
        map.set(name, {
          name,
          cost: 0,
          revenue: 0,
          installs: 0,
          roi: 0,
          cpa: 0,
          retention1: 0,
          adRevenue: 0,
          iapRevenue: 0,
          rowsCount: 0
        });
      }
      const entry = map.get(name);
      entry.cost += row.cost;
      entry.revenue += row.totalRevenue;
      entry.installs += row.installs;
      entry.adRevenue += row.adRevenue;
      entry.iapRevenue += row.iapRevenue;
      entry.retention1 += row.retention1;
      entry.rowsCount += 1;
    });

    return Array.from(map.values()).map(item => ({
      ...item,
      roi: item.cost > 0 ? (item.revenue / item.cost) : 0,
      cpa: item.installs > 0 ? (item.cost / item.installs) : 0,
      avgRetention: item.rowsCount > 0 ? (item.retention1 / item.rowsCount) : 0
    }));
  }, [data]);

  const filteredApps = useMemo(() => {
    return appAggregates.filter(app => 
      app.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => b.revenue - a.revenue);
  }, [appAggregates, searchTerm]);

  const toggleApp = (name: string) => {
    setSelectedApps(prev => 
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    );
  };

  const selectedData = useMemo(() => {
    return appAggregates.filter(app => selectedApps.includes(app.name));
  }, [appAggregates, selectedApps]);

  // 计算优胜指标
  const champions = useMemo(() => {
    if (selectedData.length === 0) return {};
    return {
      revenue: [...selectedData].sort((a, b) => b.revenue - a.revenue)[0].name,
      roi: [...selectedData].sort((a, b) => b.roi - a.roi)[0].name,
      cpa: [...selectedData].sort((a, b) => a.cpa - b.cpa)[0].name,
      installs: [...selectedData].sort((a, b) => b.installs - a.installs)[0].name,
      retention: [...selectedData].sort((a, b) => b.avgRetention - a.avgRetention)[0].name
    };
  }, [selectedData]);

  const handleExportAggregate = () => {
    if (!selectedData.length) return;
    const headers = ["应用名称", "消耗", "总收入", "内购收入", "广告收入", "ROI", "安装数", "CPI", "平均1日留存"];
    const rows = selectedData.map(app => [
      app.name, 
      app.cost.toFixed(2), 
      app.revenue.toFixed(2),
      app.iapRevenue.toFixed(2),
      app.adRevenue.toFixed(2),
      (app.roi * 100).toFixed(2) + '%',
      app.installs,
      app.cpa.toFixed(2),
      (app.avgRetention * 100).toFixed(2) + '%'
    ]);
    exportToCsv(headers, rows, `app_comparison_summary_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="flex gap-6 min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 左侧应用选择器 */}
      <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden sticky top-20 h-[calc(100vh-100px)]">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" /> 选择对比应用
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="搜索应用名称..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
          {filteredApps.map(app => (
            <button
              key={app.name}
              onClick={() => toggleApp(app.name)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all mb-1 text-left
                ${selectedApps.includes(app.name) ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'}`}
            >
              {selectedApps.includes(app.name) ? 
                <CheckSquare className="w-5 h-5 text-blue-600 shrink-0" /> : 
                <Square className="w-5 h-5 text-slate-300 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${selectedApps.includes(app.name) ? 'text-blue-700' : 'text-slate-700'}`}>
                  {app.name}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  ${app.revenue.toLocaleString()} Rev
                </p>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center shrink-0">
           <p className="text-[10px] text-slate-400 font-medium">已选择 {selectedApps.length} 个应用</p>
        </div>
      </div>

      {/* 右侧对比区域 */}
      <div className="flex-1 space-y-8 pb-12 overflow-y-auto">
        {selectedApps.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 h-[400px] flex flex-col items-center justify-center text-slate-400 p-8 text-center">
             <div className="bg-slate-50 p-6 rounded-full mb-4">
                <BarChart className="w-12 h-12 text-slate-200" />
             </div>
             <h3 className="text-lg font-bold text-slate-600 mb-2">开启多应用对标</h3>
             <p className="max-w-xs text-sm leading-relaxed">
               从左侧勾选您想要对比的应用，我们将为您生成多维度的 KPI 对比矩阵。
             </p>
          </div>
        ) : (
          /* 对比矩阵部分 */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                对比分析矩阵
              </h2>
              <button 
                onClick={handleExportAggregate}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" /> 导出对比概览
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {selectedData.map(app => (
                 <div key={app.name} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-all">
                    <div className="bg-slate-900 p-4 text-white">
                       <h3 className="font-bold truncate text-lg">{app.name}</h3>
                       <div className="flex gap-2 mt-2">
                          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            ${app.cost.toLocaleString()} Cost
                          </span>
                       </div>
                    </div>

                    <div className="p-5 space-y-4">
                       <div className="flex items-center justify-between group">
                          <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-emerald-50 rounded-lg"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
                             <span className="text-sm font-medium text-slate-500">ROI (D0)</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className={`text-lg font-mono font-bold ${app.roi >= 1 ? 'text-emerald-600' : 'text-orange-500'}`}>
                               {(app.roi * 100).toFixed(1)}%
                             </span>
                             {champions.roi === app.name && <span title="该指标冠军"><Trophy className="w-4 h-4 text-yellow-500" /></span>}
                          </div>
                       </div>

                       <div className="flex items-center justify-between group">
                          <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-red-50 rounded-lg"><DollarSign className="w-4 h-4 text-red-600" /></div>
                             <span className="text-sm font-medium text-slate-500">CPI (Avg)</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <span className="text-lg font-mono font-bold text-slate-800">
                               ${app.cpa.toFixed(2)}
                             </span>
                             {champions.cpa === app.name && <span title="该指标冠军"><Trophy className="w-4 h-4 text-yellow-500" /></span>}
                          </div>
                       </div>

                       <div className="pt-4 border-t border-slate-100 space-y-2">
                          <div className="flex justify-between text-xs">
                             <span className="text-slate-400">总收入分层</span>
                             <span className="font-bold text-slate-700">${app.revenue.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
                             <div className="bg-blue-500 h-full" style={{ width: `${(app.iapRevenue / app.revenue) * 100}%` }}></div>
                             <div className="bg-purple-500 h-full" style={{ width: `${(app.adRevenue / app.revenue) * 100}%` }}></div>
                          </div>
                          <div className="flex justify-between text-[10px]">
                             <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>IAP ({(app.iapRevenue / app.revenue * 100).toFixed(0)}%)</span>
                             <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span>Ads ({(app.adRevenue / app.revenue * 100).toFixed(0)}%)</span>
                          </div>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparisonView;
