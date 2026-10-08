import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

/** Télécharge le JSON du personnage lié à un ticket support. */
export function downloadTicketCharacterJson(
  http: HttpClient,
  ticketId: string,
  characterName: string,
  onError?: () => void,
  messageId?: string,
): void {
  const url = messageId
    ? `${environment.apiUrl}/support/tickets/${ticketId}/messages/${messageId}/character-json`
    : `${environment.apiUrl}/support/tickets/${ticketId}/character-json`;
  http.get(url, { responseType: 'blob' }).subscribe({
    next: (blob) => {
      const safeName = (characterName.trim() || 'personnage').replace(/[^\w\s\-àâäéèêëïîôùûüç]/gi, '').trim() || 'personnage';
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${safeName}.json`;
      a.click();
      URL.revokeObjectURL(objectUrl);
    },
    error: () => onError?.(),
  });
}

/** Ouvre la pièce jointe d'un ticket (auth requise côté API). */
export function openTicketAttachment(
  http: HttpClient,
  ticketId: string,
  onError?: () => void,
  messageId?: string,
): void {
  const url = messageId
    ? `${environment.apiUrl}/support/tickets/${ticketId}/messages/${messageId}/attachment`
    : `${environment.apiUrl}/support/tickets/${ticketId}/attachment`;
  http.get(url, { responseType: 'blob' }).subscribe({
    next: (blob) => {
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    },
    error: () => onError?.(),
  });
}
