/** Rappel connexion Google vs e-mail (deux adresses = deux comptes). */
export const GOOGLE_TWO_ACCOUNT_HINT =
  'Si vous jouez déjà avec une autre adresse, connectez-vous avec celle-là : un autre e-mail Google, c’est un autre compte.';

export function withGoogleLoginHint(message: string): string {
  const base = message.trim();
  if (!base) return GOOGLE_TWO_ACCOUNT_HINT;
  if (base.includes('autre e-mail') || base.includes('autre adresse')) return base;
  return `${base} ${GOOGLE_TWO_ACCOUNT_HINT}`;
}
