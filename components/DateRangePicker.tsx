
import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}) => {

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return;

    const today = new Date();
    // Create yesterday object
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    let startStr = "";
    let endStr = "";
    
    switch (value) {
      case 'today':
        startStr = formatDate(today);
        endStr = formatDate(today);
        break;
      case 'yesterday':
        startStr = formatDate(yesterday);
        endStr = formatDate(yesterday);
        break;
      
      // Weeks
      case 'this_week':
        const dayOfWeek = today.getDay() || 7; // 1 (Mon) - 7 (Sun)
        const twStart = new Date(today);
        twStart.setDate(today.getDate() - dayOfWeek + 1);
        startStr = formatDate(twStart);
        // If today is Monday, end is today, otherwise yesterday
        endStr = (dayOfWeek === 1) ? formatDate(today) : formatDate(yesterday);
        break;
      case 'last_week':
        const currentDay = today.getDay() || 7;
        const lwEnd = new Date(today);
        lwEnd.setDate(today.getDate() - currentDay); // Last Sunday
        const lwStart = new Date(lwEnd);
        lwStart.setDate(lwEnd.getDate() - 6); // Last Monday
        startStr = formatDate(lwStart);
        endStr = formatDate(lwEnd);
        break;

      // Rolling Days
      case 'last_3':
        const l3Start = new Date(today);
        l3Start.setDate(today.getDate() - 3);
        startStr = formatDate(l3Start);
        endStr = formatDate(yesterday);
        break;
      case 'last_7':
        const l7Start = new Date(today);
        l7Start.setDate(today.getDate() - 7);
        startStr = formatDate(l7Start);
        endStr = formatDate(yesterday);
        break;
      case 'last_14':
        const l14Start = new Date(today);
        l14Start.setDate(today.getDate() - 14);
        startStr = formatDate(l14Start);
        endStr = formatDate(yesterday);
        break;
      case 'last_30':
        const l30Start = new Date(today);
        l30Start.setDate(today.getDate() - 30);
        startStr = formatDate(l30Start);
        endStr = formatDate(yesterday);
        break;
      case 'last_60':
        const l60Start = new Date(today);
        l60Start.setDate(today.getDate() - 60);
        startStr = formatDate(l60Start);
        endStr = formatDate(yesterday);
        break;
      case 'last_90':
        const l90Start = new Date(today);
        l90Start.setDate(today.getDate() - 90);
        startStr = formatDate(l90Start);
        endStr = formatDate(yesterday);
        break;

      // Calendar Months/Quarters
      case 'this_month':
        const tmStart = new Date(today.getFullYear(), today.getMonth(), 1);
        startStr = formatDate(tmStart);
        endStr = today.getDate() === 1 ? formatDate(today) : formatDate(yesterday);
        break;
      case 'last_month':
        const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        startStr = formatDate(lmStart);
        endStr = formatDate(lmEnd);
        break;
      case 'this_quarter':
        const tqStartMonth = Math.floor(today.getMonth() / 3) * 3;
        const tqStart = new Date(today.getFullYear(), tqStartMonth, 1);
        startStr = formatDate(tqStart);
        endStr = (today.getDate() === 1 && today.getMonth() === tqStartMonth) ? formatDate(today) : formatDate(yesterday);
        break;
      case 'last_quarter':
        const currentQuarter = Math.floor(today.getMonth() / 3);
        let lqStartYear = today.getFullYear();
        let lqStartMonth = (currentQuarter - 1) * 3;
        if (currentQuarter === 0) {
            lqStartYear--;
            lqStartMonth = 9;
        }
        const lqStart = new Date(lqStartYear, lqStartMonth, 1);
        const lqEnd = new Date(lqStartYear, lqStartMonth + 3, 0);
        startStr = formatDate(lqStart);
        endStr = formatDate(lqEnd);
        break;
      case 'this_year':
        const tyStart = new Date(today.getFullYear(), 0, 1);
        startStr = formatDate(tyStart);
        endStr = (today.getDate() === 1 && today.getMonth() === 0) ? formatDate(today) : formatDate(yesterday);
        break;
      case 'last_year':
        const lyStart = new Date(today.getFullYear() - 1, 0, 1);
        const lyEnd = new Date(today.getFullYear() - 1, 11, 31);
        startStr = formatDate(lyStart);
        endStr = formatDate(lyEnd);
        break;
      default:
        return;
    }

    onStartDateChange(startStr);
    onEndDateChange(endStr);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
      <div className="relative border-r border-slate-200 pr-1 pl-1">
        <select
          className="text-xs sm:text-sm font-medium text-slate-600 bg-transparent border-none focus:ring-0 cursor-pointer appearance-none pr-6 py-1 outline-none w-[110px]"
          onChange={handlePresetChange}
          value=""
        >
          <option value="" disabled hidden>日期预设</option>
          
          <optgroup label="常用 (Common)">
            <option value="today">今天 (实时)</option>
            <option value="yesterday">昨天</option>
            <option value="this_week">本周 (周一至昨日)</option>
            <option value="last_week">上周 (周一至周日)</option>
          </optgroup>

          <optgroup label="过去 N 天 (Rolling)">
            <option value="last_3">过去 3 天</option>
            <option value="last_7">过去 7 天</option>
            <option value="last_14">过去 14 天</option>
            <option value="last_30">过去 30 天</option>
            <option value="last_60">过去 60 天</option>
            <option value="last_90">过去 90 天</option>
          </optgroup>

          <optgroup label="自然周期 (Calendar)">
            <option value="this_month">本月 (截止昨日)</option>
            <option value="last_month">上月</option>
            <option value="this_quarter">本季度</option>
            <option value="last_quarter">上季度</option>
            <option value="this_year">今年 (截止昨日)</option>
            <option value="last_year">去年 (全)</option>
          </optgroup>
        </select>
        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <div className="hidden sm:flex items-center pl-1 pointer-events-none">
        <Calendar className="w-4 h-4 text-slate-400" />
      </div>
      
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="text-xs sm:text-sm border-none focus:ring-0 text-slate-700 bg-transparent py-1 pl-1 pr-0 font-medium outline-none cursor-pointer w-[110px] sm:w-auto"
        />
        <span className="text-slate-300 select-none">&mdash;</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="text-xs sm:text-sm border-none focus:ring-0 text-slate-700 bg-transparent py-1 pl-1 pr-2 font-medium outline-none cursor-pointer w-[110px] sm:w-auto"
        />
      </div>
    </div>
  );
};

export default DateRangePicker;
