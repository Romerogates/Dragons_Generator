import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
        };
      };
    };
  }
}

@Component({
  selector: 'app-google-sign-in',
  standalone: true,
  template: `
    @if (clientId()) {
      <div class="flex flex-col items-stretch gap-3 my-1">
        <div class="w-full flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-500">
          <span class="flex-1 h-px bg-slate-700"></span>
          ou
          <span class="flex-1 h-px bg-slate-700"></span>
        </div>
        <div class="google-btn-shell">
          <div class="google-btn-face" aria-hidden="true">
            <svg viewBox="0 0 48 48" class="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>Continuer avec Google</span>
          </div>
          <div #btn class="google-btn-host"></div>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .google-btn-shell {
      position: relative;
      width: 100%;
      min-height: 48px;
      border-radius: 9999px;
      overflow: hidden;
      background: #fff;
      box-shadow:
        0 1px 2px rgb(0 0 0 / 0.25),
        0 0 0 1px rgb(226 232 240 / 0.9);
    }
    .google-btn-face {
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      min-height: 48px;
      padding: 0 1.25rem;
      color: #1f2937;
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .google-btn-host {
      position: absolute;
      inset: 0;
      opacity: 0.02;
    }
    .google-btn-host ::ng-deep div,
    .google-btn-host ::ng-deep iframe {
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleSignInComponent implements AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  readonly acceptTerms = input(false);
  readonly credential = output<string>();
  readonly clientId = signal<string | null>(null);
  readonly btn = viewChild<ElementRef<HTMLElement>>('btn');
  private script?: HTMLScriptElement;

  ngAfterViewInit(): void {
    this.http.get<{ googleClientId?: string | null }>(`${environment.apiUrl}/auth/providers`).subscribe({
      next: (p) => {
        const id = p.googleClientId?.trim() || null;
        this.clientId.set(id);
        if (id) this.loadScript(id);
      },
    });
  }

  ngOnDestroy(): void {
    this.script?.remove();
  }

  private loadScript(clientId: string): void {
    if (window.google?.accounts?.id) {
      this.render(clientId);
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google?.accounts?.id) this.render(clientId);
      else existing.addEventListener('load', () => this.render(clientId));
      return;
    }
    this.script = document.createElement('script');
    this.script.src = 'https://accounts.google.com/gsi/client';
    this.script.async = true;
    this.script.defer = true;
    this.script.onload = () => this.render(clientId);
    document.head.appendChild(this.script);
  }

  private render(clientId: string, attempt = 0): void {
    const el = this.btn()?.nativeElement;
    if (!el || !window.google?.accounts?.id) {
      if (attempt < 25) setTimeout(() => this.render(clientId, attempt + 1), 40);
      return;
    }
    window.google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      use_fedcm_for_prompt: true,
      callback: (res: { credential?: string }) => {
        if (res.credential) this.credential.emit(res.credential);
      },
    });
    const width = Math.max(240, Math.round(el.clientWidth || el.parentElement?.clientWidth || 320));
    window.google.accounts.id.renderButton(el, {
      theme: 'outline',
      size: 'large',
      type: 'standard',
      shape: 'pill',
      logo_alignment: 'left',
      width,
      locale: 'fr',
      text: 'continue_with',
    });
  }
}
