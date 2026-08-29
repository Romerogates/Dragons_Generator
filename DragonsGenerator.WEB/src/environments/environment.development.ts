export const environment = {
  production: false,
  // Ajoute bien l'URL complète avec le bon port
  apiUrl: 'http://localhost:5117',
  /** Optional VAPID public key; if omitted, fetched from GET /push/config. */
  vapidPublicKey: undefined as string | undefined,
};
