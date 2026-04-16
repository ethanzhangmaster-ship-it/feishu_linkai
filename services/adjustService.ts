
import { DataBlockConfig, ProcessedRow, AppConfig, ValidationResult } from '../types';

const BLACKLISTED_APPS = [
  "Mergeland - Merge Dragons and Build dragon home",
  "Merge Legend",
  "Merge Legend Amazon",
  "Test App",
  "Placeholder"
];

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', {
  weekday: 'long',
  timeZone: 'UTC'
});

// --- CACHE IMPLEMENTATION ---
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const memoryCache = new Map<string, { timestamp: number; data: ProcessedRow[] }>();

const getISOWeek = (date: Date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const getMonthKey = (date: Date) => {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const formatDateWithWeekday = (dateStr: string): string => {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const dateObj = new Date(Date.UTC(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3])));
    if (!isNaN(dateObj.getTime())) {
       return `${match[1]}-${match[2]}-${match[3]}(${weekdayFormatter.format(dateObj)})`;
    }
  }
  return dateStr;
};

const safeFloat = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const clean = val.replace(/,/g, '');
    if (clean.endsWith('%')) {
      return (parseFloat(clean) || 0) / 100;
    }
    return parseFloat(clean) || 0;
  }
  return 0;
};

const ensureTokenFormat = (token: string) => {
  const t = (token || '').trim();
  if (!t) return '';
  return (t.startsWith('Bearer ') || t.startsWith('Token ')) ? t : `Bearer ${t}`;
};

const normalizeStoreName = (rawStore: string): string => {
  if (!rawStore) return 'unknown';
  const s = rawStore.toLowerCase();
  if (s.includes('app_store')) return 'ios';
  if (s.includes('play_store')) return 'android';
  if (s.includes('itunes') || s.includes('ios') || s.includes('apple')) return 'ios';
  if (s.includes('google') || s.includes('android')) return 'android';
  return s;
};

const normalizeNetworkName = (rawName: string): string => {
  if (!rawName) return 'Organic';
  const lower = rawName.toLowerCase().trim();
  if (lower === 'organic') return 'Organic';
  if (lower.includes('google')) return 'Google Ads';
  // Adjust often splits Meta traffic into Facebook/Instagram/Off-Facebook install rows.
  if (lower.includes('facebook') || lower.includes('meta') || lower.includes('instagram') || lower.includes('messenger')) return 'Facebook';
  if (lower.includes('apple') || lower.includes('search ads')) return 'Apple';
  if (lower.includes('applovin')) return 'Applovin';
  if (lower.includes('unity')) return 'Unity Ads';
  return rawName;
};

const PROXY_PROVIDERS = [
  {
    name: 'CorsProxy.io',
    build: (target: string) => `https://corsproxy.io/?${encodeURIComponent(target)}`,
    parse: async (res: Response) => res
  }
];

const fetchWithProxyFallback = async (targetUrl: string, options: RequestInit, useProxy: boolean): Promise<Response> => {
  // In Node.js environment (server-side), we don't need CORS proxies, fetch directly
  if (typeof window === 'undefined') {
    const res = await fetch(targetUrl, options);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Adjust API 报错 (${res.status}): ${errText}`);
    }
    return res;
  }

  try {
    const directRes = await fetch(targetUrl, { ...options, cache: 'default' });
    if (directRes.ok) return directRes;
    if (directRes.status === 401) throw new Error("TOKEN_INVALID");
    if (directRes.status >= 400 && directRes.status < 500) {
      const errText = await directRes.text();
      throw new Error(`Adjust API 报错 (${directRes.status}): ${errText}`);
    }
  } catch (e: any) {
    if (e.message === "TOKEN_INVALID") throw new Error("Adjust Token 无效。");
    if (e.message.startsWith('Adjust API 报错')) throw e;
    if (!useProxy) throw new Error("CORS_BLOCKED");
  }

  if (!useProxy) {
     throw new Error("无法直连 Adjust API。请检查网络或开启‘跨域代理’。推荐安装‘Allow CORS’插件并关闭代理。");
  }

  // Try local proxy first
  try {
    const proxyUrl = targetUrl.replace('https://automate.adjust.com', '/api/adjust');
    const response = await fetch(proxyUrl, options);
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      // Skip, it's the SPA fallback index.html
    } else if (response.ok) {
      return response;
    } else if (response.status >= 400 && response.status < 500 && response.status !== 401) {
      const errText = await response.text();
      throw new Error(`Adjust API 报错 (${response.status}): ${errText}`);
    }
  } catch (e: any) {
    if (e.message.startsWith('Adjust API 报错')) throw e;
  }

  for (const provider of PROXY_PROVIDERS) {
    try {
      const response = await fetch(provider.build(targetUrl), options);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500 && response.status !== 401) {
        const errText = await response.text();
        throw new Error(`Adjust API 报错 (${response.status}): ${errText}`);
      }
    } catch (e: any) {
      if (e.message.startsWith('Adjust API 报错')) throw e;
    }
  }
  
  throw new Error(`连接失败。请尝试安装插件‘Allow CORS’后关闭设置中的代理以获得最佳性能。`);
};

const getMetricsForBlock = (blockId: string): string => {
  if (blockId.includes('_roi') || blockId.includes('_retention')) {
    // 彻底移除不稳定的 all_revenue_* 指标，改用最标准的 roas_d* (IAP) 和 ad_revenue_total_d* (广告)
    // 抓取所有需要的日期：0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 20, 21, 29, 30, 39, 49, 59, 69, 79, 89, 99
    // 同时也抓取留存指标：1, 2, 3, 4, 5, 6, 7, 14, 20
    const days = [0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 20, 21, 29, 30, 39, 49, 59, 69, 79, 89, 99];
    const roas = days.map(d => `roas_d${d}`).join(',');
    const adRev = days.map(d => `ad_revenue_total_d${d}`).join(',');
    const iapRev = days.map(d => `revenue_total_d${d}`).join(',');
    const ret = 'retention_rate_d1,retention_rate_d2,retention_rate_d3,retention_rate_d4,retention_rate_d5,retention_rate_d6,retention_rate_d7,retention_rate_d14,retention_rate_d20';
    return `cost,installs,all_revenue,ad_revenue,revenue,first_paying_users_d0,daus,sessions,${roas},${adRev},${iapRev},${ret}`;
  }
  return 'cost,installs,all_revenue,ad_revenue,revenue,ecpi_all,roas_d0,all_revenue_total_d0,revenue_total_d0,ad_revenue_total_d0,first_paying_users_d0,retention_rate_d1,daus,sessions,all_revenue_total_m0,all_revenue_total_m1,all_revenue_total_m2,all_revenue_total_m3,all_revenue_total_m4,all_revenue_total_m5,all_revenue_total_m6';
};

const splitDateRange = (start: string, end: string, chunkDays: number = 5): [string, string][] => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const chunks: [string, string][] = [];
  let currentStart = new Date(startDate);
  
  while (currentStart <= endDate) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + chunkDays - 1);
    if (currentEnd > endDate) currentEnd = new Date(endDate);
    chunks.push([currentStart.toISOString().split('T')[0], currentEnd.toISOString().split('T')[0]]);
    currentStart.setDate(currentStart.getDate() + chunkDays);
  }
  return chunks;
};

/**
 * 核心对齐抓取逻辑
 * 策略：1. 基础包抓取归因指标 (Cost, Installs) 2. 来源包叠加收入指标 (Ad Revenue)
 */
export const fetchAndProcessData = async (
  config: AppConfig, 
  block: DataBlockConfig, 
  startDate: string, 
  endDate: string, 
  adSources: string[] = [], 
  onProgress?: (percent: number, message: string) => void,
  forceRefresh: boolean = false
): Promise<ProcessedRow[]> => {
  // 1. Check Cache
  const cacheKey = JSON.stringify({
    token: config.adjust_api.user_token,
    blockId: block.id,
    grouping: block.grouping,
    filter: block.filter,
    start: startDate,
    end: endDate,
    sources: [...adSources].sort(),
    proxy: config.adjust_api.use_proxy
  });

  if (!forceRefresh) {
    const cachedEntry = memoryCache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) {
      if (onProgress) onProgress(100, "从内存缓存加载数据...");
      return cachedEntry.data;
    }
  }

  const userToken = config.adjust_api.user_token;
  const useProxy = config.adjust_api.use_proxy || false;
  
  const CHUNK_SIZE = useProxy ? 3 : 5; 
  const CONCURRENCY = useProxy ? 1 : 4; 
  const chunks = splitDateRange(startDate, endDate, CHUNK_SIZE);
  
  const isPeriodSummary = block.id.includes('summary');
  const metrics = getMetricsForBlock(block.id);
  
  const dims = ['app', 'app_token', 'store_type'];
  if (block.grouping) block.grouping.forEach(g => { if (g === 'date') dims.push('day'); else if (g && !g.includes('=')) dims.push(g); });
  if (block.id === 'block_spend_details') dims.push('adgroup', 'campaign');
  if (block.filter) {
    const filters = block.filter.split('&');
    for (const f of filters) {
      const [k] = f.split('=');
      if (k === 'store_type') dims.push('store_type');
      else if (k === 'network') dims.push('network');
    }
  }
  const finalDims = Array.from(new Set(dims)).join(',');

  const fetchChunk = async (s: string, e: string) => {
    const params = new URLSearchParams({ date_period: `${s}:${e}`, dimensions: finalDims, metrics, ad_spend_mode: 'network' });
    
    // 方案一：在拉取数据的 API 请求中进行过滤
    // 直接在请求参数中加入过滤条件，例如仅筛选 ad_revenue_source=applovin_max_sdk
    if (adSources.length > 0) {
      params.append('ad_revenue_source', adSources.join(','));
    }
    
    const targetUrl = `https://automate.adjust.com/reports-service/report?${params.toString()}`;
    
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetchWithProxyFallback(targetUrl, {
            method: 'GET',
            headers: { 'Authorization': ensureTokenFormat(userToken), 'Accept': 'application/json' }
        }, useProxy);
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          return data.rows || [];
        } catch (e) {
           throw new Error(`Adjust API 返回了非 JSON 格式的数据。这可能是由于网络代理错误或 API 暂时不可用导致。`);
        }
      } catch (err: any) {
        if (err.message.startsWith('Adjust API 报错')) {
          if (err.message.includes('(429)')) {
            console.log(`Rate limited on Adjust API (429). Retrying in ${1000 * (i + 1)}ms...`);
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            continue;
          }
          throw err;
        }
        if (i === 2) throw err;
        await new Promise(r => setTimeout(r, 500 * (i + 1))); 
      }
    }
    return [];
  };

  const allChunkResults: any[] = [];

  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const progressPercent = Math.round((i / chunks.length) * 100);
    
    if (onProgress) onProgress(progressPercent, `正在抓取数据: ${batch.map(b=>b[0]).join(',')}...`);
    
    const results = await Promise.all(batch.map(async ([s, e]) => {
      return await fetchChunk(s, e);
    }));
    
    allChunkResults.push(...results.flat());
  }

  if (onProgress) onProgress(95, "正在处理数据...");

  const aggregatedMap = new Map<string, any>();

  allChunkResults.forEach((row: any) => {
    const app = row.app || "Unknown";
    if (BLACKLISTED_APPS.some(b => app.includes(b))) return;

    // Apply block filter if defined (e.g., "store_type=android&network=Facebook")
    if (block.filter) {
      const filters = block.filter.split('&');
      for (const f of filters) {
        const [k, v] = f.split('=');
        if (k === 'store_type') {
          const st = normalizeStoreName(row.store_type);
          if (st !== v.toLowerCase()) {
            console.log(`Filtered out by store_type: ${st} !== ${v.toLowerCase()}`);
            return;
          }
        } else if (k === 'network') {
          const nw = normalizeNetworkName(row.network);
          if (nw.toLowerCase() !== v.toLowerCase()) {
            console.log(`Filtered out by network: ${nw.toLowerCase()} !== ${v.toLowerCase()}`);
            return;
          }
        }
      }
    }

    // Build aggregation key based on requested grouping
    const keyParts = [];
    keyParts.push(app); // Always group by app so filtering works
    if (block.grouping?.includes('date')) keyParts.push(row.day || row.date || "");
    if (block.grouping?.includes('network')) keyParts.push(normalizeNetworkName(row.network));
    if (block.id === 'block_spend_details') {
      keyParts.push(row.adgroup || '-');
      keyParts.push(row.campaign || 'Unknown');
    }
    const key = keyParts.join('|') || 'all';

    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        app: app,
        appToken: row.app_token || "Unknown",
        day: row.day || row.date || "",
        network: normalizeNetworkName(row.network),
        adgroup: row.adgroup || '-',
        campaign: row.campaign || 'Unknown',
        store_type: 'all',
        country: 'Global',
        
        installs: 0, cost: 0, ad_revenue: 0, revenue: 0, all_revenue: 0,
        all_revenue_total_d0: 0, revenue_total_d0: 0, ad_revenue_total_d0: 0, first_paying_users_d0: 0, daus: 0, sessions: 0,
        iap_revenue_total_d0: 0,
        all_revenue_total_m0: 0, all_revenue_total_m1: 0, all_revenue_total_m2: 0, all_revenue_total_m3: 0, all_revenue_total_m4: 0, all_revenue_total_m5: 0, all_revenue_total_m6: 0,
        all_revenue_total_d1: 0, all_revenue_total_d2: 0, all_revenue_total_d3: 0, all_revenue_total_d4: 0, all_revenue_total_d5: 0, all_revenue_total_d7: 0, all_revenue_total_d14: 0, all_revenue_total_d21: 0, all_revenue_total_d30: 0,
        
        rev_d0: 0, rev_d1: 0, rev_d2: 0, rev_d3: 0, rev_d4: 0, rev_d5: 0, rev_d6: 0, rev_d7: 0, rev_d13: 0, rev_d14: 0, rev_d20: 0, rev_d21: 0, rev_d29: 0, rev_d30: 0, rev_d39: 0, rev_d49: 0, rev_d59: 0, rev_d69: 0, rev_d79: 0, rev_d89: 0, rev_d99: 0,
        ret_d1: 0, ret_d2: 0, ret_d3: 0, ret_d4: 0, ret_d5: 0, ret_d6: 0, ret_d7: 0, ret_d14: 0, ret_d20: 0,
      });
    }

    const agg = aggregatedMap.get(key);
    const cost = safeFloat(row.cost);
    const installs = safeFloat(row.installs);

    agg.installs += installs;
    agg.cost += cost;
    agg.ad_revenue += safeFloat(row.ad_revenue);
    const iap = safeFloat(row.revenue);
    agg.revenue += block.revenue_mode === '80_gross' ? iap * 0.8 : iap;
    
    // all_revenue will be recalculated later from ad_revenue + revenue
    // agg.all_revenue += safeFloat(row.all_revenue);
    
    // 移除之前的直接累加，统一使用 calcTotalRev 逻辑，防止 d0 被双倍计算
    // agg.all_revenue_total_d0 += safeFloat(row.all_revenue_total_d0);
    // agg.revenue_total_d0 += safeFloat(row.revenue_total_d0);
    // agg.ad_revenue_total_d0 += safeFloat(row.ad_revenue_total_d0);
    
    agg.first_paying_users_d0 += safeFloat(row.first_paying_users_d0);
    agg.daus += safeFloat(row.daus);
    agg.sessions += safeFloat(row.sessions);

    const mFactor = block.revenue_mode === '80_gross' ? 0.8 : 1.0;
    agg.all_revenue_total_m0 += safeFloat(row.all_revenue_total_m0) * mFactor;
    agg.all_revenue_total_m1 += safeFloat(row.all_revenue_total_m1) * mFactor;
    agg.all_revenue_total_m2 += safeFloat(row.all_revenue_total_m2) * mFactor;
    agg.all_revenue_total_m3 += safeFloat(row.all_revenue_total_m3) * mFactor;
    agg.all_revenue_total_m4 += safeFloat(row.all_revenue_total_m4) * mFactor;
    agg.all_revenue_total_m5 += safeFloat(row.all_revenue_total_m5) * mFactor;
    agg.all_revenue_total_m6 += safeFloat(row.all_revenue_total_m6) * mFactor;

    // 聚合回收金额和 ROI
    // 彻底移除不稳定的 all_revenue_total_*，改用 IAP (revenue_total) + Ad (ad_revenue_total) 手动相加
    const getIapRev = (d: number) => safeFloat(row[`revenue_total_d${d}`]);
    const getAdRev = (d: number) => safeFloat(row[`ad_revenue_total_d${d}`]);
    const getRoasVal = (d: number) => safeFloat(row[`roas_d${d}`]);

    const calcTotalRev = (d: number) => {
      // 优先使用 revenue_total_d*，如果没有，则尝试用 roas_d* * cost 估算
      let iap = getIapRev(d) || (getRoasVal(d) * cost);
      let adjustedIap = iap;
      if (block.revenue_mode === '80_gross') {
        adjustedIap = iap * 0.8;
      }
      const ad = getAdRev(d);
      return { total: adjustedIap + ad, iap: adjustedIap, ad: ad };
    };

    const days = [0, 1, 2, 3, 4, 5, 6, 7, 13, 14, 20, 21, 29, 30, 39, 49, 59, 69, 79, 89, 99];
    days.forEach(d => {
      const revObj = calcTotalRev(d);
      const rev = revObj.total;
      agg[`rev_d${d}`] += rev;
      if (d === 0) {
        agg.all_revenue_total_d0 += rev;
        agg.iap_revenue_total_d0 = (agg.iap_revenue_total_d0 || 0) + revObj.iap;
        agg.ad_revenue_total_d0 = (agg.ad_revenue_total_d0 || 0) + revObj.ad;
      }
      if (d === 6) agg.all_revenue_total_d6 = (agg.all_revenue_total_d6 || 0) + rev;
      if (d === 13) agg.all_revenue_total_d13 = (agg.all_revenue_total_d13 || 0) + rev;
      if (d === 20) agg.all_revenue_total_d20 = (agg.all_revenue_total_d20 || 0) + rev;
    });

    agg.ret_d1 += safeFloat(row.retention_rate_d1) * installs;
    agg.ret_d2 += safeFloat(row.retention_rate_d2) * installs;
    agg.ret_d3 += safeFloat(row.retention_rate_d3) * installs;
    agg.ret_d4 += safeFloat(row.retention_rate_d4) * installs;
    agg.ret_d5 += safeFloat(row.retention_rate_d5) * installs;
    agg.ret_d6 += safeFloat(row.retention_rate_d6) * installs;
    agg.ret_d7 += safeFloat(row.retention_rate_d7) * installs;
    agg.ret_d14 += safeFloat(row.retention_rate_d14) * installs;
    agg.ret_d20 += safeFloat(row.retention_rate_d20) * installs;
  });

  const finalData = Array.from(aggregatedMap.values()).map((agg: any, idx: number) => {
    const installs = agg.installs;
    const cost = agg.cost;
    const adRev = agg.ad_revenue;
    const iapRev = agg.revenue;
    const totalRev = agg.all_revenue || (adRev + iapRev);
    const dStr = agg.day;

    return {
      id: `${block.id}-${idx}`,
      appName: agg.app,
      appToken: agg.appToken,
      storeType: agg.store_type,
      network: agg.network,
      country: agg.country,
      sourceAccountId: agg.adgroup,
      campaignName: agg.campaign,
      version: block.label_value_fixed || "All",
      dateStr: isPeriodSummary ? (block.id === 'block_weekly_summary' ? getISOWeek(new Date(dStr)) : getMonthKey(new Date(dStr))) : formatDateWithWeekday(dStr),
      cost: Number(cost.toFixed(2)),
      totalRevenue: Number(totalRev.toFixed(2)),
      adRevenue: Number(adRev.toFixed(2)),
      iapRevenue: Number(iapRev.toFixed(2)),
      cohortRevenue: Number(agg.all_revenue_total_d0.toFixed(2)),
      installs: Math.floor(installs),
      cpa: installs > 0 ? Number((cost / installs).toFixed(2)) : 0,
      roi: cost > 0 ? totalRev / cost : 0,
      arpu: installs > 0 ? Number((agg.all_revenue_total_d0 / installs).toFixed(2)) : 0,
      userPayCost: agg.first_paying_users_d0 > 0 ? Number((cost / agg.first_paying_users_d0).toFixed(2)) : 0,
      paidInstalls: Math.floor(agg.first_paying_users_d0),
      paidArppu: agg.first_paying_users_d0 > 0 ? Number((((agg.iap_revenue_total_d0 || 0) / agg.first_paying_users_d0)).toFixed(2)) : 0,
      payRate: installs > 0 ? agg.first_paying_users_d0 / installs : 0,
      
      retention1: installs > 0 ? agg.ret_d1 / installs : 0,
      retention2: installs > 0 ? agg.ret_d2 / installs : 0,
      retention3: installs > 0 ? agg.ret_d3 / installs : 0,
      retention4: installs > 0 ? agg.ret_d4 / installs : 0,
      retention5: installs > 0 ? agg.ret_d5 / installs : 0,
      retention6: installs > 0 ? agg.ret_d6 / installs : 0,
      retention7: installs > 0 ? agg.ret_d7 / installs : 0,
      retention14: installs > 0 ? agg.ret_d14 / installs : 0,
      retention20: installs > 0 ? agg.ret_d20 / installs : 0,
      
      roiD0: cost > 0 ? agg.rev_d0 / cost : 0,
      roiD1: cost > 0 ? agg.rev_d1 / cost : 0,
      roiD2: cost > 0 ? agg.rev_d2 / cost : 0,
      roiD3: cost > 0 ? agg.rev_d3 / cost : 0,
      roiD4: cost > 0 ? agg.rev_d4 / cost : 0,
      roiD5: cost > 0 ? agg.rev_d5 / cost : 0,
      roiD6: cost > 0 ? agg.rev_d6 / cost : 0,
      roiD7: cost > 0 ? agg.rev_d7 / cost : 0,
      roiD13: cost > 0 ? agg.rev_d13 / cost : 0,
      roiD14: cost > 0 ? agg.rev_d14 / cost : 0,
      roiD20: cost > 0 ? agg.rev_d20 / cost : 0,
      roiD21: cost > 0 ? agg.rev_d21 / cost : 0,
      roiD29: cost > 0 ? agg.rev_d29 / cost : 0,
      roiD30: cost > 0 ? agg.rev_d30 / cost : 0,
      roiD39: cost > 0 ? agg.rev_d39 / cost : 0,
      roiD49: cost > 0 ? agg.rev_d49 / cost : 0,
      roiD59: cost > 0 ? agg.rev_d59 / cost : 0,
      roiD69: cost > 0 ? agg.rev_d69 / cost : 0,
      roiD79: cost > 0 ? agg.rev_d79 / cost : 0,
      roiD89: cost > 0 ? agg.rev_d89 / cost : 0,
      roiD99: cost > 0 ? agg.rev_d99 / cost : 0,
      
      daus: Math.floor(agg.daus),
      sessions: Math.floor(agg.sessions),
      
      revD0: agg.all_revenue_total_d0,
      revD1: agg.all_revenue_total_d1,
      revD2: agg.all_revenue_total_d2,
      revD3: agg.all_revenue_total_d3,
      revD4: agg.all_revenue_total_d4,
      revD5: agg.all_revenue_total_d5,
      revD6: agg.all_revenue_total_d6,
      revD7: agg.all_revenue_total_d7,
      revD13: agg.all_revenue_total_d13,
      revD14: agg.all_revenue_total_d14,
      revD20: agg.all_revenue_total_d20,
      revD21: agg.all_revenue_total_d21,
      revD29: agg.all_revenue_total_d29,
      revD30: agg.all_revenue_total_d30,
      revM0: agg.all_revenue_total_m0,
      revM1: agg.all_revenue_total_m1,
      revM2: agg.all_revenue_total_m2,
      revM3: agg.all_revenue_total_m3,
      revM4: agg.all_revenue_total_m4,
      revM5: agg.all_revenue_total_m5,
      revM6: agg.all_revenue_total_m6,
      iapRevD0: agg.iap_revenue_total_d0 || 0,
      adRevD0: agg.ad_revenue_total_d0 || 0,
      blockId: block.id,
      
      // Basic data additional fields
      allRevenuePerUserD0: installs > 0 ? agg.all_revenue_total_d0 / installs : 0,
      costPerPayingUserD0: agg.first_paying_users_d0 > 0 ? cost / agg.first_paying_users_d0 : 0,
      firstTimePayingUserConversionRateD0: installs > 0 ? agg.first_paying_users_d0 / installs : 0,
      revenuePerPayingUserD0: agg.first_paying_users_d0 > 0 ? (agg.iap_revenue_total_d0 || 0) / agg.first_paying_users_d0 : 0,
      roasM0: cost > 0 ? agg.all_revenue_total_m0 / cost : 0,
      roasM1: cost > 0 ? agg.all_revenue_total_m1 / cost : 0,
      roasM2: cost > 0 ? agg.all_revenue_total_m2 / cost : 0,
      roasM3: cost > 0 ? agg.all_revenue_total_m3 / cost : 0,
      roasM4: cost > 0 ? agg.all_revenue_total_m4 / cost : 0,
      roasM5: cost > 0 ? agg.all_revenue_total_m5 / cost : 0,
      roasM6: cost > 0 ? agg.all_revenue_total_m6 / cost : 0,
    };
  });

  const sortedData = finalData.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  
  // Save to memory cache
  memoryCache.set(cacheKey, { timestamp: Date.now(), data: sortedData });
  return sortedData;
};

export const fetchApps = async (userToken: string, useProxy: boolean = false) => {
  const params = new URLSearchParams({ date_period: 'this_month', dimensions: 'app,app_token', metrics: 'installs' });
  const targetUrl = `https://automate.adjust.com/reports-service/report?${params.toString()}`;
  
  let retries = 3;
  while (retries > 0) {
    try {
      const response = await fetchWithProxyFallback(targetUrl, {
        method: 'GET',
        headers: { 'Authorization': ensureTokenFormat(userToken), 'Accept': 'application/json' }
      }, useProxy);
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return (data.rows || []).filter((r: any) => !BLACKLISTED_APPS.some(b => r.app.includes(b))).map((r: any) => ({ name: r.app, token: r.app_token || 'unknown' }));
      } catch (e) {
         throw new Error(`Adjust API 返回了非 JSON 格式的数据。这可能是由于网络代理错误或 API 暂时不可用导致。`);
      }
    } catch (err: any) {
      if (err.message.includes('(429)')) {
        retries--;
        if (retries === 0) throw err;
        console.log(`Rate limited on fetchApps (429). Retrying in 2 seconds... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw err;
      }
    }
  }
  return [];
};

export const validateDataset = (data: ProcessedRow[]): ValidationResult => {
  if (!data || data.length === 0) return { status: 'warning', messages: ['无数据。'] };
  return { status: 'success', messages: [] };
};
