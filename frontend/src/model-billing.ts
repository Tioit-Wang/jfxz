/**
 * 根据成本价和盈利倍率计算售价（积分/百万token）。
 *
 * 当成本为 "0" 时，返回 0，表示该模型为免费模型。
 *
 * @param costPerMillion - 每 1M tokens 的成本价（元）
 * @param profitMultiplier - 盈利倍率（如 "1.10" 表示 10% 利润）
 * @param pointsPerCny - 积分汇率，1元对应多少积分（默认 10000）
 * @returns 售价（积分/百万token），或 null 表示输入无效
 */
export function calculateSellingPrice(
  costPerMillion: string,
  profitMultiplier: string,
  pointsPerCny: string = "10000",
): number | null {
  if (!costPerMillion.trim() || !profitMultiplier.trim()) return null;
  const cost = Number(costPerMillion);
  const profit = Number(profitMultiplier);
  const rate = Number(pointsPerCny);
  if (Number.isNaN(cost) || Number.isNaN(profit) || Number.isNaN(rate)) return null;
  if (cost < 0 || profit < 0 || rate <= 0) return null;
  return cost * profit * rate;
}
