import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly activeRequests = signal(0);

  readonly isLoading = computed(() => this.activeRequests() > 0);

  start(): void {
    this.activeRequests.update((currentValue) => currentValue + 1);
  }

  stop(): void {
    this.activeRequests.update((currentValue) => Math.max(0, currentValue - 1));
  }
}
