import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  inject,
} from '@angular/core';
import { AiRateLimitDialogService } from '@core/services/ai-rate-limit-dialog.service';

@Component({
  selector: 'app-ai-rate-limit-dialog',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './ai-rate-limit-dialog.html',
})
export class AiRateLimitDialogComponent {
  readonly dialog = inject(AiRateLimitDialogService);

  close(): void {
    this.dialog.close();
  }

  login(): void {
    this.dialog.goLogin();
  }
}
