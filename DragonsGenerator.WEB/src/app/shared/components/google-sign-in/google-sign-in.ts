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
      <div class="flex flex-col items-center gap-2 my-2">
        <div class="w-full flex items-center gap-3 text-[10px] uppercase tracking-widest text-slate-500">
          <span class="flex-1 h-px bg-slate-700"></span>
          ou
          <span class="flex-1 h-px bg-slate-700"></span>
        </div>
        <div #btn class="min-h-10"></div>
      </div>
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
        if (id) setTimeout(() => this.loadScript(id), 0);
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
      existing.addEventListener('load', () => this.render(clientId));
      return;
    }
    this.script = document.createElement('script');
    this.script.src = 'https://accounts.google.com/gsi/client';
    this.script.async = true;
    this.script.defer = true;
    this.script.onload = () => this.render(clientId);
    document.head.appendChild(this.script);
  }

  private render(clientId: string): void {
    const el = this.btn()?.nativeElement;
    if (!el || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      use_fedcm_for_prompt: true,
      callback: (res: { credential?: string }) => {
        if (res.credential) this.credential.emit(res.credential);
      },
    });
    window.google.accounts.id.renderButton(el, {
      theme: 'filled_black',
      size: 'large',
      width: 320,
      locale: 'fr',
      text: 'continue_with',
    });
  }
}
