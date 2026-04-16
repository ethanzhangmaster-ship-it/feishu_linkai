
import React, { useState, useMemo, useEffect } from 'react';
import { ProcessedRow } from '../types';
import { Download, Smartphone, Filter, Search, X, Share2, ChevronDown } from 'lucide-react';
import { BASIC_TABLE_HEADERS, ROI_TABLE_HEADERS, ROI_NETWORK_TABLE_HEADERS, RETENTION_TABLE_HEADERS, RETENTION_NETWORK_TABLE_HEADERS, SPEND_DETAILS_TABLE_HEADERS, SPEND_DAILY_TABLE_HEADERS, PERIOD_SUMMARY_HEADERS } from '../constants';
import { exportToCsv } from '../utils/csvExport';

interface DataTableProps {
  data: ProcessedRow[];
  activeBlockId: string;
}

const getStoreIcon = (store: string) => {
  const s = (store || '').toLowerCase();
  if (s.includes('google') || s === 'android') return <span className="text-green-600 text-[10px] font-bold px-2 py-0.5 bg-green-50 border border-green-100 rounded-lg">Android</span>;
  if (s.includes('itunes') || s.includes('ios')) return <span className="text-blue-600 text-[10px] font-bold px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-lg">iOS</span>;
  return <span className="text-slate-400 text-[10px] px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-lg uppercase">{store || '-'}</span>;
};

const DataTable: React.FC<DataTableProps> = ({ data, activeBlockId }) => {
  // Generate a unique storage key for this specific data block
  const storageKey = `adjust_datatable_state_${activeBlockId}`;

  // Initialize state from sessionStorage if available
  const [localSearch, setLocalSearch] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved).search || '' : '';
    } catch {
      return '';
    }
  });

  const [selectedNetwork, setSelectedNetwork] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved).network || '' : '';
    } catch {
      return '';
    }
  });

  // Persist state changes to sessionStorage
  useEffect(() => {
    const state = { search: localSearch, network: selectedNetwork };
    sessionStorage.setItem(storageKey, JSON.stringify(state));
  }, [localSearch, selectedNetwork, storageKey]);

  // Extract unique network options for the local filter
  const networkOptions = useMemo(() => {
    return Array.from(new Set(data.map(r => r.network))).filter(Boolean).sort();
  }, [data]);

  // Apply local search and network filter on top of incoming data
  const filteredRows = useMemo(() => {
    let rows = data;
    
    if (localSearch.trim()) {
      const term = localSearch.toLowerCase().trim();
      rows = rows.filter(row => 
        (row.appName || '').toLowerCase().includes(term)
      );
    }

    if (selectedNetwork) {
      rows = rows.filter(row => row.network === selectedNetwork);
    }

    return rows;
  }, [data, localSearch, selectedNetwork]);

  // Logic to determine table structure based on the active block ID
  const isRoi = activeBlockId.includes('roi');
  const isRetention = activeBlockId.includes('retention');
  const isSpendDetails = activeBlockId === 'block_spend_details';
  const hasNetwork = activeBlockId.includes('network') || isSpendDetails;
  const showCost = !isRetention;

  // Select appropriate headers
  let headers = BASIC_TABLE_HEADERS;
  if (activeBlockId === 'block_roi_network') headers = ROI_NETWORK_TABLE_HEADERS;
  else if (activeBlockId === 'block_roi') headers = ROI_TABLE_HEADERS;
  else if (activeBlockId === 'block_retention_network') headers = RETENTION_NETWORK_TABLE_HEADERS;
  else if (activeBlockId === 'block_retention') headers = RETENTION_TABLE_HEADERS;
  else if (activeBlockId === 'block_spend_details') headers = SPEND_DETAILS_TABLE_HEADERS;

  const handleExportCsv = () => {
    if (!filteredRows.length) return;
    const rows = filteredRows.map(row => {
      const values: any[] = [row.dateStr, row.appName || 'Unknown App'];
      if (hasNetwork) values.push(row.network);
      if (isSpendDetails) values.push(row.campaignName);
      if (showCost) values.push(row.cost);
      if (isRetention) values.push(row.installs, row.retention1, row.retention2, row.retention3, row.retention4, row.retention5, row.retention6, row.retention7, row.retention14, row.retention20);
      else if (isRoi) values.push(row.roi, row.roiD1, row.roiD2, row.roiD3, row.roiD4, row.roiD5, row.roiD6, row.roiD13, row.roiD20);
      else if (isSpendDetails) values.push(row.installs, row.cpa);
      else values.push(row.totalRevenue, row.installs, row.cpa, (row.roi * 100).toFixed(2) + '%', row.arpu, row.userPayCost, row.paidInstalls, row.paidArppu, row.cohortRevenue, (row.payRate * 100).toFixed(2) + '%', (row.retention1 * 100).toFixed(2) + '%');
      return values;
    });
    exportToCsv(headers, rows, `adjust_${activeBlockId}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const renderPercentCell = (val: number | undefined, good = 1.0, ok = 0.5) => {
    if (val === undefined || val === null) return '-';
    const percent = val * 100;
    const color = percent >= (good * 100) ? 'text-green-600 font-bold' : percent >= (ok * 100) ? 'text-blue-600' : 'text-red-600 font-semibold';
    return <span className={`font-mono ${color}`}>{percent.toFixed(2)}%</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
             <Filter className="w-4 h-4 text-slate-400" />
             <span className="text-[11px] font-black text-slate-500 uppercase tracking-tighter">匹配结果 ({filteredRows.length})</span>
          </div>
          
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text"
              placeholder="搜索应用..."
              className="pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-400 transition-all min-w-[180px]"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
            {localSearch && (
              <button 
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>

          <div className="relative group">
            <Share2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <select
              className="pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none min-w-[140px] cursor-pointer hover:border-blue-300 transition-all"
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
            >
              <option value="">所有合作伙伴</option>
              {networkOptions.map(net => (
                <option key={net} value={net}>{net}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {(localSearch || selectedNetwork) && (
            <button 
              onClick={() => { setLocalSearch(''); setSelectedNetwork(''); }}
              className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> 清除
            </button>
          )}
        </div>

        <button 
          onClick={handleExportCsv}
          disabled={filteredRows.length === 0}
          className="flex items-center gap-2 px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-30 whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          导出当前 CSV
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                {headers.map((header, idx) => (
                  <th key={idx} className="px-5 py-4 font-bold whitespace-nowrap text-[11px] uppercase tracking-wider">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                       <div className="bg-slate-50 p-6 rounded-full"><Search className="w-12 h-12 text-slate-200" /></div>
                       <div className="space-y-1">
                         <span className="text-slate-600 block font-bold">无匹配数据</span>
                         <span className="text-slate-400 text-xs">尝试更换搜索词或选择其他合作伙伴。</span>
                       </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-700 whitespace-nowrap font-mono text-xs">{row.dateStr}</td>
                    <td className="px-5 py-3.5 font-extrabold text-blue-600 truncate max-w-[180px]">{row.appName || 'Unknown App'}</td>
                    
                    {hasNetwork && <td className="px-5 py-3.5 font-bold text-slate-600 text-xs">{row.network}</td>}
                    {isSpendDetails && (
                      <td className="px-5 py-3.5 text-[10px] text-slate-600 truncate max-w-[150px]">{row.campaignName}</td>
                    )}
                    {showCost && <td className="px-5 py-3.5 text-right font-mono text-red-500 font-bold">${row.cost.toLocaleString()}</td>}
                    {isRetention ? (
                      <>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-700">{row.installs.toLocaleString()}</td>
                        {[1,2,3,4,5,6,7,14,20].map(d => (
                          <td key={d} className="px-5 py-3.5 text-right">
                            {renderPercentCell((row as any)[`retention${d}`], 0.4, 0.2)}
                          </td>
                        ))}
                      </>
                    ) : isRoi ? (
                      <>
                        <td className="px-5 py-3.5 text-right">{renderPercentCell(row.roi, 1.0, 0.5)}</td>
                        {[1,2,3,4,5,6,13,20].map(d => (
                          <td key={d} className="px-5 py-3.5 text-right">
                            {renderPercentCell((row as any)[`roiD${d}`], 1.2, 0.7)}
                          </td>
                        ))}
                      </>
                    ) : isSpendDetails ? (
                      <>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-700">{row.installs.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-800">${row.cpa}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-3.5 text-right font-mono text-emerald-600 font-bold">${row.totalRevenue.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-700">{row.installs.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-800 font-bold">${row.cpa}</td>
                        <td className="px-5 py-3.5 text-right">{renderPercentCell(row.roi, 1.0, 0.5)}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-600 text-xs">${row.arpu}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-red-400 text-xs">${row.userPayCost}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-600 text-xs">{row.paidInstalls}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-600 text-xs">${row.paidArppu}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-blue-500 font-bold">${row.cohortRevenue}</td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-600 text-xs">{(row.payRate * 100).toFixed(2)}%</td>
                        <td className="px-5 py-3.5 text-right">{renderPercentCell(row.retention1, 0.4, 0.2)}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
