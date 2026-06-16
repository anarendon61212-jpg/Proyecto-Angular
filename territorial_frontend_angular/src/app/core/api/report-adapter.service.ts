import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ApiClient } from './api-client.service';
import { LocalStorageService } from '../services/local-storage.service';
import { ReportChatRequest, ReportChatResponse, ReportHistoryEntry, ReportSummary } from '../models/territorial.models';

@Injectable({ providedIn: 'root' })
export class ReportAdapterService {
  private readonly api = inject(ApiClient);
  private readonly localStorageService = inject(LocalStorageService);
  private readonly baseEndpoint = 'reports';
  private readonly localStorageKey = 'reports_history';

  private getLocalHistory(): ReportHistoryEntry[] {
    const history = this.localStorageService.getItem<ReportHistoryEntry[]>(this.localStorageKey);
    return history || [];
  }

  private saveToLocalHistory(entry: ReportHistoryEntry): void {
    const history = this.getLocalHistory();
    history.unshift(entry); // Add to beginning
    // Keep only last 50 entries
    if (history.length > 50) {
      history.pop();
    }
    this.localStorageService.setItem(this.localStorageKey, history);
  }

  fetchSummary(): Observable<ReportSummary[]> {
    // Report endpoints don't exist in backend - return empty array for now
    // TODO: Implement backend endpoints or remove report feature
    return of([]);
  }

  fetchHistory(): Observable<ReportHistoryEntry[]> {
    console.log('Intentando obtener historial de reportes...');
    return this.api.get<ReportHistoryEntry[]>(`${this.baseEndpoint}/history`).pipe(
      catchError((error) => {
        console.error('Error al obtener historial de reportes del backend:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        console.log('Usando localStorage como fallback...');
        // Fallback to localStorage if backend endpoint doesn't exist
        return of(this.getLocalHistory());
      })
    );
  }

  sendChat(prompt: string): Observable<ReportChatResponse> {
    // This method is no longer used - chat uses GeminiChartService directly
    return of({ reply: 'El servicio de reportes no está disponible en este momento. Por favor contacte al administrador.' });
  }

  saveReportToHistory(query: string, chartType: string): Observable<ReportHistoryEntry> {
    const payload = {
      title: query,
      summary: `Gráfica generada: ${chartType}`,
      type: chartType
    };
    console.log('Intentando guardar reporte en historial:', payload);
    
    return this.api.create<ReportHistoryEntry>(`${this.baseEndpoint}/history`, payload).pipe(
      map((response) => {
        // Save to localStorage as backup even if backend succeeds
        this.saveToLocalHistory(response);
        return response;
      }),
      catchError((error) => {
        console.error('Error al guardar en historial del backend:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        console.log('Guardando en localStorage como fallback...');
        
        // Create entry and save to localStorage
        const localEntry: ReportHistoryEntry = {
          id_report: Date.now(),
          title: query,
          summary: `Gráfica generada: ${chartType}`,
          type: chartType,
          created_at: new Date().toISOString()
        };
        this.saveToLocalHistory(localEntry);
        
        console.log('Reporte guardado en localStorage');
        return of(localEntry);
      })
    );
  }
}
