const KEY = 'dg.pendingGoogleIdToken';

export function storePendingGoogleIdToken(token: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(KEY, token);
}

export function peekPendingGoogleIdToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(KEY);
}

export function clearPendingGoogleIdToken(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(KEY);
}

export function peekGoogleJwt(token: string): { name?: string; email?: string } {
  try {
    const part = token.split('.')[1];
    if (!part) return {};
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as {
      name?: string;
      email?: string;
      given_name?: string;
    };
    return { name: json.name || json.given_name, email: json.email };
  } catch {
    return {};
  }
}
