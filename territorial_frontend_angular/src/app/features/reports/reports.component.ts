import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Chart from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';
import { Subject, takeUntil } from 'rxjs';

import { ReportAdapterService } from '../../core/api/report-adapter.service';
import {
  ReportChatMessage,
  ReportHistoryEntry,
  ReportSummary
} from '../../core/models/territorial.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reports-page">
      <section class="reports-summary app-card">
        <header>
          <h2>Reportes inteligentes</h2>
          <p>Visualice información histórica, gráfica y converse con el asistente de reportes.</p>
        </header>

        <div class="summary-grid">
          <article class="summary-card" *ngFor="let item of summary">
            <strong>{{ item.label }}</strong>
            <p>{{ item.value }}</p>
          </article>
        </div>

        <div class="charts-grid">
          <div class="chart-card">
            <h3>Anotaciones por categoría</h3>
            <canvas #categoryCanvas></canvas>
          </div>
          <div class="chart-card">
            <h3>Anotaciones por estado</h3>
            <canvas #statusCanvas></canvas>
          </div>
        </div>
      </section>

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
          <p>Interactúe con el asistente para obtener análisis y recomendaciones.</p>
        </header>

        <div class="chat-window">
          <div *ngFor="let message of chatMessages" [class]="message.role === 'user' ? 'chat-message chat-message--user' : 'chat-message chat-message--assistant'">
            <span class="chat-role">{{ message.role === 'user' ? 'Tú' : 'Asistente' }}</span>
            <p>{{ message.message }}</p>
          </div>
        </div>

        <form class="chat-form" (ngSubmit)="sendChat()">
          <input type="text" [(ngModel)]="chatPrompt" name="chatPrompt" placeholder="Haz una pregunta sobre los reportes" />
          <button type="submit" class="app-button app-button--primary">Enviar</button>
        </form>
      </section>
    </div>
  `,
  styles: [
    ".reports-page { display: grid; gap: 1rem; grid-template-columns: 1.2fr 0.8fr; min-height: calc(100vh - 3rem); }",
    ".reports-summary, .reports-history, .reports-chat { padding: 1.25rem; }",
    ".summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-top: 1rem; }",
    ".summary-card { border-radius: 1rem; background: rgba(20, 89, 245, 0.08); padding: 1rem; }",
    ".summary-card strong { display: block; margin-bottom: 0.5rem; }",
    ".charts-grid { display: grid; gap: 1rem; grid-template-columns: 1fr 1fr; margin-top: 1.5rem; }",
    ".chart-card { padding: 1rem; border: 1px solid var(--color-border); border-radius: 1rem; }",
    ".chart-card h3 { margin-top: 0; }",
    ".chart-card canvas { width: 100%; min-height: 260px; }",
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
    "@media (max-width: 1100px) { .reports-page { grid-template-columns: 1fr; } .charts-grid { grid-template-columns: 1fr; } }"
  ]
})
export class ReportsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('categoryCanvas', { static: true }) private readonly categoryCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusCanvas', { static: true }) private readonly statusCanvas!: ElementRef<HTMLCanvasElement>;

  private readonly reportService = inject(ReportAdapterService);
  private readonly toastService = inject(ToastService);
  private readonly destroy$ = new Subject<void>();

  summary: ReportSummary[] = [];
  history: ReportHistoryEntry[] = [];
  filteredHistory: ReportHistoryEntry[] = [];
  chatMessages: ReportChatMessage[] = [];
  chatPrompt = '';

  private charts: Chart[] = [];

  ngAfterViewInit(): void {
    this.initializeCharts();
    this.loadReports();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.charts.forEach((chart) => chart.destroy());
  }

  sendChat(): void {
    const prompt = this.chatPrompt.trim();
    if (!prompt) {
      return;
    }

    const userMessage: ReportChatMessage = { role: 'user', message: prompt, timestamp: new Date().toISOString() };
    this.chatMessages.push(userMessage);
    this.chatPrompt = '';

    this.reportService.sendChat(prompt).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        const assistantMessage: ReportChatMessage = {
          role: 'assistant',
          message: response.reply || 'No se recibió respuesta del asistente.',
          timestamp: new Date().toISOString()
        };
        this.chatMessages.push(assistantMessage);
      },
      error: () => {
        this.toastService.danger('Error de chat', 'No se pudo conectar con el servicio de reportes.');
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
    this.reportService.fetchSummary().pipe(takeUntil(this.destroy$)).subscribe({
      next: (summary) => {
        this.summary = summary;
        this.updateCharts();
      },
      error: () => {
        this.toastService.warning('Resumen no disponible', 'No se pudo cargar el resumen de reportes.');
      }
    });

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

  private initializeCharts(): void {
    const categoryContext = this.categoryCanvas.nativeElement.getContext('2d');
    const statusContext = this.statusCanvas.nativeElement.getContext('2d');

    if (categoryContext) {
      const config: ChartConfiguration = {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Anotaciones', data: [], backgroundColor: '#1459f5' }] },
        options: { responsive: true, plugins: { legend: { display: false } } }
      };
      this.charts.push(new Chart(categoryContext, config));
    }

    if (statusContext) {
      const config: ChartConfiguration = {
        type: 'pie',
        data: { labels: [], datasets: [{ label: 'Estado', data: [], backgroundColor: ['#1459f5', '#ef233c', '#fbbf24', '#10b981'] }] },
        options: { responsive: true }
      };
      this.charts.push(new Chart(statusContext, config));
    }
  }

  private updateCharts(): void {
    if (!this.summary.length) {
      return;
    }

    const categoryChart = this.charts[0];
    const statusChart = this.charts[1];

    const categoryData = this.summary.filter((item) => item.group === 'category');
    const statusData = this.summary.filter((item) => item.group === 'status');

    if (categoryChart) {
      categoryChart.data.labels = categoryData.map((item) => item.label);
      categoryChart.data.datasets = [{ label: 'Anotaciones', data: categoryData.map((item) => item.value), backgroundColor: '#1459f5' }];
      categoryChart.update();
    }

    if (statusChart) {
      statusChart.data.labels = statusData.map((item) => item.label);
      statusChart.data.datasets = [{ label: 'Estado', data: statusData.map((item) => item.value), backgroundColor: ['#1459f5', '#ef233c', '#fbbf24', '#10b981'] }];
      statusChart.update();
    }
  }

  historySearch = '';
}
