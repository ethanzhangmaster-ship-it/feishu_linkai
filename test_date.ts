function excelDateToJSDate(serial: number) {
  const utcDays = serial - 25569;
  const utcValue = utcDays * 86400 * 1000;
  const dateInfo = new Date(utcValue);
  return dateInfo;
}

console.log(excelDateToJSDate(45979).toISOString());
console.log(excelDateToJSDate(45980).toISOString());
