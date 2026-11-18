import { expect, type Page } from '@playwright/test';
import { TEST_EMAIL, TEST_PASSWORD } from '../auth';

export async function authToken(page: Page): Promise<string> {
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginRes.ok(), `Login API failed: ${loginRes.status()}`).toBeTruthy();
  const auth = (await loginRes.json()) as { token: string | null };
  const fromCookie = (() => {
    for (const header of loginRes.headersArray()) {
      if (header.name.toLowerCase() !== 'set-cookie') continue;
      const match = header.value.match(/^dg_session=([^;]+)/);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }
    return null;
  })();
  const token = auth.token ?? fromCookie;
  expect(token, 'auth token missing from body and cookie').toBeTruthy();
  return token!;
}

export function bearer(token: string | null): Record<string, string> {
  expect(token, 'Bearer token required for multi-user API helpers').toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}
