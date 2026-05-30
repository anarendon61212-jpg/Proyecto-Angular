import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from './api-client.service';
import { ReportChatRequest, ReportChatResponse, ReportHistoryEntry, ReportSummary } from '../models/territorial.models';

@Injectable({ providedIn: 'root' })
export class ReportAdapterService {
  private readonly api = inject(ApiClient);
  private readonly baseEndpoint = 'reports';

  fetchSummary(): Observable<ReportSummary[]> {
    return this.api.get<ReportSummary[]>(`${this.baseEndpoint}/summary`);
  }

  fetchHistory(): Observable<ReportHistoryEntry[]> {
    return this.api.get<ReportHistoryEntry[]>(`${this.baseEndpoint}/history`);
  }

  sendChat(prompt: string): Observable<ReportChatResponse> {
    const body: ReportChatRequest = { prompt };
    return this.api.create<ReportChatResponse, ReportChatRequest>(`${this.baseEndpoint}/chat`, body);
  }
}
