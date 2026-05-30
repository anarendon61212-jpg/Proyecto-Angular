import { Injectable, signal } from '@angular/core';

import { ApiError } from '../api/api.types';

@Injectable({ providedIn: 'root' })
export class ErrorStateService {
  private readonly lastErrorSignal = signal<ApiError | null>(null);

  readonly lastError = this.lastErrorSignal.asReadonly();

  setError(error: ApiError): void {
    this.lastErrorSignal.set(error);
  }

  clear(): void {
    this.lastErrorSignal.set(null);
  }
}
