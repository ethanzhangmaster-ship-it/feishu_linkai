
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Eye, EyeOff, FileJson, KeyRound, Wifi, Globe, MessageSquare, Download, Upload, Copy, CheckCircle2, AlertTriangle, ShieldCheck, Zap, Bot } from 'lucide-react';
import { AppConfig } from '../types';
import { fetchApps } from '../services/adjustService';
import { testFeishuConnection } from '../services/feishuService';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (newConfig: AppConfig) => void;
}

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [activeTab, setActiveTab] = useState<'form' | 'feishu' | 'ai' | 'json'>('form');
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);
  const [jsonString, setJsonString] = useState('');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isSaved, setIsSaved] = useState(false);
  
  // Adjust Test Status
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Feishu Test Status
  const [feishuTestStatus, setFeishuTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [feishuTestMessage, setFeishuTestMessage] = useState('');

  const [syncTriggerStatus, setSyncTriggerStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncTriggerMessage, setSyncTriggerMessage] = useState('');

  const [availableApps, setAvailableApps] = useState<{name: string, token: string}[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      setJsonString(JSON.stringify(config, null, 2));
      setTestStatus('idle');
      setTestMessage('');
      setFeishuTestStatus('idle');
      setFeishuTestMessage('');
      setSyncTriggerStatus('idle');
      setSyncTriggerMessage('');
      setIsSaved(false);
    }
  }, [isOpen, config]);

  useEffect(() => {
    if (activeTab === 'feishu' && localConfig.adjust_api?.user_token && availableApps.length === 0) {
      setIsLoadingApps(true);
      fetchApps(localConfig.adjust_api.user_token, localConfig.adjust_api.use_proxy)
        .then(apps => {
          setAvailableApps(apps);
          setIsLoadingApps(false);
        })
        .catch(err => {
          console.error("Failed to fetch apps for config modal", err);
          setIsLoadingApps(false);
        });
    }
  }, [activeTab, localConfig.adjust_api?.user_token]);

  useEffect(() => {
    if (activeTab === 'form' || activeTab === 'feishu' || activeTab === 'ai') {
      setJsonString(JSON.stringify(localConfig, null, 2));
    }
  }, [localConfig, activeTab]);

  if (!isOpen) return null;

  const toggleSecret = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const updateAdjustConfig = (key: string, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      adjust_api: { ...prev.adjust_api, [key]: value }
    }));
    setTestStatus('idle');
  };

  const updateFeishuConfig = (key: string, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      feishu_config: {
        ...(prev.feishu_config || { app_id: '', app_secret: '', spreadsheet_token: '', sheet_id: '', enabled: false }),
        [key]: value
      }
    }));
    setFeishuTestStatus('idle');
  };

  const updateAiConfig = (key: string, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      ai_config: {
        ...(prev.ai_config || { api_key: '', model: 'gemini-3.1-pro-preview' }),
        [key]: value
      }
    }));
  };

  const handleTestAdjust = async () => {
    setTestStatus('testing');
    setTestMessage('正在连接 Adjust API...');
    try {
      const token = localConfig.adjust_api.user_token;
      if (!token) throw new Error("请输入 Token。");
      const apps = await fetchApps(token, localConfig.adjust_api.use_proxy);
      setTestStatus('success');
      setTestMessage(`连接成功! 已获取权限访问 ${apps.length} 个应用。`);
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(e.message);
    }
  };

  const handleTestFeishu = async () => {
    setFeishuTestStatus('testing');
    setFeishuTestMessage('正在验证飞书表格权限...');
    try {
      await testFeishuConnection(localConfig);
      setFeishuTestStatus('success');
      setFeishuTestMessage("连接成功！应用已获得该表格编辑权限。");
    } catch (e: any) {
      setFeishuTestStatus('error');
      setFeishuTestMessage(e.message);
    }
  };

  const handleTriggerSync = async () => {
    setSyncTriggerStatus('syncing');
    setSyncTriggerMessage('正在后台同步数据，请耐心等待 (可能需要几分钟)...');
    try {
      const res = await fetch('/api/sync/trigger', { method: 'POST' });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(`服务器返回了非预期的格式 (HTTP ${res.status}): ${text.substring(0, 100)}...`);
      }

      const data = await res.json();
      if (data.success) {
        setSyncTriggerStatus('success');
        if (data.message) {
          setSyncTriggerMessage(data.message);
        } else {
          setSyncTriggerMessage(`同步成功！更新了 ${data.result?.updated || 0} 行，追加了 ${data.result?.appended || 0} 行。`);
        }
      } else {
        setSyncTriggerStatus('error');
        setSyncTriggerMessage(`同步失败: ${data.message || data.error}`);
      }
    } catch (e: any) {
      console.error(e);
      setSyncTriggerStatus('error');
      setSyncTriggerMessage(`同步失败: ${e.message}`);
    }
  };

  const handleSave = () => {
    try {
      let finalConfig = localConfig;
      if (activeTab === 'json') {
        finalConfig = JSON.parse(jsonString);
      }
      onSave(finalConfig);
      setIsSaved(true);
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (e) {
      alert("配置格式无效，请检查 JSON 语法");
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(localConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adjust_dashboard_config_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setLocalConfig(parsed);
        alert("配置已导入，请点击保存");
      } catch (err) {
        alert("无效的配置文件");
      }
    };
    reader.readAsText(file);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(jsonString);
    alert("配置已复制到剪贴板");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">系统设置</h2>
            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button onClick={() => setActiveTab('form')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'form' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><KeyRound className="w-3 h-3" /> Adjust</button>
              <button onClick={() => setActiveTab('feishu')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'feishu' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><MessageSquare className="w-3 h-3" /> 飞书集成</button>
              <button onClick={() => setActiveTab('ai')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'ai' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><Bot className="w-3 h-3" /> AI 助手</button>
              <button onClick={() => setActiveTab('json')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'json' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}><FileJson className="w-3 h-3" /> 高级 JSON</button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'form' ? (
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2"><div className="w-2 h-6 bg-adjust rounded-full"></div><h3 className="font-semibold text-slate-800">Adjust API 凭证 (已加密保存)</h3></div>
                
                {/* 性能建议看板 */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 animate-in fade-in slide-in-from-top-2">
                   <Zap className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                   <div>
                      <p className="text-xs font-bold text-blue-800 mb-1">性能与稳定性建议 (最佳方案)</p>
                      <p className="text-[10px] text-blue-700 leading-relaxed">
                         如果您查询的数据超过一个月，或者由于代理超时报错：建议在 Chrome 商店安装 <strong className="underline">"Allow CORS"</strong> 插件，并 <strong>关闭下方“跨域代理”</strong> 选项。插件直连比代理快 5 倍且永不超时。
                      </p>
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <label className="text-xs font-medium text-slate-500 mb-1 block">User API Token</label>
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <input type={showSecrets['adjust_user'] ? "text" : "password"} className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono pr-10 outline-none focus:border-blue-500" value={localConfig.adjust_api.user_token} onChange={(e) => updateAdjustConfig('user_token', e.target.value)} />
                        <button onClick={() => toggleSecret('adjust_user')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showSecrets['adjust_user'] ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button>
                      </div>
                      <button onClick={handleTestAdjust} className={`px-3 py-2 rounded-lg text-sm font-medium border flex items-center gap-2 transition-all ${testStatus === 'testing' ? 'bg-slate-50 cursor-wait' : 'bg-white hover:bg-slate-50'}`} disabled={testStatus === 'testing'}><Wifi className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-pulse text-blue-500' : ''}`} />测试</button>
                    </div>
                    {testMessage && <p className={`mt-2 text-[10px] font-medium ${testStatus === 'success' ? 'text-green-600' : 'text-red-500'}`}>{testMessage}</p>}
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-slate-500" /><div><span className="text-sm font-medium block">跨域代理</span><span className="text-[10px] text-slate-400">仅在未安装 CORS 插件时开启</span></div></div>
                    <input type="checkbox" checked={localConfig.adjust_api.use_proxy} onChange={(e) => updateAdjustConfig('use_proxy', e.target.checked)} className="w-5 h-5 rounded border-slate-300 text-blue-600 cursor-pointer" />
                  </div>
                </div>
              </section>
            </div>
          ) : activeTab === 'feishu' ? (
            /* ... 保持 Feishu 内容不变 ... */
            <div className="space-y-6">
               {/* 保持之前的 Feishu 代码内容 */}
               <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                   <div className="flex items-center gap-2"><div className="w-2 h-6 bg-blue-500 rounded-full"></div><h3 className="font-semibold text-slate-800">飞书 API 凭证</h3></div>
                   <button onClick={handleTestFeishu} className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 transition-all ${feishuTestStatus === 'testing' ? 'bg-slate-50 cursor-wait' : 'bg-white hover:bg-slate-50'}`} disabled={feishuTestStatus === 'testing'}><Wifi className="w-3.5 h-3.5" />测试权限</button>
                </div>
                
                {feishuTestMessage && (
                  <div className={`p-3 rounded-lg text-xs flex items-start gap-2 animate-in slide-in-from-top-2 ${feishuTestStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {feishuTestStatus === 'success' ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    {feishuTestMessage}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium text-slate-500">App ID</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono" placeholder="cli_..." value={localConfig.feishu_config?.app_id || ''} onChange={(e) => updateFeishuConfig('app_id', e.target.value)} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium text-slate-500">App Secret</label>
                    <input type="password" placeholder="••••••••" className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono" value={localConfig.feishu_config?.app_secret || ''} onChange={(e) => updateFeishuConfig('app_secret', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Spreadsheet Token</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono" placeholder="sht..." value={localConfig.feishu_config?.spreadsheet_token || ''} onChange={(e) => updateFeishuConfig('spreadsheet_token', e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Sheet ID (留空则自动匹配)</label>
                    <input type="text" className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono" placeholder="留空以自动匹配子表" value={localConfig.feishu_config?.sheet_id || ''} onChange={(e) => updateFeishuConfig('sheet_id', e.target.value)} />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2"><div className="w-2 h-6 bg-emerald-500 rounded-full"></div><h3 className="font-semibold text-slate-800">全自动同步设置 (每天 14:00)</h3></div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">启用全自动同步</span>
                      <input type="checkbox" checked={localConfig.feishu_config?.auto_sync_enabled || false} onChange={(e) => updateFeishuConfig('auto_sync_enabled', e.target.checked)} className="w-4 h-4" />
                    </div>
                  </div>
                  
                  {localConfig.feishu_config?.auto_sync_enabled && (
                    <div className="space-y-4 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-4">
                          <label className="text-[10px] font-bold text-emerald-800">应用分发路由规则 (将特定应用推送到特定飞书表格及子表)</label>
                          {(localConfig.feishu_config?.app_mappings || []).map((mapping, idx) => (
                            <div key={idx} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-emerald-200 shadow-sm">
                              <div className="flex gap-2 items-start">
                                <div className="flex-1 space-y-2">
                                  <div className="flex gap-2 items-center">
                                    <span className="text-xs font-medium text-slate-600 w-16">选择应用:</span>
                                    <div className="flex-1 relative">
                                      <select 
                                        className="w-full p-1.5 border border-slate-200 rounded text-xs font-mono bg-slate-50"
                                        value={mapping.appName}
                                        onChange={(e) => {
                                          const newMappings = [...(localConfig.feishu_config?.app_mappings || [])];
                                          newMappings[idx].appName = e.target.value;
                                          updateFeishuConfig('app_mappings', newMappings);
                                        }}
                                      >
                                        <option value="">-- 请选择应用 --</option>
                                        {isLoadingApps ? <option disabled>加载中...</option> : availableApps.map(app => (
                                          <option key={app.token} value={app.token}>{app.name} ({app.token})</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex gap-2 items-center">
                                    <span className="text-xs font-medium text-slate-600 w-16">目标表格:</span>
                                    <input 
                                      type="text" 
                                      className="flex-1 p-1.5 border border-slate-200 rounded text-xs font-mono" 
                                      placeholder="飞书表格 Token (sht...)"
                                      value={mapping.spreadsheet_token} 
                                      onChange={(e) => {
                                        const newMappings = [...(localConfig.feishu_config?.app_mappings || [])];
                                        newMappings[idx].spreadsheet_token = e.target.value;
                                        updateFeishuConfig('app_mappings', newMappings);
                                      }} 
                                    />
                                  </div>
                                </div>
                                <button 
                                  onClick={() => {
                                    const newMappings = [...(localConfig.feishu_config?.app_mappings || [])];
                                    newMappings.splice(idx, 1);
                                    updateFeishuConfig('app_mappings', newMappings);
                                  }}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded mt-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              
                              {/* Sheet Mappings */}
                              <div className="mt-2 pt-2 border-t border-slate-100">
                                <div className="text-[10px] font-bold text-slate-500 mb-2">子表维度映射 (留空则自动创建)</div>
                                <div className="grid grid-cols-2 gap-2">
                                  {localConfig.data_blocks.map(block => {
                                    const sheetMapping = mapping.sheet_mappings?.find(sm => sm.blockId === block.id);
                                    return (
                                      <div key={block.id} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-100">
                                        <span className="text-[10px] text-slate-600 truncate w-24" title={block.name}>{block.name}</span>
                                        <input 
                                          type="text"
                                          className="flex-1 p-1 border border-slate-200 rounded text-[10px] font-mono"
                                          placeholder="Sheet ID (如: 4shxvY)"
                                          value={sheetMapping?.sheetId || ''}
                                          onChange={(e) => {
                                            const newMappings = [...(localConfig.feishu_config?.app_mappings || [])];
                                            const currentMapping = newMappings[idx];
                                            if (!currentMapping.sheet_mappings) currentMapping.sheet_mappings = [];
                                            
                                            const smIdx = currentMapping.sheet_mappings.findIndex(sm => sm.blockId === block.id);
                                            if (e.target.value) {
                                              if (smIdx >= 0) currentMapping.sheet_mappings[smIdx].sheetId = e.target.value;
                                              else currentMapping.sheet_mappings.push({ blockId: block.id, sheetId: e.target.value });
                                            } else {
                                              if (smIdx >= 0) currentMapping.sheet_mappings.splice(smIdx, 1);
                                            }
                                            updateFeishuConfig('app_mappings', newMappings);
                                          }}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const newMappings = [...(localConfig.feishu_config?.app_mappings || []), { appName: '', spreadsheet_token: '', sheet_mappings: [] }];
                              updateFeishuConfig('app_mappings', newMappings);
                            }}
                            className="text-xs text-emerald-600 font-medium hover:text-emerald-700 flex items-center gap-1"
                          >
                            + 添加路由规则
                          </button>
                        </div>
                        <div className="space-y-1 pt-2 border-t border-emerald-100">
                          <label className="text-[10px] font-bold text-emerald-800">默认同步应用 (未匹配上方规则的应用，将推送到基础设置中的表格)</label>
                          <input 
                            type="text" 
                            className="w-full p-2 border border-emerald-200 rounded-lg text-xs font-mono" 
                            placeholder="例如: appToken1, appToken2 (留空则同步所有未匹配应用)"
                            value={(localConfig.feishu_config?.selected_apps || []).join(', ')} 
                            onChange={(e) => {
                              const val = e.target.value;
                              const apps = val ? val.split(',').map(s => s.trim()).filter(Boolean) : [];
                              updateFeishuConfig('selected_apps', apps);
                            }} 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-emerald-800">自动同步起始日期 (会从该日期抓到今天)</label>
                          <input
                            type="date"
                            className="w-full p-2 border border-emerald-200 rounded-lg text-xs font-mono"
                            value={localConfig.feishu_config?.auto_sync_start_date || '2025-12-01'}
                            onChange={(e) => updateFeishuConfig('auto_sync_start_date', e.target.value || '2025-12-01')}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 mt-4">
                        <div className="flex justify-end">
                          <button onClick={handleTriggerSync} disabled={syncTriggerStatus === 'syncing'} className={`px-3 py-1.5 bg-white border rounded-lg text-xs font-bold transition-all ${syncTriggerStatus === 'syncing' ? 'border-slate-300 text-slate-400 cursor-wait' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-100'}`}>
                            {syncTriggerStatus === 'syncing' ? '同步中...' : '立即触发一次后台同步'}
                          </button>
                        </div>
                        {syncTriggerMessage && (
                          <div className={`p-2 rounded-lg text-xs ${syncTriggerStatus === 'success' ? 'bg-green-100 text-green-800' : syncTriggerStatus === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                            {syncTriggerMessage}
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-emerald-700 mt-2">
                        注意：全自动同步将自动获取所有应用和所有数据块，并自动匹配推送到目标表格的对应子表。您只需确保上方填写了正确的 Sheet ID（或留空以自动匹配）。
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 space-y-2">
                   <p className="text-[10px] text-amber-800 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> 重要权限步骤：</p>
                   <ol className="text-[10px] text-amber-700 list-decimal pl-4 space-y-1">
                      <li>确保飞书应用已发布且启用“云文档”权限。</li>
                      <li><strong>关键：</strong>打开飞书表格文档，点击右上角“分享”。</li>
                      <li>在“添加协作者”中搜索并添加您的<strong>自建应用名称</strong>，赋予“可编辑”权限。</li>
                   </ol>
                </div>
              </section>
            </div>
          ) : activeTab === 'ai' ? (
            <div className="space-y-6">
               <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                   <div className="flex items-center gap-2"><div className="w-2 h-6 bg-purple-500 rounded-full"></div><h3 className="font-semibold text-slate-800">AI 助手配置</h3></div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex gap-3 animate-in fade-in slide-in-from-top-2">
                   <Bot className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                   <div>
                      <p className="text-xs font-bold text-purple-800 mb-1">自定义 Chat 模型</p>
                      <p className="text-[10px] text-purple-700 leading-relaxed">
                         您可以配置自己的 Gemini API Key 和选择模型，用于生成利润波动深度诊断报告等 AI 功能。如果不配置，将使用默认的系统 Token（可能会有频率限制）。
                      </p>
                   </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">Gemini API Key</label>
                    <div className="relative">
                      <input type={showSecrets['ai_key'] ? "text" : "password"} placeholder="AIzaSy..." className="w-full p-2 border border-slate-300 rounded-lg text-sm font-mono pr-10" value={localConfig.ai_config?.api_key || ''} onChange={(e) => updateAiConfig('api_key', e.target.value)} />
                      <button onClick={() => toggleSecret('ai_key')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{showSecrets['ai_key'] ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}</button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500">选择模型 (Select model for the code assistant)</label>
                    <select 
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white"
                      value={localConfig.ai_config?.model || 'gemini-3.1-pro-preview'}
                      onChange={(e) => updateAiConfig('model', e.target.value)}
                    >
                      <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                      <option value="gemini-3.0-flash-preview">Gemini 3.0 Flash Preview</option>
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    </select>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="h-full flex flex-col gap-4">
               {/* 保持之前的 JSON 内容不变 */}
               <div className="flex justify-between items-center bg-slate-100 p-2 rounded-lg">
                  <div className="flex gap-2">
                     <button onClick={exportConfig} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-50"><Download className="w-3 h-3" />导出文件</button>
                     <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-600 hover:bg-slate-50"><Upload className="w-3 h-3" />导入配置</button>
                     <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={importConfig} />
                  </div>
                  <button onClick={copyJson} className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 rounded text-xs font-bold text-white hover:bg-blue-700"><Copy className="w-3 h-3" />复制 JSON</button>
               </div>
               <textarea value={jsonString} onChange={(e) => setJsonString(e.target.value)} className="flex-1 w-full font-mono text-xs bg-slate-900 text-green-400 p-4 rounded-lg outline-none resize-none border-2 border-slate-800 focus:border-blue-500" />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">取消</button>
          <button 
            onClick={handleSave} 
            className={`px-8 py-2 text-white font-bold rounded-lg flex items-center gap-2 transition-all transform active:scale-95 ${isSaved ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100'}`}
          >
            {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {isSaved ? '已安全保存' : '保存凭证'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
