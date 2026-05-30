import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { ApiClient } from './api-client.service';
import { ReportChatRequest, ReportChatResponse, ReportHistoryEntry, ReportSummary } from '../models/territorial.models';

@Injectable({ providedIn: 'root' })
export class ReportAdapterService {
  private readonly api = inject(ApiClient);
  private readonly baseEndpoint = 'reports';

  fetchSummary(): Observable<ReportSummary[]> {
    // Report endpoints don't exist in backend - return empty array for now
    // TODO: Implement backend endpoints or remove report feature
    return of([]);
  }

  fetchHistory(): Observable<ReportHistoryEntry[]> {
    // Report endpoints don't exist in backend - return empty array for now
    // TODO: Implement backend endpoints or remove report feature
    return of([]);
  }

  sendChat(prompt: string): Observable<ReportChatResponse> {
    // Report endpoints don't exist in backend - return mock response for now
    // TODO: Implement backend endpoints or remove report feature
    return of({ reply: 'El servicio de reportes no está disponible en este momento. Por favor contacte al administrador.' });
  }
}
