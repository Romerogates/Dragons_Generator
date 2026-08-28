import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';
import { AppContextMenu } from './shared/components/app-context-menu/app-context-menu';
import { AiRateLimitDialogComponent } from './shared/components/ai-rate-limit-dialog/ai-rate-limit-dialog';
import { GameLabelCatalogService } from '@core/services/game-label-catalog.service';
import { AuthService } from '@core/services/auth.service';
import { clearPersistedAiRateLimit } from '@core/utils/ai-rate-limit.util';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, AppContextMenu, AiRateLimitDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly gameLabels = inject(GameLabelCatalogService);
  private readonly auth = inject(AuthService);
  protected readonly title = signal('DragonsGenerator.WEB');

  ngOnInit(): void {
    this.gameLabels.warmUp();
    if (this.auth.isAdmin()) clearPersistedAiRateLimit();
  }
}
