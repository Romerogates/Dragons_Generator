export const environment = {
  production: false,
  apiUrl: '/api',
  /** Optional VAPID public key; if omitted, fetched from GET /push/config. */
  vapidPublicKey: undefined as string | undefined,
};
