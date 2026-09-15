import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

export interface BookTocItem {
  id: string;
  label: string;
  subtitle?: string;
}

/**
 * Coquille « Mode Livre » — plein écran, parchemin, TOC optionnelle.
 */
@Component({
  selector: 'app-book-reader-shell',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './book-reader-shell.html',
  styleUrl: './book-reader-shell.scss',
})
export class BookReaderShell implements OnInit, OnDestroy {
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly title = input('Livre');
  readonly subtitle = input<string | null>(null);
  readonly backLink = input('/');
  readonly backLabel = input('Retour');
  readonly toc = input<BookTocItem[]>([]);
  readonly activeId = input<string | null>(null);
  readonly showToc = input(false);

  readonly selectItem = output<string>();

  private previousOverflow = '';
  private onKeydown = (ev: KeyboardEvent): void => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.close();
    }
  };

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      this.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', this.onKeydown);
    }
    this.destroyRef.onDestroy(() => this.restoreBody());
  }

  ngOnDestroy(): void {
    this.restoreBody();
  }

  close(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl(this.backLink());
  }

  private restoreBody(): void {
    if (typeof document === 'undefined') return;
    document.removeEventListener('keydown', this.onKeydown);
    document.body.style.overflow = this.previousOverflow;
  }
}
