import { HttpErrorResponse } from '@angular/common/http';
import {
  formatOfflineSyncError,
  offlineSyncItemLabel,
} from './offline-sync-error.util';

describe('offline-sync-error.util', () => {
  it('labels character saves', () => {
    expect(
      offlineSyncItemLabel({ type: 'character-save', name: '  Aria  ' }),
    ).toBe('Personnage « Aria »');
    expect(offlineSyncItemLabel({ type: 'character-save', name: '   ' })).toContain('sans nom');
  });

  it('labels campaign queue items', () => {
    expect(
      offlineSyncItemLabel({ type: 'campaign-create', title: 'Les Ombres' }),
    ).toContain('(création)');
    expect(
      offlineSyncItemLabel({ type: 'campaign-update', title: 'Acte II' }),
    ).toContain('(mise à jour)');
    expect(offlineSyncItemLabel({ type: 'campaign-update' })).toContain('sans titre');
  });

  it('formats network and auth errors', () => {
    expect(
      formatOfflineSyncError(
        { type: 'character-save', name: 'Hero' },
        new HttpErrorResponse({ status: 0 }),
      ),
    ).toContain('serveur inaccessible');
    expect(
      formatOfflineSyncError(
        { type: 'character-save', name: 'Hero' },
        new HttpErrorResponse({ status: 401 }),
      ),
    ).toContain('session expirée');
    expect(
      formatOfflineSyncError(
        { type: 'character-save', name: 'Hero' },
        new HttpErrorResponse({ status: 403 }),
      ),
    ).toContain('session expirée');
  });

  it('formats API validation errors with reason', () => {
    expect(
      formatOfflineSyncError(
        { type: 'character-save', name: 'Hero' },
        new HttpErrorResponse({ status: 422, error: { message: 'Payload invalide' } }),
      ),
    ).toContain('Payload invalide');
    expect(
      formatOfflineSyncError(
        { type: 'campaign-create', title: 'Camp' },
        new HttpErrorResponse({ status: 400, error: { errors: [{ reason: 'Titre requis' }] } }),
      ),
    ).toContain('Titre requis');
  });

  it('formats generic http and unknown errors', () => {
    expect(
      formatOfflineSyncError(
        { type: 'campaign-update', title: 'Camp' },
        new HttpErrorResponse({ status: 500 }),
      ),
    ).toContain('erreur 500');
    expect(
      formatOfflineSyncError({ type: 'character-save', name: 'X' }, new Error('boom')),
    ).toContain('échec de synchronisation');
  });
});
