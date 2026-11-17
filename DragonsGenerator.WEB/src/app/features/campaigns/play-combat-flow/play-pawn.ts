import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  kenneySpriteUrl,
  type KenneyPawnPose,
  type KenneyPawnSide,
} from '@core/utils/play-kenney-sprite.util';

@Component({
  selector: 'app-play-pawn',
  standalone: true,
  template: `
    <img
      [src]="src()"
      alt=""
      class="dg-pawn"
      [class.dg-pawn-idle]="pose() === 'idle'"
      [class.dg-pawn-slash]="pose() === 'attack'"
      [class.dg-pawn-wait]="pose() === 'wait'"
      [attr.data-testid]="'play-pawn-' + side()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlayPawn {
  readonly pawnId = input.required<string>();
  readonly side = input<KenneyPawnSide>('ally');
  readonly pose = input<KenneyPawnPose>('idle');

  readonly src = computed(() => kenneySpriteUrl(this.pawnId(), this.side()));
}
