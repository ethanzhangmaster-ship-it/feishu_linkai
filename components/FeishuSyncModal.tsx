
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Loader2, 
  Send, 
  Layers, 
  Box, 
  Check, 
  Square, 
  FileSpreadsheet, 
  RefreshCcw, 
  ChevronDown, 
  History,
  Clock,
  ArrowRight
} from 'lucide-react';
import { AppConfig, ProcessedRow, FeishuDestination } from '../types';
import { fetchApps, fetchAndProcessData } from '../services/adjustService';
import { syncToFeishu, getSpreadsheetSheets } from '../services/feishuService';

interface FeishuSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onConfigUpdate: (config: AppConfig) => void;
  currentData: ProcessedRow[];
}

const FeishuSyncModal: React.FC<FeishuSyncModalProps> = ({ isOpen, onClose, config, onConfigUpdate, currentData }) => {
  const [loadingApps, setLoadingApps] = useState(false);
  const [availableApps, setAvailableApps] = useState<{name: string}[]>([]);
  const [selectedApps, setSelectedApps] = useState<string[]>(config.feishu_config.selected_apps || []);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>(config.feishu_config.selected_blocks && config.feishu_config.selected_blocks.length > 0 ? config.feishu_config.selected_blocks : config.data_blocks.filter(b => b.id.endsWith('_80')).map(b => b.id));
  
  const [targetToken, setTargetToken] = useState(config.feishu_config.spreadsheet_token || '');
  const [targetSheetId, setTargetSheetId] = useState('auto');
  const [availableSheets, setAvailableSheets] = useState<{title: string, sheet_id: string}[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{current: number, total: number, msg: string} | null>(null);

  useEffect(() => {
    if (isOpen) {
      const loadAllApps = async () => {
        setLoadingApps(true);
        try {
          const appsFromData = Array.from(new Set(currentData.map(r => r.appName || ''))).filter(Boolean).map(name => ({ name }));
          if (appsFromData.length > 0) {
            setAvailableApps(appsFromData);
          } else {
            const apps = await fetchApps(config.adjust_api.user_token, config.adjust_api.use_proxy);
            setAvailableApps(apps);
          }
        } catch (e) {
          console.error("Failed to load apps", e);
        } finally {
          setLoadingApps(false);
        }
      };
      loadAllApps();
      if (targetToken) handleFetchSheets();
    }
  }, [isOpen]);

  const handleFetchSheets = async () => {
    if (!targetToken) return;
    setLoadingSheets(true);
    try {
      const sheets = await getSpreadsheetSheets(config, targetToken);
      setAvailableSheets(sheets);
      if (targetSheetId !== 'auto' && sheets.length > 0 && !sheets.find(s => s.sheet_id === targetSheetId)) {
        setTargetSheetId(sheets[0].sheet_id);
      }
    } catch (e: any) {
      console.error("Fetch sheets failed", e);
    } finally {
      setLoadingSheets(false);
    }
  };

  const applyHistory = (dest: FeishuDestination) => {
    setTargetToken(dest.token);
    setTargetSheetId(dest.sheetId);
    setShowHistory(false);
    // 自动刷新一下该 Token 下的子表列表
    setLoadingSheets(true);
    getSpreadsheetSheets(config, dest.token).then(setAvailableSheets).finally(() => setLoadingSheets(false));
  };

  if (!isOpen) return null;

  const handleStartSync = async () => {
    if (selectedApps.length === 0 || selectedBlocks.length === 0) {
      alert("请至少选择一个应用和一个数据维度");
      return;
    }
    if (!targetToken || !targetSheetId) {
      alert("请填写目的地表格信息");
      return;
    }

    setSyncing(true);
    let allProcessedData: ProcessedRow[] = [];

    try {
      const dateInputs = document.querySelectorAll('input[type="date"]');
      const start = (dateInputs[0] as HTMLInputElement)?.value;
      const end = (dateInputs[1] as HTMLInputElement)?.value;

      for (let i = 0; i < selectedBlocks.length; i++) {
        const blockId = selectedBlocks[i];
        const block = config.data_blocks.find(b => b.id === blockId);
        if (!block) continue;
        setProgress({ current: i + 1, total: selectedBlocks.length + 1, msg: `正在提取: ${block.name}...` });
        
        const blockData = await fetchAndProcessData(config, block, start, end);
        const filtered = blockData.filter(r => selectedApps.includes(r.appName || ''));
        allProcessedData.push(...filtered);
      }

      setProgress({ current: selectedBlocks.length + 1, total: selectedBlocks.length + 1, msg: '正在加密传输至飞书...' });
      await syncToFeishu(config, allProcessedData, targetToken, targetSheetId);

      const currentSheetName = availableSheets.find(s => s.sheet_id === targetSheetId)?.title || '未知子表';
      const newDest: FeishuDestination = {
        token: targetToken,
        sheetId: targetSheetId,
        sheetName: currentSheetName,
        lastUsed: new Date().toLocaleString()
      };

      const existingHistory = config.feishu_config.recent_destinations || [];
      const updatedHistory = [newDest, ...existingHistory.filter(h => h.token !== targetToken || h.sheetId !== targetSheetId)].slice(0, 5);

      onConfigUpdate({
        ...config,
        feishu_config: {
          ...config.feishu_config,
          spreadsheet_token: targetToken,
          sheet_id: targetSheetId,
          selected_apps: selectedApps,
          selected_blocks: selectedBlocks,
          last_sync_time: new Date().toLocaleString(),
          recent_destinations: updatedHistory
        }
      });

      alert("🎉 同步成功！数据已成功推送到飞书表格。");
      onClose();
    } catch (e: any) {
      alert(`同步失败: ${e.message}`);
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2.5 rounded-2xl text-white shadow-lg shadow-blue-100">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">飞书数据推送任务</h2>
              <p className="text-xs text-slate-500 font-medium">配置报表维度与目的地</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 flex-1 no-scrollbar">
          
          {/* STEP 1: DESTINATION */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> 
                1. 设定同步目的地
              </h3>
              {(config.feishu_config.recent_destinations?.length || 0) > 0 && (
                <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline"
                >
                  <History className="w-3 h-3" /> 历史目的地
                </button>
              )}
            </div>

            {showHistory && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-2 space-y-1 animate-in slide-in-from-top-2">
                {config.feishu_config.recent_destinations?.map((dest, i) => (
                  <button 
                    key={i}
                    onClick={() => applyHistory(dest)}
                    className="w-full flex items-center justify-between p-2 hover:bg-white rounded-lg text-left group transition-all"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                       <Clock className="w-3 h-3 text-slate-400" />
                       <div className="truncate">
                         <span className="text-[10px] font-bold text-slate-700 block">{dest.sheetName}</span>
                         <span className="text-[9px] text-slate-400 font-mono">{dest.token.substring(0, 12)}...</span>
                       </div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Spreadsheet Token</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="sht..."
                    value={targetToken}
                    onChange={(e) => setTargetToken(e.target.value)}
                  />
                  <button 
                    onClick={handleFetchSheets}
                    disabled={loadingSheets || !targetToken}
                    className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-all active:scale-95"
                  >
                    <RefreshCcw className={`w-4 h-4 text-slate-500 ${loadingSheets ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">选择具体工作表</label>
                <div className="relative">
                  <select 
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs appearance-none outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all pr-8"
                    value={targetSheetId}
                    onChange={(e) => setTargetSheetId(e.target.value)}
                  >
                    {availableSheets.length > 0 ? (
                      <>
                        <option value="auto">✨ 自动匹配子表 (按商店/渠道)</option>
                        {availableSheets.map(s => <option key={s.sheet_id} value={s.sheet_id}>{s.title}</option>)}
                      </>
                    ) : (
                      <option value="">{loadingSheets ? '读取中...' : '填写 Token 并刷新'}</option>
                    )}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </section>

          {/* STEP 2: APPS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Box className="w-4 h-4 text-blue-500" /> 
                2. 选择要同步的应用
              </h3>
              <div className="flex gap-3">
                <button onClick={() => setSelectedApps(availableApps.map(a => a.name))} className="text-[10px] text-blue-600 font-bold hover:underline">全选</button>
                <button onClick={() => setSelectedApps([])} className="text-[10px] text-slate-400 font-bold hover:underline">取消</button>
              </div>
            </div>
            {loadingApps ? (
              <div className="flex items-center gap-3 text-slate-400 text-xs py-8 justify-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> 获取应用列表...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {availableApps.map(app => (
                  <button 
                    key={app.name} 
                    onClick={() => setSelectedApps(prev => prev.includes(app.name) ? prev.filter(a => a !== app.name) : [...prev, app.name])}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all group ${selectedApps.includes(app.name) ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${selectedApps.includes(app.name) ? 'bg-white/20 border-white/40' : 'bg-slate-50 border-slate-200 group-hover:border-blue-200'}`}>
                      {selectedApps.includes(app.name) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-xs font-bold truncate">{app.name}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* STEP 3: BLOCKS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-500" /> 
                3. 选择同步维度（配置块）
              </h3>
              <div className="flex gap-3">
                <button onClick={() => setSelectedBlocks(config.data_blocks.filter(b => b.id.endsWith('_80')).map(b => b.id))} className="text-[10px] text-purple-600 font-bold hover:underline">全选</button>
                <button onClick={() => setSelectedBlocks([])} className="text-[10px] text-slate-400 font-bold hover:underline">取消</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {config.data_blocks.filter(b => b.id.endsWith('_80')).map(block => (
                <button 
                  key={block.id} 
                  onClick={() => setSelectedBlocks(prev => prev.includes(block.id) ? prev.filter(b => b !== block.id) : [...prev, block.id])}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all group ${selectedBlocks.includes(block.id) ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-100' : 'bg-white border-slate-200 text-slate-600 hover:border-purple-300'}`}
                >
                  {selectedBlocks.includes(block.id) ? <Check className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-300" />}
                  <span className="text-xs font-bold">{block.name}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          {progress && (
            <div className="mb-5 space-y-2.5 animate-in fade-in">
              <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                <span>{progress.msg}</span>
                <span className="text-blue-600">{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden shadow-inner">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-500 ease-out" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2.5 text-slate-500 font-bold text-sm hover:bg-slate-200 rounded-2xl transition-colors">放弃</button>
            <button 
              onClick={handleStartSync}
              disabled={syncing || selectedApps.length === 0 || selectedBlocks.length === 0 || !targetSheetId}
              className={`px-10 py-2.5 text-white font-bold rounded-2xl flex items-center gap-2 shadow-xl transition-all active:scale-95 ${syncing ? 'bg-slate-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'}`}
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {syncing ? '同步中' : '立即推送数据'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeishuSyncModal;
