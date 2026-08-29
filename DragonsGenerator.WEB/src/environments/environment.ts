export const environment = {
  production: true,
  apiUrl: '/api',
  /** Optional VAPID public key; if omitted, fetched from GET /push/config. */
  vapidPublicKey: undefined as string | undefined,
};
