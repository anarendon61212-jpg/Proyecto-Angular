import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Evidence } from '../../../core/models/territorial.models';

export interface AnnotationDetailPanelData {
  idAnnotation: number;
  markerType: string;
  markerIcon: string;
  markerColor: string;
  title: string;
  categoryName: string | null;
  subcategoryName: string | null;
  categories: string[];
  description: string;
  status: string | null;
  registrationDate: string | null;
  address: string | null;
  neighborhoodName: string | null;
  communeName: string | null;
  cityName: string | null;
  latitude: number;
  longitude: number;
  createdByName: string | null;
  createdByType: string | null;
  averageRating: number | null;
  votesCount: number;
  interestedEntities: string[];
  evidences: Evidence[];
}

@Component({
  selector: 'app-annotation-detail-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="annotation-detail app-card" *ngIf="visible && selectedAnnotation">
      <header class="annotation-detail__header">
        <div class="annotation-detail__header-main">
          <span class="annotation-badge" [style.border-color]="selectedAnnotation.markerColor">
            {{ selectedAnnotation.categoryName ?? 'Sin categoría' }}
          </span>
          <h3>Detalle de la anotación</h3>
        </div>
        <button type="button" class="annotation-detail__close" (click)="closePanel.emit()" aria-label="Cerrar panel">
          ×
        </button>
      </header>

      <section class="annotation-detail__section">
        <div class="annotation-detail__title-row">
          <span class="annotation-detail__marker-icon" [style.background]="selectedAnnotation.markerColor">
            {{ selectedAnnotation.markerIcon }}
          </span>
          <div>
            <h4 class="annotation-detail__title">{{ selectedAnnotation.subcategoryName ?? selectedAnnotation.title }}</h4>
            <small class="annotation-detail__subtitle">{{ selectedAnnotation.categoryName ?? 'Sin categoría' }}</small>
          </div>
        </div>
        <p class="annotation-location">
          {{ selectedAnnotation.address ?? 'Sin dirección registrada' }}
        </p>
        <p class="annotation-location-secondary">
          {{ selectedAnnotation.neighborhoodName ?? 'Sin barrio' }}
          <span *ngIf="selectedAnnotation.communeName"> · {{ selectedAnnotation.communeName }}</span>
          <span *ngIf="selectedAnnotation.cityName">, {{ selectedAnnotation.cityName }}</span>
        </p>
      </section>

      <section class="annotation-detail__section">
        <h4>Descripción</h4>
        <p>{{ selectedAnnotation.description || 'Sin descripción registrada.' }}</p>
      </section>

      <section class="annotation-detail__section">
        <h4>Información</h4>
        <div class="annotation-info-grid">
          <div><small>Categoría</small><strong>{{ selectedAnnotation.categoryName ?? 'Sin categoría' }}</strong></div>
          <div><small>Subcategoría</small><strong>{{ selectedAnnotation.subcategoryName ?? 'Sin subcategoría' }}</strong></div>
          <div><small>Fecha de registro</small><strong>{{ selectedAnnotation.registrationDate ?? 'Sin fecha' }}</strong></div>
          <div><small>Anotado por</small><strong>{{ selectedAnnotation.createdByName ?? 'Sin dato' }}</strong></div>
        </div>
        <p class="annotation-coords"><strong>Coordenadas:</strong> {{ selectedAnnotation.latitude.toFixed(6) }}, {{ selectedAnnotation.longitude.toFixed(6) }}</p>
        <p class="annotation-coords">
          <strong>Entidades interesadas:</strong>
          {{ selectedAnnotation.interestedEntities.length > 0 ? selectedAnnotation.interestedEntities.join(', ') : 'Sin entidades asociadas' }}
        </p>
      </section>

      <section class="annotation-detail__section">
        <h4>Evidencias ({{ imageEvidences.length }})</h4>
        <div class="annotation-evidence-grid" *ngIf="imageEvidences.length > 0; else noEvidenceState">
          <a
            class="annotation-evidence-item"
            *ngFor="let evidence of imageEvidences.slice(0, 3)"
            [href]="toAbsoluteUrl(evidence.file_url)"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img [src]="toAbsoluteUrl(evidence.file_url)" alt="Evidencia anotación" loading="lazy" />
          </a>
          <div class="annotation-evidence-more" *ngIf="imageEvidences.length > 3">
            +{{ imageEvidences.length - 3 }}<br>ver más
          </div>
        </div>
        <div class="annotation-video-grid" *ngIf="videoEvidences.length > 0">
          <video *ngFor="let evidence of videoEvidences.slice(0, 2)" controls preload="metadata">
            <source [src]="toAbsoluteUrl(evidence.file_url)" [type]="evidence.file_type || 'video/mp4'" />
          </video>
        </div>
        <ng-template #noEvidenceState>
          <p class="annotation-empty">No hay evidencias de imagen registradas.</p>
        </ng-template>
      </section>

      <section class="annotation-detail__section">
        <h4>Calificación promedio</h4>
        <div class="rating-block" *ngIf="selectedAnnotation.averageRating != null; else noRating">
          <strong>{{ selectedAnnotation.averageRating.toFixed(1) }}</strong>
          <span>⭐ {{ selectedAnnotation.votesCount }} voto{{ selectedAnnotation.votesCount === 1 ? '' : 's' }}</span>
        </div>
        <ng-template #noRating>
          <p class="annotation-empty">Sin calificaciones registradas.</p>
        </ng-template>
      </section>
    </aside>
  `,
  styles: [
    `.annotation-detail { display: grid; gap: 0.95rem; padding: 0.95rem; max-height: 690px; overflow-y: auto; background: #fbfcfe; border: 1px solid #e2e8f0; }`,
    `.annotation-detail__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; padding-bottom: 0.65rem; border-bottom: 1px solid #e2e8f0; }`,
    `.annotation-detail__header-main { display: grid; gap: 0.3rem; }`,
    `.annotation-detail__header-main h3 { margin: 0; font-size: 0.96rem; color: #0f172a; }`,
    `.annotation-badge { display: inline-flex; align-items: center; border: 1px solid; border-radius: 999px; padding: 0.2rem 0.55rem; font-size: 0.7rem; font-weight: 700; color: #1e293b; background: #fff; width: fit-content; }`,
    `.annotation-detail__close { border: 1px solid #dbe3ef; border-radius: 999px; width: 28px; height: 28px; background: #fff; color: #475569; cursor: pointer; font-size: 1rem; }`,
    `.annotation-detail__section { display: grid; gap: 0.38rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.7rem; }`,
    `.annotation-detail__section h4 { margin: 0; font-size: 0.78rem; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }`,
    `.annotation-detail__section p { margin: 0; font-size: 0.8rem; color: #334155; line-height: 1.35; }`,
    `.annotation-detail__title-row { display: flex; align-items: center; gap: 0.55rem; }`,
    `.annotation-detail__marker-icon { width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; font-size: 0.9rem; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18); }`,
    `.annotation-detail__title { margin: 0; font-size: 0.9rem; color: #0f172a; }`,
    `.annotation-detail__subtitle { color: #64748b; font-size: 0.75rem; }`,
    `.annotation-location { font-weight: 600; color: #0f172a; }`,
    `.annotation-location-secondary { color: #64748b !important; font-size: 0.76rem !important; }`,
    `.annotation-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem; }`,
    `.annotation-info-grid div { display: grid; gap: 0.12rem; }`,
    `.annotation-info-grid small { font-size: 0.68rem; color: #64748b; }`,
    `.annotation-info-grid strong { font-size: 0.78rem; color: #0f172a; font-weight: 700; }`,
    `.annotation-coords { color: #64748b !important; font-size: 0.75rem !important; }`,
    `.annotation-evidence-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; }`,
    `.annotation-video-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; margin-top: 0.45rem; }`,
    `.annotation-video-grid video { width: 100%; border-radius: 10px; border: 1px solid #dbe3ef; background: #000; min-height: 92px; }`,
    `.annotation-evidence-item { display: block; border-radius: 10px; overflow: hidden; border: 1px solid #dbe3ef; background: #f8fafc; min-height: 72px; }`,
    `.annotation-evidence-item img { width: 100%; height: 100%; object-fit: cover; display: block; }`,
    `.annotation-evidence-more { display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px dashed #cbd5e1; border-radius: 10px; font-size: 0.74rem; color: #475569; background: #f8fafc; min-height: 72px; text-align: center; line-height: 1.15; }`,
    `.rating-block { display: flex; align-items: baseline; gap: 0.5rem; }`,
    `.rating-block strong { font-size: 1.6rem; line-height: 1; color: #0f172a; }`,
    `.rating-block span { font-size: 0.78rem; color: #64748b; }`,
    `.annotation-empty { color: #64748b !important; font-style: italic; }`,
    `@media (max-width: 680px) { .annotation-info-grid { grid-template-columns: 1fr; } }`,
    `@media (max-width: 1240px) { .annotation-detail { max-height: none; } }`
  ]
})
export class AnnotationDetailPanelComponent {
  @Input() selectedAnnotation: AnnotationDetailPanelData | null = null;
  @Input() visible = false;
  @Output() closePanel = new EventEmitter<void>();
  @Input() imageUrlResolver: ((path: string) => string) | null = null;

  get imageEvidences(): Evidence[] {
    if (!this.selectedAnnotation) return [];
    // Para no depender del nombre/extensión, todo lo que no sea video se muestra como imagen.
    return this.selectedAnnotation.evidences.filter((evidence) => !this.isVideoEvidence(evidence));
  }

  get videoEvidences(): Evidence[] {
    if (!this.selectedAnnotation) return [];
    return this.selectedAnnotation.evidences.filter((evidence) => this.isVideoEvidence(evidence));
  }

  private isVideoEvidence(evidence: Evidence): boolean {
    const type = String(evidence.file_type ?? '').toLowerCase();
    const url = String(evidence.file_url ?? '').toLowerCase();
    return (
      type.startsWith('video/') ||
      type.includes('mp4') ||
      type.includes('webm') ||
      type.includes('ogg') ||
      type.includes('mov') ||
      type.includes('m4v') ||
      /\.(mp4|webm|ogg|mov|m4v)$/i.test(url)
    );
  }

  toAbsoluteUrl(path: string): string {
    if (this.imageUrlResolver) {
      return this.imageUrlResolver(path);
    }
    return path;
  }
}
