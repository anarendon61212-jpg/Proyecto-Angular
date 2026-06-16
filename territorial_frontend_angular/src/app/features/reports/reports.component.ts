import { Component, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import { Subject, takeUntil } from 'rxjs';

import { ReportAdapterService } from '../../core/api/report-adapter.service';
import { GeminiChartService, GeminiChartData } from '../../gemini-chart/gemini-chart.service';
import {
  ReportChatMessage,
  ReportHistoryEntry
} from '../../core/models/territorial.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  template: `
    <div class="reports-page">
      <section class="reports-history app-card">
        <header>
          <h3>Historial de reportes</h3>
          <p>Últimos reportes generados por el backend.</p>
        </header>

        <div class="history-actions">
          <input type="search" placeholder="Filtrar historial" [(ngModel)]="historySearch" (input)="filterHistory()" />
        </div>

        <table class="history-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>Tipo</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let entry of filteredHistory">
              <td>{{ entry.id_report }}</td>
              <td>{{ entry.title }}</td>
              <td>{{ entry.type }}</td>
              <td>{{ entry.created_at | date:'medium' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="reports-chat app-card">
        <header>
          <h3>Chat de reportes</h3>
          <p>Interactúe con el asistente para generar gráficas a partir de consultas en lenguaje natural.</p>
        </header>

        <div class="chat-window">
          <div *ngFor="let message of chatMessages" [class]="message.role === 'user' ? 'chat-message chat-message--user' : 'chat-message chat-message--assistant'">
            <span class="chat-role">{{ message.role === 'user' ? 'Tú' : 'Asistente' }}</span>
            <p>{{ message.message }}</p>
          </div>
        </div>

        <div *ngIf="chartLoading" class="chart-loading">
          Generando gráfica... ⏳
        </div>

        <div *ngIf="showChart" class="chart-container">
          <apx-chart
            #reportChart
            [series]="chartOptions.series"
            [chart]="chartOptions.chart"
            [labels]="chartOptions.labels"
            [xaxis]="chartOptions.xaxis"
            [responsive]="chartOptions.responsive"
          ></apx-chart>
        </div>

        <div *ngIf="chartError" class="chart-error">
          <strong>Error:</strong> {{ chartError }}
        </div>

        <form class="chat-form" (ngSubmit)="sendChat()">
          <input type="text" [(ngModel)]="chatPrompt" name="chatPrompt" placeholder="Ej: mostrar anotaciones por categoría" />
          <button type="submit" class="app-button app-button--primary">Generar</button>
        </form>
      </section>
    </div>
  `,
  styles: [
    ".reports-page { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; min-height: calc(100vh - 3rem); }",
    ".reports-history, .reports-chat { padding: 1.25rem; }",
    ".history-actions { margin: 1rem 0; }",
    ".history-actions input { width: 100%; border: 1px solid var(--color-border); border-radius: 0.75rem; padding: 0.8rem; }",
    ".history-table { width: 100%; border-collapse: collapse; }",
    ".history-table th, .history-table td { padding: 0.85rem 0.75rem; border-bottom: 1px solid var(--color-border); text-align: left; }",
    ".chat-window { min-height: 240px; max-height: 420px; overflow-y: auto; display: grid; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 1rem; background: #f9fafb; }",
    ".chat-message { padding: 0.9rem 1rem; border-radius: 1rem; max-width: 90%; }",
    ".chat-message--user { margin-left: auto; background: #dbeafe; }",
    ".chat-message--assistant { margin-right: auto; background: #eef2ff; }",
    ".chat-role { display: block; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.35rem; }",
    ".chat-form { display: grid; grid-template-columns: 1fr auto; gap: 0.75rem; margin-top: 1rem; }",
    ".chat-form input { border: 1px solid var(--color-border); border-radius: 0.75rem; padding: 0.85rem; font: inherit; }",
    ".chart-loading { padding: 1rem; text-align: center; color: #555; background: #f3f4f6; border-radius: 0.75rem; margin: 1rem 0; }",
    ".chart-container { margin: 1rem 0; padding: 1rem; border: 1px solid var(--color-border); border-radius: 1rem; background: white; min-height: 300px; }",
    ".chart-error { padding: 1rem; color: #a00; background: #fee; border: 1px solid #fbb; border-radius: 0.75rem; margin: 1rem 0; }",
    "@media (max-width: 1100px) { .reports-page { grid-template-columns: 1fr; } }"
  ]
})
export class ReportsComponent implements OnDestroy {
  private readonly reportService = inject(ReportAdapterService);
  private readonly geminiChartService = inject(GeminiChartService);
  private readonly toastService = inject(ToastService);
  private readonly destroy$ = new Subject<void>();
  history: ReportHistoryEntry[] = [];
  filteredHistory: ReportHistoryEntry[] = [];
  chatMessages: ReportChatMessage[] = [];
  chatPrompt = '';

  @ViewChild('reportChart') reportChart?: ChartComponent;
  public chartOptions: any;
  public chartLoading = false;
  public chartError: string | null = null;
  public showChart = false;

  constructor() {
    this.initializeChartOptions();
    this.loadReports();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  sendChat(): void {
    const prompt = this.chatPrompt.trim();
    if (!prompt) {
      return;
    }

    const userMessage: ReportChatMessage = { role: 'user', message: prompt, timestamp: new Date().toISOString() };
    this.chatMessages.push(userMessage);
    this.chatPrompt = '';

    this.chartLoading = true;
    this.chartError = null;
    this.showChart = false;

    this.geminiChartService.getChartData(prompt).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.applyChartData(data, prompt);
        const correctedType = this.correctChartType(data.type, prompt);
        const assistantMessage: ReportChatMessage = {
          role: 'assistant',
          message: `Gráfica generada: ${this.getChartTypeLabel(correctedType)}`,
          timestamp: new Date().toISOString()
        };
        this.chatMessages.push(assistantMessage);
        
        // Save to history
        this.saveToHistory(prompt, correctedType);
      },
      error: (err) => {
        console.error('Error completo del servicio:', err);
        const message = this.extractErrorMessage(err);
        console.error('Mensaje de error extraído:', message);
        
        // Check if it's a temporal query that failed
        const lowerPrompt = prompt.toLowerCase();
        const isTemporalQuery = ['tendencia', 'evolución', 'mes', 'año', 'tiempo', 'histórico', 'trimestre', 'semana'].some(kw => lowerPrompt.includes(kw));
        
        if (isTemporalQuery && err.status === 500) {
          // Try fallback with a more general temporal query
          console.log('Intentando consulta temporal más general como fallback...');
          const fallbackPrompt = this.getFallbackTemporalQuery(prompt);
          
          this.geminiChartService.getChartData(fallbackPrompt).pipe(takeUntil(this.destroy$)).subscribe({
            next: (data) => {
              this.applyChartData(data, fallbackPrompt);
              const correctedType = this.correctChartType(data.type, fallbackPrompt);
              const assistantMessage: ReportChatMessage = {
                role: 'assistant',
                message: `Gráfica generada con consulta general: ${this.getChartTypeLabel(correctedType)}. (La consulta específica no tuvo datos suficientes)`,
                timestamp: new Date().toISOString()
              };
              this.chatMessages.push(assistantMessage);
            },
            error: (fallbackErr) => {
              console.error('Fallback también falló:', fallbackErr);
              this.chartError = message;
              this.chartLoading = false;
              const assistantMessage: ReportChatMessage = {
                role: 'assistant',
                message: `Error: ${message}. Las consultas temporales específicas requieren más datos históricos. Intenta con "Evolución de anotaciones en el tiempo" para una vista general.`,
                timestamp: new Date().toISOString()
              };
              this.chatMessages.push(assistantMessage);
            }
          });
        } else {
          this.chartError = message;
          this.chartLoading = false;
          let errorMessage = `Error: ${message}`;
          if (isTemporalQuery) {
            errorMessage += '. Las consultas temporales requieren datos históricos. Verifica que haya suficientes registros en el sistema.';
          }
          
          const assistantMessage: ReportChatMessage = {
            role: 'assistant',
            message: errorMessage,
            timestamp: new Date().toISOString()
          };
          this.chatMessages.push(assistantMessage);
        }
      }
    });
  }

  filterHistory(): void {
    const search = this.historySearch.trim().toLowerCase();
    this.filteredHistory = this.history.filter((entry) =>
      entry.title.toLowerCase().includes(search) || entry.summary?.toLowerCase().includes(search) || entry.type.toLowerCase().includes(search)
    );
  }

  private loadReports(): void {
    this.reportService.fetchHistory().pipe(takeUntil(this.destroy$)).subscribe({
      next: (history) => {
        this.history = history;
        this.filteredHistory = [...history];
      },
      error: () => {
        this.toastService.warning('Historial no disponible', 'No se pudo cargar el historial de reportes.');
      }
    });
  }

  private saveToHistory(query: string, chartType: string): void {
    this.reportService.saveReportToHistory(query, chartType).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        // Reload history after saving
        this.loadReports();
      },
      error: (err) => {
        console.error('Error al guardar en historial:', err);
        // Don't show error to user - chart generation was successful
      }
    });
  }

  private initializeChartOptions(): void {
    this.chartOptions = {
      series: [44, 55, 13, 43, 22],
      chart: {
        width: '100%',
        type: 'pie'
      },
      labels: ['Equipo A', 'Equipo B', 'Equipo C', 'Equipo D', 'Equipo E'],
      xaxis: {
        categories: []
      },
      responsive: [
        {
          breakpoint: 480,
          options: {
            chart: {
              width: 200
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      ]
    };
  }

  private extractErrorMessage(err: unknown): string {
    const anyErr = err as any;
    if (anyErr?.error?.message) {
      return String(anyErr.error.message);
    }
    if (anyErr?.message) {
      return String(anyErr.message);
    }
    return 'Error desconocido al generar el reporte.';
  }

  private getChartTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      pie: 'Gráfica circular',
      bar: 'Gráfica de barras',
      line: 'Gráfica de líneas'
    };
    return labels[type] || 'Gráfica';
  }

  private applyChartData(data: GeminiChartData, query: string): void {
    const correctedType = this.correctChartType(data.type, query);
    
    // Format series data for ApexCharts based on chart type
    let formattedSeries;
    if (correctedType === 'pie') {
      formattedSeries = data.series as number[];
    } else {
      // For bar and line charts, ensure series is in the correct format
      if (Array.isArray(data.series) && typeof data.series[0] === 'number') {
        // If series is a simple number array, wrap it in object format
        formattedSeries = [{ name: 'Datos', data: data.series as number[] }];
      } else {
        formattedSeries = data.series;
      }
    }
    
    this.chartOptions = {
      ...this.chartOptions,
      chart: {
        ...this.chartOptions.chart,
        type: correctedType
      },
      series: formattedSeries,
      labels: correctedType === 'pie' ? data.labels : undefined,
      xaxis: correctedType !== 'pie' ? { categories: data.labels } : this.chartOptions.xaxis
    };
    this.chartLoading = false;
    this.showChart = true;
  }

  private getFallbackTemporalQuery(originalQuery: string): string {
    const lowerQuery = originalQuery.toLowerCase();
    
    // Replace specific temporal periods with general temporal terms
    let fallbackQuery = originalQuery
      .replace(/por mes/gi, 'en el tiempo')
      .replace(/por semana/gi, 'en el tiempo')
      .replace(/por trimestre/gi, 'en el tiempo')
      .replace(/por año/gi, 'en el tiempo')
      .replace(/mensuales/gi, 'temporales')
      .replace(/semanales/gi, 'temporales')
      .replace(/trimestrales/gi, 'temporales')
      .replace(/anuales/gi, 'temporales');
    
    // If the query is still too specific, use a completely general fallback
    if (fallbackQuery === originalQuery) {
      fallbackQuery = 'Evolución de anotaciones en el tiempo';
    }
    
    console.log(`Fallback: "${originalQuery}" -> "${fallbackQuery}"`);
    return fallbackQuery;
  }

  private correctChartType(backendType: string, query: string): 'pie' | 'bar' | 'line' {
    const lowerQuery = query.toLowerCase();
    
    // Keywords for each chart type
    const pieKeywords = ['proporción', 'porcentaje', 'distribución', 'partes de un todo', 'participación', 'reparto'];
    const barKeywords = ['cantidad', 'comparación', 'contar', 'número de', 'cuántos', 'cuántas', 'total de', 'conteo', 'comparar'];
    const lineKeywords = ['evolución', 'tendencia', 'tiempo', 'histórico', 'mes', 'año', 'periodo', 'trimestre', 'semana', 'día', 'progresión', 'cambio', 'serie temporal'];
    
    // Check for line chart keywords first (temporal data)
    if (lineKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return 'line';
    }
    
    // Check for bar chart keywords (comparison/quantity)
    if (barKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return 'bar';
    }
    
    // Check for pie chart keywords (proportion/distribution)
    if (pieKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return 'pie';
    }
    
    // If no keywords match, return the backend's suggestion
    return backendType as 'pie' | 'bar' | 'line';
  }

  historySearch = '';
}
