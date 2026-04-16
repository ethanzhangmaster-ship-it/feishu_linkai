
import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Square, CheckSquare } from 'lucide-react';

export const AD_SOURCE_OPTIONS = [
  { label: 'AppLovin MAX SDK', value: 'applovin_max_sdk' },
  { label: 'AD(X) SDK', value: 'adx_sdk' },
  { label: 'AdMob', value: 'admob_sdk' },
  { label: 'AdMob API', value: 'admob_api' },
  { label: 'Admost', value: 'admost_api' },
  { label: 'Admost SDK', value: 'admost_sdk' },
  { label: 'IronSource', value: 'ironsource_sdk' },
  { label: 'TopOn', value: 'topon_sdk' },
  { label: 'TradPlus', value: 'tradplus_sdk' },
];

interface AdSourceFilterProps {
  selectedSources: string[];
  onChange: (sources: string[]) => void;
}

const AdSourceFilter: React.FC<AdSourceFilterProps> = ({ selectedSources, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelected, setTempSelected] = useState<string[]>(selectedSources);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTempSelected(selectedSources);
  }, [selectedSources, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = AD_SOURCE_OPTIONS.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSource = (val: string) => {
    setTempSelected(prev => 
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const handleSelectAll = () => {
    if (tempSelected.length === AD_SOURCE_OPTIONS.length) {
      setTempSelected([]);
    } else {
      setTempSelected(AD_SOURCE_OPTIONS.map(o => o.value));
    }
  };

  const handleConfirm = () => {
    onChange(tempSelected);
    setIsOpen(false);
  };

  const handleReset = () => {
    setTempSelected([]);
  };

  const displayLabel = selectedSources.length === 0 
    ? '所有广告收入来源' 
    : selectedSources.length === AD_SOURCE_OPTIONS.length 
      ? '全部已选' 
      : AD_SOURCE_OPTIONS.find(o => o.value === selectedSources[0])?.label + (selectedSources.length > 1 ? ` (+${selectedSources.length - 1})` : '');

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-blue-300 transition-all shadow-sm min-w-[180px]"
      >
        <span className="text-slate-400">广告收入来源</span>
        <span className="text-blue-600 truncate flex-1 text-left">{displayLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="搜索" 
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            <button 
              onClick={handleSelectAll}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-left transition-colors"
            >
              {tempSelected.length === AD_SOURCE_OPTIONS.length ? 
                <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                <Square className="w-4 h-4 text-slate-300" />
              }
              <span className="text-xs font-bold text-slate-700">全选</span>
            </button>
            <div className="h-px bg-slate-100 my-1 mx-2" />
            {filteredOptions.map(opt => (
              <button 
                key={opt.value}
                onClick={() => toggleSource(opt.value)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg text-left transition-colors group"
              >
                {tempSelected.includes(opt.value) ? 
                  <CheckSquare className="w-4 h-4 text-blue-600" /> : 
                  <Square className="w-4 h-4 text-slate-300 group-hover:border-blue-300" />
                }
                <span className={`text-xs ${tempSelected.includes(opt.value) ? 'text-blue-700 font-bold' : 'text-slate-600'}`}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between gap-3">
            <button 
              onClick={handleReset}
              className="flex-1 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            >
              重置
            </button>
            <button 
              onClick={handleConfirm}
              className="flex-1 py-2 text-xs font-bold text-white bg-blue-500 rounded-xl hover:bg-blue-600 shadow-md shadow-blue-100 transition-all"
            >
              确认
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdSourceFilter;
