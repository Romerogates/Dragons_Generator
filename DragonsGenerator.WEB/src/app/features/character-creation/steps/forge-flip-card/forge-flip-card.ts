import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ForgeFlipCardModel {
  id: string;
  title: string;
  desc: string;
  stats?: string;
  badge?: string;
  icon: string;
  emoji?: string;
}

@Component({
  selector: 'app-forge-flip-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './forge-flip-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ForgeFlipCard {
  readonly card = input.required<ForgeFlipCardModel>();
  readonly centered = input(false);
  readonly flipped = input(false);
  readonly badgePrefix = input('');
  readonly infoLabel = input('Voir les infos');
  readonly backLabel = input('Retourner');
  readonly confirmLabel = input('Forger cette voie');
  readonly flip = output<MouseEvent>();
}
