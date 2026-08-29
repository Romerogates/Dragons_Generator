import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { Equipment } from '@core/models/Equipments/equipment';
import {
  equipmentSubtypeLabel,
  equipmentTypeLabel,
  type EquipmentDisplayLike,
} from '@core/utils/equipment-display.util';
import {
  equipmentDetailCards,
  equipmentDetailDescription,
} from '@core/utils/equipment-detail-cards.util';

@Component({
  selector: 'app-equipment-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './equipment-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class EquipmentDetail implements OnInit {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  equipment = signal<Equipment | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  readonly cards = computed(() => {
    const eq = this.equipment();
    if (!eq) return [];
    return equipmentDetailCards(this.asDisplay(eq));
  });

  readonly description = computed(() => {
    const eq = this.equipment();
    if (!eq) return null;
    return equipmentDetailDescription(this.asDisplay(eq));
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Identifiant manquant');
      this.loading.set(false);
      return;
    }
    this.dataService.getEquipmentById(id).subscribe({
      next: (eq) => {
        this.equipment.set(eq);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Équipement introuvable dans les archives.');
        this.loading.set(false);
        console.error(err);
      },
    });
  }

  translateType(type: string): string {
    return equipmentTypeLabel(type);
  }

  translateSubtype(subtype: string | null): string {
    return equipmentSubtypeLabel(subtype) || '—';
  }

  private asDisplay(eq: Equipment): EquipmentDisplayLike {
    return {
      type: eq.type,
      subtype: eq.subtype,
      cost: eq.cost,
      wKg: eq.wKg,
      data: (eq.data ?? {}) as Record<string, unknown>,
    };
  }
}
