import { HttpErrorResponse } from '@angular/common/http';
import {
  formatCharacterCloudListError,
  formatCharacterCloudLoadError,
  formatCharacterCloudSyncSummary,
} from './character-cloud-sync.util';

describe('character-cloud-sync.util', () => {
  it('formats single character load errors', () => {
    expect(
      formatCharacterCloudLoadError('Aria', new HttpErrorResponse({ status: 0 })),
    ).toContain('serveur inaccessible');
    expect(
      formatCharacterCloudLoadError('Aria', new HttpErrorResponse({ status: 401 })),
    ).toContain('session expirée');
    expect(
      formatCharacterCloudLoadError('  ', new HttpErrorResponse({ status: 404 })),
    ).toContain('sans nom');
    expect(
      formatCharacterCloudLoadError('Bob', new HttpErrorResponse({ status: 500 })),
    ).toContain('erreur 500');
    expect(formatCharacterCloudLoadError('Bob', new Error('boom'))).toContain('échec du chargement');
  });

  it('formats list errors', () => {
    expect(formatCharacterCloudListError(new HttpErrorResponse({ status: 0 }))).toContain(
      'serveur inaccessible',
    );
    expect(formatCharacterCloudListError(new HttpErrorResponse({ status: 403 }))).toContain(
      'reconnectez-vous',
    );
    expect(
      formatCharacterCloudListError(
        new HttpErrorResponse({ status: 422, error: { message: 'Compte suspendu' } }),
      ),
    ).toContain('Compte suspendu');
    expect(formatCharacterCloudListError(new Error('x'))).toContain('Impossible de lister');
  });

  it('summarizes multiple load failures', () => {
    expect(formatCharacterCloudSyncSummary(['Erreur A'])).toBe('Erreur A');
    expect(formatCharacterCloudSyncSummary(['Erreur A', 'Erreur B'])).toContain(
      "2 personnages n'ont pas pu être chargés",
    );
  });
});
