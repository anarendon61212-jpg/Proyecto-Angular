import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  title: string;
  message?: string;
  variant: ToastVariant;
  durationMs: number;
}

export interface ToastOptions {
  title: string;
  message?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastId = 0;
  private readonly toastMessages = signal<ToastMessage[]>([]);

  readonly toasts = this.toastMessages.asReadonly();

  show(options: ToastOptions): void {
    const toast: ToastMessage = {
      id: ++this.toastId,
      title: options.title,
      message: options.message,
      variant: options.variant ?? 'info',
      durationMs: options.durationMs ?? 4500
    };

    this.toastMessages.update((messages) => [...messages, toast]);

    if (toast.durationMs > 0) {
      window.setTimeout(() => this.dismiss(toast.id), toast.durationMs);
    }
  }

  success(title: string, message?: string): void {
    this.show({ title, message, variant: 'success' });
  }

  danger(title: string, message?: string): void {
    this.show({ title, message, variant: 'danger' });
  }

  warning(title: string, message?: string): void {
    this.show({ title, message, variant: 'warning' });
  }

  info(title: string, message?: string): void {
    this.show({ title, message, variant: 'info' });
  }

  dismiss(id: number): void {
    this.toastMessages.update((messages) => messages.filter((message) => message.id !== id));
  }
}
