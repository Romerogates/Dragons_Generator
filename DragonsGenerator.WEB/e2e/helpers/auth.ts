import { expect, type APIRequestContext, type Page } from '@playwright/test';

const TEST_EMAIL = 'test@dragons.local';
const TEST_PASSWORD = 'TestDragons!2026';
const ONBOARDING_SEEN_KEY = 'dragons-onboarding-role-seen';

export type AuthSession = {
  email: string;
  password: string;
  token: string;
  user: { id: string; displayName: string; email: string };
};

/** Connexion via l'API seed (compte test@dragons.local) puis navigation. */
export async function loginViaUi(page: Page, returnUrl = '/'): Promise<void> {
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginRes.ok(), `Login API failed: ${loginRes.status()} ${await loginRes.text()}`).toBeTruthy();
  const auth = (await loginRes.json()) as { token: string; user: unknown };

  await page.goto('/');
  await page.evaluate(
    ({ token, user, seenKey }) => {
      localStorage.setItem('dragons_auth_token', token);
      localStorage.setItem('dragons_auth_user', JSON.stringify(user));
      localStorage.setItem(seenKey, '1');
    },
    { token: auth.token, user: auth.user, seenKey: ONBOARDING_SEEN_KEY },
  );

  await page.goto(returnUrl);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

export async function applyAuthSession(page: Page, session: AuthSession, returnUrl = '/'): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ token, user, seenKey }) => {
      localStorage.setItem('dragons_auth_token', token);
      localStorage.setItem('dragons_auth_user', JSON.stringify(user));
      localStorage.setItem(seenKey, '1');
    },
    { token: session.token, user: session.user, seenKey: ONBOARDING_SEEN_KEY },
  );
  await page.goto(returnUrl);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
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
    token: string;
    user: { id: string; displayName: string; email: string };
  };

  return { email, password, token: auth.token, user: auth.user };
}

export async function loginSeedSession(request: APIRequestContext): Promise<AuthSession> {
  const loginRes = await request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginRes.ok(), `Seed login failed: ${loginRes.status()}`).toBeTruthy();
  const auth = (await loginRes.json()) as {
    token: string;
    user: { id: string; displayName: string; email: string };
  };
  return {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    token: auth.token,
    user: auth.user,
  };
}

export { TEST_EMAIL, TEST_PASSWORD, ONBOARDING_SEEN_KEY };
