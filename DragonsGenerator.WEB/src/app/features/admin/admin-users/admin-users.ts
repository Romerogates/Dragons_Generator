import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { AdminUser, AdminUserEdit } from '../admin.types';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersPanel {
  readonly users = input<AdminUser[]>([]);
  readonly edits = input<Record<string, AdminUserEdit>>({});
  readonly saveUser = output<string>();
  readonly sendReset = output<string>();
}
