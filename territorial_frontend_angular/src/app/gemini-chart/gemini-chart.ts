import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';

import { GeminiChartService, GeminiChartData } from './gemini-chart.service';

export type ChartOptions = {
  series: any;
  chart: any;
  labels: any;
  responsive: any;
};

@Component({
  selector: 'app-gemini-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './gemini-chart.html',
  styleUrls: ['./gemini-chart.scss']
})
export class GeminiChartComponent implements OnInit {
  @ViewChild('chart') chart?: ChartComponent;
  public chartOptions: Partial<ChartOptions> | any;
  public loading = true;
  public queryText = '';
  public chartType: 'pie' | 'bar' | 'line' = 'pie';
  public errorMessage: string | null = null;

  constructor(private geminiChartService: GeminiChartService) {
    this.chartOptions = {
      series: [44, 55, 13, 43, 22],
      chart: {
        width: 380,
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

  ngOnInit(): void {
    this.loadSampleData();
  }

  private loadSampleData(): void {
    this.geminiChartService.getSampleChartData().subscribe({
      next: (data) => this.applyChartData(data),
      error: (err) => {
        console.error('Error al cargar datos de ejemplo', err);
        this.loading = false;
      }
    });
  }

  public submitQuery(): void {
    if (!this.queryText.trim()) {
      this.errorMessage = 'Escribe una consulta antes de enviar.';
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.geminiChartService.getChartData(this.queryText.trim()).subscribe({
      next: (data) => this.applyChartData(data),
      error: (err) => {
        const message = this.extractErrorMessage(err);
        console.error('Error al generar reporte', err);
        this.errorMessage = message;
        this.loading = false;
      }
    });
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

  private applyChartData(data: GeminiChartData): void {
    this.chartType = data.type;
    this.chartOptions = {
      ...this.chartOptions,
      chart: {
        ...this.chartOptions.chart,
        type: data.type
      },
      series: data.type === 'pie' ? (data.series as number[]) : data.series,
      labels: data.type === 'pie' ? data.labels : undefined,
      xaxis: data.type !== 'pie' ? { categories: data.labels } : this.chartOptions.xaxis
    };
    this.loading = false;
  }
}
