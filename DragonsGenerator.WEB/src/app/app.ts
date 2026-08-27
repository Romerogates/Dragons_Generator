import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';
import { AppContextMenu } from './shared/components/app-context-menu/app-context-menu';
import { GameLabelCatalogService } from '@core/services/game-label-catalog.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, AppContextMenu],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private readonly gameLabels = inject(GameLabelCatalogService);
  protected readonly title = signal('DragonsGenerator.WEB');

  ngOnInit(): void {
    // Enrichit le dictionnaire d'IDs avec les noms API (équipements / compétences)
    this.gameLabels.warmUp();
  }
}
