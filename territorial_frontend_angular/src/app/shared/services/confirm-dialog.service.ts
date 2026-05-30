import { Injectable, signal } from '@angular/core';

export type ConfirmDialogTone = 'primary' | 'danger';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmDialogTone;
}

export interface ConfirmDialogState extends Required<ConfirmDialogOptions> {}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private resolver: ((confirmed: boolean) => void) | null = null;
  private readonly dialogState = signal<ConfirmDialogState | null>(null);

  readonly dialog = this.dialogState.asReadonly();

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    this.resolve(false);

    const state: ConfirmDialogState = {
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? 'Confirmar',
      cancelText: options.cancelText ?? 'Cancelar',
      tone: options.tone ?? 'primary'
    };

    this.dialogState.set(state);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  accept(): void {
    this.resolve(true);
  }

  cancel(): void {
    this.resolve(false);
  }

  private resolve(confirmed: boolean): void {
    if (this.resolver) {
      this.resolver(confirmed);
      this.resolver = null;
    }

    this.dialogState.set(null);
  }
}
