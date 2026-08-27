import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from '@env/environment';

/** Dev mobile (ng serve :4200) : l'API locale est sur le port 5117 du même hôte. */
function patchApiUrlForLan(): void {
  if (typeof window === 'undefined' || environment.production) return;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return;
  if (window.location.port === '4200') {
    environment.apiUrl = `http://${host}:5117`;
  }
}

patchApiUrlForLan();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
