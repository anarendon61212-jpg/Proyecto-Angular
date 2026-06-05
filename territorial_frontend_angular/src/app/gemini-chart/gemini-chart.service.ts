import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClient } from '../core/api/api-client.service';

export interface GeminiChartData {
  type: 'pie' | 'bar' | 'line';
  labels: string[];
  series: number[] | Array<{ name: string; data: number[] }>;
}

interface ReportResponse {
  type: 'pie' | 'bar' | 'line';
  labels: string[];
  series: number[] | Array<{ name: string; data: number[] }>;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiChartService {
  constructor(private apiClient: ApiClient) {}

  getSampleChartData(): Observable<GeminiChartData> {
    return this.apiClient.get<ReportResponse>('reports/test/pie');
  }

  getChartData(query: string): Observable<GeminiChartData> {
    return this.apiClient.create<ReportResponse>('reports', { query });
  }
}
