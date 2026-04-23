import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';
import { EquipmentSummary } from '@core/models/Equipments/equipment-summary';

@Component({
  selector: 'app-equipments-summary',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './equipments-summary.html',
})
export class EquipmentsSummary implements OnInit {
  private dataService = inject(DataService);

  summaries = signal<EquipmentSummary[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.dataService.getEquipmentsSummary().subscribe({
      next: (data) => {
        this.summaries.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement');
        this.loading.set(false);
        console.error(err);
      },
    });
  }
}
