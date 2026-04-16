function getColStr(idx: number) {
  if (idx >= 26) {
    const firstChar = String.fromCharCode(64 + Math.floor(idx / 26));
    const secondChar = String.fromCharCode(65 + (idx % 26));
    return `${firstChar}${secondChar}`;
  }
  return String.fromCharCode(65 + idx);
}

console.log(0, getColStr(0)); // A
console.log(25, getColStr(25)); // Z
console.log(26, getColStr(26)); // AA
console.log(27, getColStr(27)); // AB
console.log(51, getColStr(51)); // AZ
console.log(52, getColStr(52)); // BA
