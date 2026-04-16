function jsDateToExcel(dateStr: string) {
  const d = new Date(dateStr);
  return (d.getTime() / (86400 * 1000)) + 25569;
}

console.log(jsDateToExcel('2025-11-18'));
console.log(jsDateToExcel('2025-11-19'));
