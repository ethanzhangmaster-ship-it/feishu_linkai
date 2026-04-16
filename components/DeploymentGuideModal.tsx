
import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Key, PlayCircle, Download, FileSpreadsheet, Activity, Globe, CloudLightning, MessageSquare, ShieldCheck, Clock, Box } from 'lucide-react';
import { PYTHON_SCRIPT_TEMPLATE, BUSINESS_INTELLIGENCE_SCRIPT_TEMPLATE, REQUIREMENTS_TXT, FEISHU_SYNC_SCRIPT_TEMPLATE, GITHUB_FEISHU_WORKFLOW_YML } from '../utils/templates';

interface DeploymentGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CodeBlock = ({ title, code, filename }: { title: string, code: string, filename?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!filename) return;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 rounded-lg overflow-hidden my-3 border border-slate-700">
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <span className="text-xs font-mono text-slate-300">{title}</span>
        <div className="flex gap-2">
          {filename && (
            <button
            onClick={handleDownload}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
            title="Download File"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">下载</span>
          </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
        </div>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="text-xs font-mono text-green-400 leading-relaxed">
          {code}
        </pre>
      </div>
    </div>
  );
};

const DeploymentGuideModal: React.FC<DeploymentGuideModalProps> = ({ isOpen, onClose }) => {
  const [scriptType, setScriptType] = useState<'standard' | 'bi' | 'hosting' | 'feishu'>('feishu');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-600" />
              自动化与同步指南
            </h2>
            <p className="text-sm text-slate-500">将 Adjust 数据自动推送到飞书或托管看板</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8 no-scrollbar">
          
          {/* Selector */}
          <section className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">选择自动化方案:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <button
                onClick={() => setScriptType('feishu')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  scriptType === 'feishu' 
                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' 
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className={`w-4 h-4 ${scriptType === 'feishu' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`font-semibold ${scriptType === 'feishu' ? 'text-blue-800' : 'text-slate-700'}`}>
                    飞书自动同步
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  每天定时自动更新数据到飞书多维表格。
                </p>
              </button>

              <button
                onClick={() => setScriptType('hosting')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  scriptType === 'hosting' 
                    ? 'bg-green-50 border-green-300 ring-1 ring-green-300' 
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Globe className={`w-4 h-4 ${scriptType === 'hosting' ? 'text-green-600' : 'text-slate-400'}`} />
                  <span className={`font-semibold ${scriptType === 'hosting' ? 'text-green-800' : 'text-slate-700'}`}>
                    Web 托管
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  将看板部署到 Vercel 分享给团队。
                </p>
              </button>

              <button
                onClick={() => setScriptType('standard')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  scriptType === 'standard' 
                    ? 'bg-slate-50 border-slate-300 ring-1 ring-slate-300' 
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Activity className={`w-4 h-4 ${scriptType === 'standard' ? 'text-slate-600' : 'text-slate-400'}`} />
                  <span className={`font-semibold ${scriptType === 'standard' ? 'text-slate-800' : 'text-slate-700'}`}>
                    本地 CSV 脚本
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  手动运行 Python 抓取数据到本地 CSV。
                </p>
              </button>

              <button
                onClick={() => setScriptType('bi')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  scriptType === 'bi' 
                    ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-300' 
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className={`w-4 h-4 ${scriptType === 'bi' ? 'text-purple-600' : 'text-slate-400'}`} />
                  <span className={`font-semibold ${scriptType === 'bi' ? 'text-purple-800' : 'text-slate-700'}`}>
                    BI 深度分析
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  合并业务日志与 Adjust 数据的脚本。
                </p>
              </button>
            </div>
          </section>

          {/* SCRIPT CONTENT */}
          {scriptType === 'feishu' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-700 font-bold">01</div>
                  <h3 className="text-lg font-semibold text-slate-800">在飞书创建应用</h3>
                </div>
                <div className="ml-12 space-y-3 text-sm text-slate-600">
                  <p>1. 访问 <a href="https://open.feishu.cn/app" target="_blank" className="text-blue-600 underline">飞书开放平台</a> 创建企业自建应用。</p>
                  <p>2. 在“权限管理”中搜索并开启 **“查看、编辑、创建电子表格”** 权限。</p>
                  <p>3. 发布应用，并获得 <code>App ID</code> 和 <code>App Secret</code>。</p>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-700 font-bold">02</div>
                  <h3 className="text-lg font-semibold text-slate-800">飞书同步脚本 (feishu_sync.py)</h3>
                </div>
                <div className="ml-12">
                   <p className="text-sm text-slate-500 mb-4">此脚本会自动将 Adjust 昨天的数据推送到飞书 A1 单元格开始的区域。</p>
                   <CodeBlock title="feishu_sync.py" code={FEISHU_SYNC_SCRIPT_TEMPLATE} filename="feishu_sync.py" />
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-700 font-bold">03</div>
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    配置 GitHub 每日定时自动执行
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">推荐方案</span>
                  </h3>
                </div>
                <div className="ml-12 space-y-4">
                   <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs leading-relaxed">
                     <strong>设置步骤:</strong>
                     <ol className="list-decimal pl-5 mt-2 space-y-1">
                       <li>将代码上传到 GitHub 私有仓库。</li>
                       <li>在仓库设置中点击 <strong>Settings -&gt; Secrets and variables -&gt; Actions</strong>。</li>
                       <li>新增以下 Secrets: <code>ADJUST_TOKEN</code>, <code>FEISHU_APP_ID</code>, <code>FEISHU_APP_SECRET</code>。</li>
                       <li>新增以下 Variables: <code>P04_SPREADSHEET_TOKEN</code>, <code>P02_SPREADSHEET_TOKEN</code>。</li>
                       <li>在仓库根目录创建文件夹 <code>.github/workflows/</code> 并放入 <code>feishu-auto-sync.yml</code>。</li>
                     </ol>
                   </div>
                   <CodeBlock title=".github/workflows/sync.yml" code={GITHUB_FEISHU_WORKFLOW_YML} filename="sync.yml" />
                   <p className="text-xs text-slate-400 italic flex items-center gap-1">
                     <Clock className="w-3 h-3" /> 定时任务配置为 <code>0 6 * * *</code>，即每天北京时间下午 2 点。
                   </p>
                </div>
              </section>
            </div>
          )}

          {scriptType === 'hosting' && (
            <div className="space-y-8 animate-in fade-in">
              <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-green-800 text-sm">
                <p>
                  <strong>原理:</strong> 这是一个 React 应用程序。要生成其他人可以访问的链接，您需要将代码部署到 Web 托管服务。
                </p>
              </div>

              <section>
                 <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                   <CloudLightning className="w-5 h-5 text-yellow-500" />
                   快速部署 (Vercel)
                 </h3>
                 <div className="space-y-4 ml-2 border-l-2 border-slate-200 pl-6 pb-2">
                    <div className="relative">
                      <div className="absolute -left-[33px] bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-600">1</div>
                      <h4 className="font-semibold text-slate-800">下载源代码</h4>
                      <p className="text-sm text-slate-500 mt-1">寻找右上角的 "Download Project" 按钮。</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[33px] bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-600">2</div>
                      <h4 className="font-semibold text-slate-800">推送到 GitHub</h4>
                      <p className="text-sm text-slate-500 mt-1">创建私有仓库并上传文件。</p>
                    </div>
                    <div className="relative">
                      <div className="absolute -left-[33px] bg-slate-100 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-600">3</div>
                      <h4 className="font-semibold text-slate-800">连接到 Vercel</h4>
                      <p className="text-sm text-slate-500 mt-1">导入仓库，Vercel 会自动完成构建并给你一个链接。</p>
                    </div>
                 </div>
              </section>
            </div>
          )}

          {(scriptType === 'standard' || scriptType === 'bi') && (
            <div className="space-y-6 animate-in fade-in">
               <div>
                  <h4 className="font-semibold text-slate-800 flex justify-between">
                    <span>主脚本 (main.py)</span>
                  </h4>
                  <CodeBlock 
                    title="main.py" 
                    code={scriptType === 'standard' ? PYTHON_SCRIPT_TEMPLATE : BUSINESS_INTELLIGENCE_SCRIPT_TEMPLATE} 
                    filename="main.py" 
                  />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">依赖项 (requirements.txt)</h4>
                  <CodeBlock title="requirements.txt" code={REQUIREMENTS_TXT} filename="requirements.txt" />
                </div>
            </div>
          )}
        
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            明白了
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeploymentGuideModal;
