import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { HostBackupFile, Overview } from '../admin.types';

@Component({
  selector: 'app-admin-ops',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-ops.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOpsPanel {
  readonly overview = input<Overview | null>(null);
  readonly hostBackups = input<HostBackupFile[]>([]);
  readonly downloadBackup = output<string>();
}
