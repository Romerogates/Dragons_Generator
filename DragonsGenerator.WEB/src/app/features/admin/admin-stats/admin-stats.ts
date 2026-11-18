import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatAdminBytes, formatAdminCount, formatAdminDuration } from '../admin-stats.format';
import {
  adminDiskPct,
  adminDiskUsed,
  adminHttpStatusTone,
  adminOldestWaitingLabel,
  adminRamLimit,
  adminRamPct,
  adminRamUsed,
  adminVpsRamPct,
  adminVpsRamUsed,
} from '../admin-stats.metrics';
import type { AdminStats } from '../admin.types';
import { supportCategoryLabel } from '@core/utils/support-category.util';

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-stats.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStatsPanel {
  readonly stats = input<AdminStats | null>(null);
  readonly refresh = output<void>();

  readonly formatBytes = formatAdminBytes;
  readonly formatDuration = formatAdminDuration;
  readonly formatCount = formatAdminCount;

  ramPercent(s: AdminStats): number | null {
    return adminRamPct(s);
  }
  ramUsed(s: AdminStats): number {
    return adminRamUsed(s);
  }
  ramLimit(s: AdminStats): number | null {
    return adminRamLimit(s);
  }
  vpsRamUsed(s: AdminStats): number | null {
    return adminVpsRamUsed(s);
  }
  vpsRamPercent(s: AdminStats): number | null {
    return adminVpsRamPct(s);
  }
  diskUsed(s: AdminStats): number | null {
    return adminDiskUsed(s);
  }
  diskPercent(s: AdminStats): number | null {
    return adminDiskPct(s);
  }
  oldestWaitingLabel(hours: number | null): string {
    return adminOldestWaitingLabel(hours);
  }
  statusTone(status: number): string {
    return adminHttpStatusTone(status);
  }
  categoryLabel(category: string | undefined): string {
    return supportCategoryLabel(category);
  }

  loadStats(): void {
    this.refresh.emit();
  }
}
