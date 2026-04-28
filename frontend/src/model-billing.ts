/**
 * 根据模型成本和加价率计算计费倍率。
 *
 * 当成本为 "0" 时，返回的倍率为 "0.00"，表示该模型为免费模型（multiplier=0 是合法值，
 * 代表免费使用，不需要计费）。
 *
 * @param cost - 每 1M tokens 的成本价（字符串形式）
 * @param markupRate - 加价率百分比（字符串形式，如 "10" 表示 10%）
 * @returns 计费倍率字符串（保留两位小数），或 null 表示输入无效
 */
export function generatedMultiplier(cost: string, markupRate: string): string | null {
  if (!cost.trim() || !markupRate.trim()) return null;
  const costValue = Number(cost);
  const markupValue = Number(markupRate || "0");
  if (Number.isNaN(costValue) || Number.isNaN(markupValue) || costValue < 0 || markupValue < 0) return null;
  // 除以 10：将"每 1M tokens 成本价"转换为"每 100K tokens 计费倍率"（1M / 100K = 10）
  const multiplier = (costValue * (1 + markupValue / 100)) / 10;
  return (Math.ceil(multiplier * 100) / 100).toFixed(2);
}
