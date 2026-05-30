import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent {
  private readonly confirmDialogService = inject(ConfirmDialogService);

  readonly dialog = this.confirmDialogService.dialog;

  accept(): void {
    this.confirmDialogService.accept();
  }

  cancel(): void {
    this.confirmDialogService.cancel();
  }
}
