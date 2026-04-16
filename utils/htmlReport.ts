
import { ProcessedRow } from '../types';

export const generateHtmlReport = (data: ProcessedRow[], startDate: string, endDate: string, activeBlockId: string = 'block_basic'): string => {
  const timestamp = new Date().toLocaleString();
  
  // --- 1. Calculate Overall Summary Stats ---
  const totalCost = data.reduce((acc, curr) => acc + curr.cost, 0);
  const totalRevenue = data.reduce((acc, curr) => acc + curr.totalRevenue, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgRoi = totalCost > 0 ? (totalRevenue / totalCost) * 100 : 0;

  // --- 2. Smart Analysis Logic (Embedded) ---
  let analysisHtml = '';
  const sortedData = [...data].sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime());
  const uniqueDates = Array.from(new Set(sortedData.map(r => r.dateStr))).sort();

  if (uniqueDates.length >= 2) {
    const midIndex = Math.floor(uniqueDates.length / 2);
    const prevDates = uniqueDates.slice(0, midIndex);
    const currDates = uniqueDates.slice(midIndex);
    
    // Helper: Metrics Calc
    const calcMetrics = (dates: string[]) => {
        const rows = sortedData.filter(r => dates.includes(r.dateStr));
        const rev = rows.reduce((acc, c) => acc + c.totalRevenue, 0);
        const cost = rows.reduce((acc, c) => acc + c.cost, 0);
        const installs = rows.reduce((acc, c) => acc + c.installs, 0);
        return {
            revenue: rev,
            cost: cost,
            profit: rev - cost,
            installs: installs,
            cpi: installs > 0 ? cost / installs : 0,
            roi: cost > 0 ? rev / cost : 0
        };
    };

    const prevM = calcMetrics(prevDates);
    const currM = calcMetrics(currDates);

    // --- A. Root Cause Diagnosis ---
    let rootCauseTitle = "";
    let rootCauseDesc = "";
    const profitDelta = currM.profit - prevM.profit;
    const actions: string[] = [];
    let specificAction = "";

    if (profitDelta < 0) {
      // BAD: Profit Decline
      if (currM.cost > prevM.cost * 1.1 && currM.revenue < prevM.revenue * 1.05) {
        rootCauseTitle = "买量效率下降 (Inefficient Spend)";
        rootCauseDesc = "消耗大幅上涨，但收入未同步增长。可能是盲目扩量导致 CPI 飙升或引入了低质量用户。";
        specificAction = "🎨 <strong>素材与合作伙伴质量检查</strong>: 1. 检查核心合作伙伴 (如 AppLovin/Google) 是否出现 <strong>素材衰退 (Creative Fatigue)</strong>，点击率 (CTR) 是否下滑。 2. 排查是否有 <strong>低质量子渠道 (Sub-publishers)</strong> 混入，导致假量或低留存用户增加。建议关停 CPI 高于均值 30% 的广告组。";
      } else if (currM.cost <= prevM.cost && currM.revenue < prevM.revenue * 0.9) {
        rootCauseTitle = "变现能力衰退 (Monetization Drop)";
        rootCauseDesc = "在消耗未明显增加的情况下，收入出现滑坡。请重点排查产品变现层面的问题。";
        specificAction = "🔧 <strong>变现能力深度诊断</strong>: 1. 检查广告聚合平台 (如 Max/IronSource) 的 <strong>SDK 状态</strong>，确认 <strong>eCPM</strong> 和 <strong>填充率</strong> 是否异常下跌。 2. 测试 <strong>IAP 支付回调</strong> 及购买流程是否通畅，排除掉单问题。";
      } else if (currM.roi < prevM.roi) {
        rootCauseTitle = "ROI 倒挂风险";
        rootCauseDesc = "整体 ROI 下滑，回本周期变长。需警惕 LTV 下滑风险。";
        specificAction = "📊 <strong>LTV 曲线监控</strong>: 对比本周与上周的 D0 -> D7 LTV 增长曲线。如果前七天增长变缓，说明早期留存或变现设计出了问题。";
      } else {
        rootCauseTitle = "利润自然波动";
        rootCauseDesc = "利润小幅下滑，但各项指标相对健康，可能受季节性因素影响。";
      }
    } else {
      // GOOD: Profit Growth
      if (currM.revenue > prevM.revenue && currM.cost > prevM.cost) {
        rootCauseTitle = "良性扩量 (Healthy Scale-up)";
        rootCauseDesc = "消耗与收入同步增长，利润扩大。当前的买量策略有效。";
      } else if (currM.cost < prevM.cost && currM.revenue >= prevM.revenue) {
        rootCauseTitle = "降本增效 (Optimization)";
        rootCauseDesc = "在减少消耗的同时维持了收入，ROI 显著提升。";
      } else {
        rootCauseTitle = "利润回升";
        rootCauseDesc = "整体利润表现优于上一周期。";
      }
    }
    
    // Add actions
    if (specificAction) actions.push(specificAction);

    if (currM.cpi > prevM.cpi * 1.15) {
        actions.push(`📉 <strong>控制 CPI</strong>: 全局 CPI 上涨了 ${((currM.cpi - prevM.cpi)/prevM.cpi*100).toFixed(0)}%。建议暂停高价素材，或检查是否存在素材衰退 (Creative Fatigue)。`);
    }
    
    if (actions.length === 0) {
       actions.push("✅ <strong>保持现状</strong>: 核心指标健康。建议尝试在该 ROI 水平下，对绿榜合作伙伴小幅增加预算 (5-10%) 测试增量。");
    }

    // --- B. Driver Identification (Network based) ---
    // Using 'network' gives better actionable insight than 'appName' for profit drops
    const getContributors = (metric: 'totalRevenue' | 'profit') => {
        const map = new Map<string, { prev: number, curr: number }>();
        sortedData.forEach(row => {
            const key = row.network || 'Unknown'; 
            const val = metric === 'profit' ? (row.totalRevenue - row.cost) : row.totalRevenue;
            
            if (!map.has(key)) map.set(key, { prev: 0, curr: 0 });
            const entry = map.get(key)!;
            
            if (prevDates.includes(row.dateStr)) entry.prev += val;
            if (currDates.includes(row.dateStr)) entry.curr += val;
        });
        
        const diffs = Array.from(map.entries()).map(([name, vals]) => ({
            name,
            delta: vals.curr - vals.prev
        })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

        return {
            riser: diffs.find(d => d.delta > 0),
            faller: diffs.find(d => d.delta < 0)
        };
    };

    const revDrivers = getContributors('totalRevenue');
    const profitDrivers = getContributors('profit');

    // --- C. Render Helpers ---
    const renderDelta = (delta: number, isGoodHigh = true) => {
        const isPos = delta > 0;
        const isGood = isGoodHigh ? isPos : !isPos;
        const color = isGood ? 'color: #16a34a;' : 'color: #ea580c;'; // green-600 : orange-600
        const sign = isPos ? '+' : '';
        return `<span style="font-family: monospace; font-weight: bold; ${color}">${sign}$${Math.round(delta).toLocaleString()}</span>`;
    };

    const renderDriver = (driver: {name: string, delta: number} | undefined, label: string) => {
        if (!driver) return '';
        const color = driver.delta > 0 ? 'color: #16a34a' : 'color: #dc2626';
        return `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9; font-size: 12px;">
                <span style="color: #64748b;">${label} (合作伙伴):</span> 
                <span style="font-weight: 600; color: #334155;">${driver.name}</span>
                <span style="${color}; font-weight: bold;">(${driver.delta > 0 ? '+' : ''}${Math.round(driver.delta)})</span>
            </div>
        `;
    };

    // --- D. Build HTML ---
    analysisHtml = `
      <div style="background: linear-gradient(to right, #f5f3ff, #eff6ff); border: 1px solid #e9d5ff; border-radius: 12px; padding: 24px; margin-bottom: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px;">
             <div style="font-size: 24px;">${profitDelta < 0 ? '⚠️' : '🛡️'}</div>
             <div>
                <h3 style="margin: 0 0 4px 0; font-size: 18px; color: ${profitDelta < 0 ? '#9a3412' : '#166534'}; font-weight: 700;">
                    ${rootCauseTitle}
                </h3>
                <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5;">${rootCauseDesc}</p>
             </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px;">
              <!-- Revenue -->
              <div style="background: rgba(255,255,255,0.8); border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px;">
                  <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">收入趋势</div>
                  <div style="font-size: 14px; color: #475569;">
                      周期变化: ${renderDelta(currM.revenue - prevM.revenue)}
                  </div>
                  ${renderDriver(revDrivers.riser, '主要动力')}
                  ${renderDriver(revDrivers.faller, '主要拖累')}
              </div>
              
              <!-- Profit -->
              <div style="background: rgba(255,255,255,0.8); border: 1px solid #ddd6fe; border-radius: 8px; padding: 16px; position: relative; overflow: hidden;">
                  <div style="position: absolute; top:0; left:0; width: 4px; height: 100%; background: #8b5cf6;"></div>
                  <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">利润趋势</div>
                  <div style="font-size: 14px; color: #475569;">
                      周期变化: ${renderDelta(currM.profit - prevM.profit)}
                  </div>
                  ${renderDriver(profitDrivers.riser, '增长最大')}
                  ${renderDriver(profitDrivers.faller, '下降最大')}
              </div>

              <!-- Cost -->
              <div style="background: rgba(255,255,255,0.8); border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px;">
                  <div style="font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">消耗趋势</div>
                  <div style="font-size: 14px; color: #475569;">
                      周期变化: ${renderDelta(currM.cost - prevM.cost, false)}
                  </div>
                  <div style="margin-top: 8px; font-size: 12px; color: #64748b;">
                      <span style="display: block;">Previous: $${Math.round(prevM.cost).toLocaleString()}</span>
                      <span style="display: block;">Current: $${Math.round(currM.cost).toLocaleString()}</span>
                  </div>
              </div>
          </div>

          <div style="background: rgba(255,255,255,0.5); border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px 16px;">
             <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 6px; text-transform: uppercase;">
                💡 建议行动 (Action Plan)
             </div>
             <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.6;">
                ${actions.map(a => `<li style="margin-bottom: 6px;">${a}</li>`).join('')}
             </ul>
          </div>
      </div>
    `;
  } else {
    analysisHtml = `<div style="padding: 20px; text-align: center; color: #94a3b8; border: 1px dashed #cbd5e1; border-radius: 8px; margin-bottom: 32px;">数据不足，无法生成趋势对比 (至少需要2天数据)。</div>`;
  }

  // --- 3. Aggregate Rankings ---
  const aggregateData = (key: 'appName' | 'network') => {
    const map = new Map<string, { name: string; cost: number; revenue: number; installs: number }>();

    data.forEach(row => {
      // @ts-ignore
      const name = row[key] || 'Unknown';
      if (!map.has(name)) {
        map.set(name, { name, cost: 0, revenue: 0, installs: 0 });
      }
      const entry = map.get(name)!;
      entry.cost += row.cost;
      entry.revenue += row.totalRevenue;
      entry.installs += row.installs;
    });

    return Array.from(map.values())
      .map(item => ({
        ...item,
        roi: item.cost > 0 ? (item.revenue / item.cost) : 0,
        profit: item.revenue - item.cost
      }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  const appRankings = aggregateData('appName');
  const networkRankings = aggregateData('network').slice(0, 20); // Top 20

  const renderRankingTable = (items: any[], title: string, iconColor: string) => `
    <div style="background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${iconColor};"></span>
            ${title}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead style="background: #f8fafc; color: #64748b; text-transform: uppercase; font-size: 11px;">
                <tr>
                    <th style="padding: 8px 16px; text-align: left; width: 40px;">#</th>
                    <th style="padding: 8px 16px; text-align: left;">名称</th>
                    <th style="padding: 8px 16px; text-align: right;">收入</th>
                    <th style="padding: 8px 16px; text-align: right;">消耗</th>
                    <th style="padding: 8px 16px; text-align: right;">利润</th>
                    <th style="padding: 8px 16px; text-align: right;">ROI</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((item, idx) => `
                <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#fff' : '#fafafa'};">
                    <td style="padding: 10px 16px; color: #94a3b8; font-family: monospace;">${idx + 1}</td>
                    <td style="padding: 10px 16px; font-weight: 500; color: #334155;">${item.name}</td>
                    <td style="padding: 10px 16px; text-align: right; font-family: monospace; color: #16a34a;">$${item.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td style="padding: 10px 16px; text-align: right; font-family: monospace; color: #dc2626;">$${item.cost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td style="padding: 10px 16px; text-align: right; font-family: monospace; font-weight: bold; ${item.profit >= 0 ? 'color: #7c3aed;' : 'color: #f97316;'}">
                        $${item.profit.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                    </td>
                    <td style="padding: 10px 16px; text-align: right; font-family: monospace; font-weight: bold; ${item.roi >= 1 ? 'color: #16a34a;' : 'color: #ea580c;'}">
                        ${(item.roi * 100).toFixed(1)}%
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Adjust 数据洞察 (${startDate} 至 ${endDate})</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 40px; }
      .container { max-width: 1000px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
      .tag { font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; margin-left: 8px; }
      .tag-blue { background: #dbeafe; color: #1e40af; }
      .card-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
      .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
      .card-label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
      .card-value { font-size: 24px; font-weight: 700; color: #0f172a; }
      @media print {
        body { background: white; padding: 0; }
        .container { max-width: 100%; }
        .shadow-none { box-shadow: none !important; border: 1px solid #ccc !important; }
      }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div>
                <h1 style="margin: 0; font-size: 24px; color: #0f172a;">Adjust 数据洞察报告</h1>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Generated at ${timestamp}</p>
            </div>
            <div>
                <span class="tag tag-blue">${startDate} 至 ${endDate}</span>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="card-grid">
            <div class="card">
                <div class="card-label">总消耗 (Spend)</div>
                <div class="card-value" style="color: #dc2626;">$${totalCost.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="card-label">总收入 (Revenue)</div>
                <div class="card-value" style="color: #16a34a;">$${totalRevenue.toLocaleString()}</div>
            </div>
            <div class="card">
                <div class="card-label">总利润 (Profit)</div>
                <div class="card-value" style="${totalProfit >= 0 ? 'color: #7c3aed;' : 'color: #ea580c;'}">
                    $${totalProfit.toLocaleString()}
                </div>
            </div>
            <div class="card">
                <div class="card-label">ROI</div>
                <div class="card-value" style="${avgRoi >= 100 ? 'color: #16a34a;' : 'color: #ea580c;'}">
                    ${avgRoi.toFixed(1)}%
                </div>
            </div>
        </div>

        <!-- Smart Analysis -->
        ${analysisHtml}

        <!-- Rankings -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 24px;">
            ${renderRankingTable(appRankings, '应用排行榜 (App Ranking)', '#f59e0b')}
            ${renderRankingTable(networkRankings, '合作伙伴排行榜 (Partner Ranking - Top 20)', '#8b5cf6')}
        </div>
        
        <div style="text-align: center; font-size: 11px; color: #94a3b8; margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
            Adjust Dashboard Report Generator • 每日明细数据已隐藏以保持报告简洁
        </div>
    </div>
</body>
</html>
  `;
};
