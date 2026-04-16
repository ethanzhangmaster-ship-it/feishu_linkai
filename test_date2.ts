function normalizeDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  if (typeof val === 'string') {
    const match = val.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
    if (match) {
      const y = match[1];
      const m = match[2].padStart(2, '0');
      const d = match[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return String(val);
}

console.log(normalizeDate(45979));
console.log(normalizeDate('2026-03-10(星期二)'));
console.log(normalizeDate('2026/03/10'));
console.log(normalizeDate('2026年3月10日'));
