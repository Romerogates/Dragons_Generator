import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

const TEST_EMAIL = 'test@dragons.local';
const TEST_PASSWORD = 'TestDragons!2026';
const ONBOARDING_SEEN_KEY = 'dragons-onboarding-role-seen';
const USER_KEY = 'dragons_auth_user';

export type AuthSession = {
  email: string;
  password: string;
  token: string | null;
  user: { id: string; displayName: string; email: string };
};

/** Copie le cookie dg_session de la réponse API dans le contexte navigateur Playwright. */
async function ensureSessionCookie(page: Page, loginRes: APIResponse): Promise<void> {
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8081';
  for (const header of loginRes.headersArray()) {
    if (header.name.toLowerCase() !== 'set-cookie') continue;
    const match = header.value.match(/^dg_session=([^;]+)/);
    if (!match) continue;
    await page.context().addCookies([
      {
        name: 'dg_session',
        value: match[1],
        url: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    return;
  }
}

async function seedBrowserSession(
  page: Page,
  user: { id: string; displayName: string; email: string },
  returnUrl: string,
): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ storedUser, seenKey, userKey }) => {
      sessionStorage.setItem(userKey, JSON.stringify(storedUser));
      localStorage.setItem(seenKey, '1');
    },
    { storedUser: user, seenKey: ONBOARDING_SEEN_KEY, userKey: USER_KEY },
  );
  await page.goto(returnUrl);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

/** Connexion via l'API seed (cookie HttpOnly) puis navigation. */
export async function loginViaUi(page: Page, returnUrl = '/'): Promise<void> {
  await page.goto('/');
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginRes.ok(), `Login API failed: ${loginRes.status()} ${await loginRes.text()}`).toBeTruthy();
  await ensureSessionCookie(page, loginRes);
  const auth = (await loginRes.json()) as { user: { id: string; displayName: string; email: string } };
  await seedBrowserSession(page, auth.user, returnUrl);
}

export async function applyAuthSession(page: Page, session: AuthSession, returnUrl = '/'): Promise<void> {
  await page.goto('/');
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: session.email, password: session.password },
  });
  expect(loginRes.ok(), `Login API failed: ${loginRes.status()} ${await loginRes.text()}`).toBeTruthy();
  await ensureSessionCookie(page, loginRes);
  const auth = (await loginRes.json()) as { user: { id: string; displayName: string; email: string } };
  await seedBrowserSession(page, auth.user, returnUrl);
}

export async function registerConfirmAndLogin(
  request: APIRequestContext,
  displayNamePrefix = 'E2E',
): Promise<AuthSession> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@dragons.local`;
  const password = 'TestPass123!';
  const displayName = `${displayNamePrefix}${Math.random().toString(36).slice(2, 6)}`;

  const registerRes = await request.post('/api/auth/register', {
    data: { email, password, displayName, acceptTerms: true },
  });
  const registerRaw = await registerRes.text();
  expect(registerRes.ok(), `Register failed: ${registerRes.status()} ${registerRaw}`).toBeTruthy();
  const registerBody = JSON.parse(registerRaw) as { confirmLink?: string };
  expect(registerBody.confirmLink, 'confirmLink missing (dev only)').toBeTruthy();

  const confirmUrl = new URL(registerBody.confirmLink!);
  const tokenParam = confirmUrl.searchParams.get('token');
  expect(tokenParam).toBeTruthy();

  const confirmRes = await request.get(
    `/api/auth/confirm-email?token=${encodeURIComponent(tokenParam!)}`,
  );
  expect(confirmRes.ok(), `Confirm failed: ${confirmRes.status()}`).toBeTruthy();

  const loginRes = await request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(loginRes.ok(), `Login failed: ${loginRes.status()}`).toBeTruthy();
  const auth = (await loginRes.json()) as {
    token: string | null;
    user: { id: string; displayName: string; email: string };
  };

  return { email, password, token: auth.token ?? null, user: auth.user };
}

export async function loginSeedSession(request: APIRequestContext): Promise<AuthSession> {
  const loginRes = await request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginRes.ok(), `Seed login failed: ${loginRes.status()}`).toBeTruthy();
  const auth = (await loginRes.json()) as {
    token: string | null;
    user: { id: string; displayName: string; email: string };
  };
  return {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    token: auth.token ?? null,
    user: auth.user,
  };
}

export { TEST_EMAIL, TEST_PASSWORD, ONBOARDING_SEEN_KEY };
