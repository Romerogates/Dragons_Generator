import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { rollDie } from '@core/utils/combat-roll.util';

export type DiceRollPhase = 'idle' | 'rolling' | 'result';

@Component({
  selector: 'app-dice-roll',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex flex-col items-start gap-2">
      @if (method() === 'encode') {
        <div class="flex flex-wrap items-center gap-2">
          <input
            type="number"
            [min]="1"
            [max]="faces()"
            class="w-16 min-h-10 bg-[#171b22] border border-slate-700 rounded-lg text-center text-sm text-slate-200 py-1"
            [ngModel]="encodeValue()"
            (ngModelChange)="encodeValue.set(+$event || 1)"
            [attr.aria-label]="'Encoder un d' + faces()"
          />
          <button
            type="button"
            class="min-h-10 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border border-amber-800/50 text-amber-200 hover:bg-amber-950/40 disabled:opacity-40"
            [disabled]="disabled()"
            (click)="confirmEncode()"
          >
            Valider
          </button>
        </div>
      } @else {
        <div class="flex flex-wrap items-center gap-3">
          <div
            class="dice-face relative w-12 h-12 rounded-xl border-2 border-amber-700/60 bg-gradient-to-br from-amber-900/80 to-slate-900 flex items-center justify-center font-mono text-lg text-amber-100 shadow-inner"
            [class.dice-rolling]="phase() === 'rolling'"
            aria-live="polite"
          >
            {{ displayFace() }}
          </div>
          <button
            type="button"
            class="min-h-10 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase border border-sky-800/50 text-sky-200 hover:bg-sky-950/40 disabled:opacity-40"
            [disabled]="disabled() || phase() === 'rolling'"
            (click)="launchDice()"
          >
            @if (phase() === 'rolling') {
              Lancer…
            } @else {
              Lancer d{{ faces() }}
            }
          </button>
        </div>
      }
      @if (phase() === 'result' && lastResult() != null) {
        <p class="text-[10px] font-black uppercase tracking-widest text-emerald-400">
          Résultat : {{ lastResult() }}
        </p>
      }
    </div>
  `,
  styles: `
    .dice-rolling {
      animation: dice-tumble 0.9s ease-in-out;
    }
    @keyframes dice-tumble {
      0% {
        transform: rotate(0deg) scale(1);
      }
      25% {
        transform: rotate(90deg) scale(1.08);
      }
      50% {
        transform: rotate(180deg) scale(0.95);
      }
      75% {
        transform: rotate(270deg) scale(1.05);
      }
      100% {
        transform: rotate(360deg) scale(1);
      }
    }
  `,
})
export class DiceRollComponent {
  readonly faces = input(20);
  /** `dice` = animation ; `encode` = saisie manuelle. */
  readonly method = input<'dice' | 'encode'>('dice');
  readonly disabled = input(false);
  readonly label = input('Jet');

  readonly rolled = output<number>();

  readonly phase = signal<DiceRollPhase>('idle');
  readonly lastResult = signal<number | null>(null);
  readonly encodeValue = signal(10);
  readonly spinFace = signal(1);

  displayFace(): string | number {
    if (this.phase() === 'rolling') return this.spinFace();
    if (this.lastResult() != null) return this.lastResult()!;
    return `d${this.faces()}`;
  }

  confirmEncode(): void {
    if (this.disabled()) return;
    const faces = Math.max(1, this.faces());
    const value = Math.min(faces, Math.max(1, Math.floor(this.encodeValue()) || 1));
    this.lastResult.set(value);
    this.phase.set('result');
    this.rolled.emit(value);
  }

  async launchDice(): Promise<void> {
    if (this.disabled() || this.phase() === 'rolling') return;
    this.phase.set('rolling');
    const faces = Math.max(1, this.faces());
    const final = rollDie(faces);
    const started = Date.now();
    const tick = () => {
      if (Date.now() - started < 900) {
        this.spinFace.set(rollDie(faces));
        requestAnimationFrame(tick);
      } else {
        this.lastResult.set(final);
        this.phase.set('result');
        this.rolled.emit(final);
      }
    };
    requestAnimationFrame(tick);
  }

  reset(): void {
    this.phase.set('idle');
    this.lastResult.set(null);
  }
}
