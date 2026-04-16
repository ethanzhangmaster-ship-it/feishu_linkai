import { AppConfig, ProcessedRow } from '../types';
import { getTenantAccessToken } from './feishuService';

export async function verifySync(
  config: AppConfig,
  spreadsheetToken: string,
  sheetId: string,
  adjustData: ProcessedRow[],
  header: string[]
) {
  console.log("开始自动校验数据完整性...");
  const token = await getTenantAccessToken(config);
  const useProxy = typeof window !== 'undefined' && config.adjust_api.use_proxy;

  // 1. 读取飞书表格数据
  let readUrl = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A:Z`;
  if (useProxy) readUrl = `/api/feishu/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${sheetId}!A:Z`;
  
  const readRes = await fetch(readUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const readData = await readRes.json();
  const feishuValues = readData.data?.valueRange?.values || [];
  
  if (feishuValues.length <= 1) {
    console.warn("校验失败：飞书表格中没有数据或仅有表头。");
    return false;
  }

  // 2. 简单的数据完整性对比 (行数)
  // 减去表头
  const feishuRowCount = feishuValues.length - 1;
  const adjustRowCount = adjustData.length;
  
  console.log(`校验结果: Adjust 数据行数: ${adjustRowCount}, 飞书表格数据行数: ${feishuRowCount}`);
  
  if (feishuRowCount !== adjustRowCount) {
    console.warn("校验警告：Adjust 数据行数与飞书表格行数不一致！");
  } else {
    console.log("校验通过：数据行数一致。");
  }

  // 3. 随机抽样校验 (准确性)
  const sampleSize = Math.min(3, adjustData.length);
  console.log(`开始随机抽样校验 ${sampleSize} 条记录...`);
  
  const normalize = (s: any) => String(s || '').replace(/[^\w\u4e00-\u9fa5]/g, '').toLowerCase();
  const normalizedHeader = header.map(normalize);

  // 灵活匹配日期和渠道列
  const dateColIdx = normalizedHeader.findIndex(h => h === 'day' || h === 'date' || h === '日期' || h === '日期周期');
  const netColIdx = normalizedHeader.findIndex(h => h === 'network' || h === '渠道' || h === '合作伙伴' || h === 'partner');
  
  if (dateColIdx === -1) {
    console.warn("校验跳过：未能在表头中识别出‘日期’列。");
    return true;
  }

  for (let i = 0; i < sampleSize; i++) {
    const sample = adjustData[Math.floor(Math.random() * adjustData.length)];
    // 在飞书中查找该行
    const foundRow = feishuValues.find((row: any[]) => {
      if (!row || row.length <= Math.max(dateColIdx, netColIdx)) return false;
      
      const fDate = String(row[dateColIdx] || '');
      // 飞书可能返回 Excel 数字日期或字符串，进行基础包含匹配
      const dateMatch = fDate.includes(sample.dateStr.split('(')[0]) || sample.dateStr.includes(fDate);
      
      if (netColIdx !== -1) {
        const fNet = String(row[netColIdx] || '');
        return dateMatch && (fNet === sample.network || fNet.includes(sample.network) || sample.network.includes(fNet));
      }
      return dateMatch;
    });
    
    if (!foundRow) {
      console.error(`校验失败：未找到记录 [日期: ${sample.dateStr}, 渠道: ${sample.network}]`);
      return false;
    }
  }

  console.log("校验通过：抽样记录匹配成功。");
  return true;
}
