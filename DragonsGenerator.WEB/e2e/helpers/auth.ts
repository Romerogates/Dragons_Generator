import { expect, type Page } from '@playwright/test';

const TEST_EMAIL = 'test@dragons.local';
const TEST_PASSWORD = 'TestDragons!2026';

/** Connexion via l'API seed (compte test@dragons.local) puis navigation. */
export async function loginViaUi(page: Page, returnUrl = '/'): Promise<void> {
  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  expect(loginRes.ok(), `Login API failed: ${loginRes.status()} ${await loginRes.text()}`).toBeTruthy();
  const auth = (await loginRes.json()) as { token: string; user: unknown };

  await page.goto('/');
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('dragons_auth_token', token);
      localStorage.setItem('dragons_auth_user', JSON.stringify(user));
    },
    { token: auth.token, user: auth.user },
  );

  await page.goto(returnUrl);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

export { TEST_EMAIL, TEST_PASSWORD };
