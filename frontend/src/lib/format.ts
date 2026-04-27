export function formatToken(value: number): string {
  if (value >= 1000000 && value % 1000000 === 0) return `${value / 1000000}M`;
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}K`;
  return value.toLocaleString("zh-CN");
}
