export function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const defaultUserNextPath = "/books";

export function sanitizeUserNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return defaultUserNextPath;
  }
  if (value.startsWith("/admin") || value.startsWith("/login")) {
    return defaultUserNextPath;
  }
  return value;
}

export function userLoginPath(nextPath?: string): string {
  return `/login?next=${encodeURIComponent(sanitizeUserNextPath(nextPath))}`;
}
