import { ApiClient } from "@/api";

export function adminClient(): ApiClient {
  return new ApiClient();
}

export function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function money(value: unknown, currency = "CNY"): string {
  return `${String(value ?? "0.00")} ${currency}`;
}
