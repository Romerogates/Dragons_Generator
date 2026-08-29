import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  buildMechanicsBlocks,
  buildOptionBlocks,
  buildOptionGroupBlocks,
  type MechanicsBlock,
} from '../species-mechanics.util';

@Component({
  selector: 'app-species-mechanics-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (blocks().length > 0) {
      <div
        class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        [class.mt-0]="nested()"
        [class.sm:grid-cols-1]="nested()"
      >
        @for (block of blocks(); track $index) {
          <article
            class="bg-[#0f1218] border border-slate-800/80 rounded-xl p-4"
            [class.pl-6]="nested()"
            [class.border-l-2]="nested()"
            [class.border-l-amber-500/30]="nested()"
          >
            @if (block.title) {
              <h4 class="text-xs font-bold text-amber-400 font-serif mb-1">{{ block.title }}</h4>
            }
            @if (block.desc) {
              <p class="text-xs text-slate-400 leading-relaxed mb-3">{{ block.desc }}</p>
            }
            @if (block.badges.length > 0) {
              <div class="flex flex-wrap gap-1.5 mb-3">
                @for (badge of block.badges; track badge) {
                  <span
                    class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-950/40 text-amber-300 border border-amber-900/40"
                    >{{ badge }}</span
                  >
                }
              </div>
            }
            @if (block.rows.length > 0) {
              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                @for (r of block.rows; track r.label + r.value) {
                  <div class="min-w-0">
                    <dt class="text-[9px] font-black uppercase tracking-widest text-slate-500">{{ r.label }}</dt>
                    <dd class="text-xs text-slate-300 mt-0.5 leading-snug">{{ r.value }}</dd>
                  </div>
                }
              </dl>
            }
            @if (block.note) {
              <p class="text-[10px] text-slate-500 italic mt-3 border-t border-slate-800/80 pt-2">{{ block.note }}</p>
            }
            @if (block.children && block.children.length > 0) {
              <div class="mt-3 space-y-2 pl-3 border-l border-slate-800/80">
                @for (child of block.children; track $index) {
                  @if (child.title) {
                    <p class="text-[10px] font-bold text-slate-400 font-serif">{{ child.title }}</p>
                  }
                  @if (child.desc) {
                    <p class="text-xs text-slate-500 mb-2">{{ child.desc }}</p>
                  }
                  @if (child.rows.length > 0) {
                    <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 mb-2">
                      @for (r of child.rows; track r.label + r.value) {
                        <div>
                          <dt class="text-[9px] uppercase tracking-widest text-slate-600">{{ r.label }}</dt>
                          <dd class="text-xs text-slate-400">{{ r.value }}</dd>
                        </div>
                      }
                    </dl>
                  }
                }
              </div>
            }
          </article>
        }
      </div>
    }
    @if (groups().length > 0) {
      <div class="mt-4 space-y-4">
        @for (group of groups(); track group.name) {
          <div>
            <p class="text-[10px] font-black uppercase tracking-widest text-fuchsia-500/80 mb-2">{{ group.name }}</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              @for (block of group.blocks; track $index) {
                <article class="bg-[#0f1218] border border-slate-800/80 rounded-xl p-4">
                  @if (block.title) {
                    <h4 class="text-xs font-bold text-fuchsia-300 font-serif mb-1">{{ block.title }}</h4>
                  }
                  @if (block.desc) {
                    <p class="text-xs text-slate-400 leading-relaxed mb-2">{{ block.desc }}</p>
                  }
                  @if (block.rows.length > 0) {
                    <dl class="space-y-1.5">
                      @for (r of block.rows; track r.label + r.value) {
                        <div>
                          <dt class="text-[9px] uppercase tracking-widest text-slate-600">{{ r.label }}</dt>
                          <dd class="text-xs text-slate-300">{{ r.value }}</dd>
                        </div>
                      }
                    </dl>
                  }
                </article>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class SpeciesMechanicsPanel {
  readonly mechanics = input<unknown>();
  readonly options = input<unknown>();
  readonly optionGroups = input<unknown>();
  readonly choiceType = input<string>();
  readonly blocksInput = input<MechanicsBlock[]>();
  readonly nested = input(false);

  readonly blocks = computed(() => {
    const direct = this.blocksInput();
    if (direct && direct.length > 0) return direct;
    const mech = this.mechanics();
    if (mech !== undefined && mech !== null) return buildMechanicsBlocks(mech);
    const opts = this.options();
    if (opts !== undefined && opts !== null) return buildOptionBlocks(opts, this.choiceType());
    return [];
  });

  readonly groups = computed(() => {
    const g = this.optionGroups();
    if (g === undefined || g === null) return [];
    return buildOptionGroupBlocks(g);
  });
}
