import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, inject, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { combineLatest, forkJoin, Observable, of, Subject, Subscription, take, takeUntil } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  Annotation,
  AnnotationCategory,
  AnnotationCategoryPayload,
  AnnotationPayload,
  Category,
  Citizen,
  Evidence,
  Entity,
  Neighborhood,
  Official,
  OfficialTracking,
  Point,
  PointPayload,
  TrackingPayload,
  Vote
} from '../../core/models/territorial.models';
import {
  AnnotationCategoryCrudService,
  AnnotationCrudService,
  CategoryCrudService,
  CitizenCrudService,
  EntityCrudService,
  EvidenceCrudService,
  InterestedPartyCrudService,
  NeighborhoodCrudService,
  OfficialCrudService,
  PointCrudService,
  VoteCrudService
} from '../../core/api/territorial-crud.services';
import { ApiClient } from '../../core/api/api-client.service';
import { ToastService } from '../../shared/services/toast.service';
import { TrackingService } from '../../core/services/tracking.service';
import { AnnotationDetailPanelComponent, AnnotationDetailPanelData } from './components/annotation-detail-panel.component';

interface NeighborhoodShape {
  id: number;
  name: string;
  coordinates: L.LatLngTuple[];
}

interface CategoryTreeNode {
  category: Category;
  children: CategoryTreeNode[];
}

interface AnnotationPopupData {
  annotation: Annotation | null;
  evidences: Evidence[];
  categories: Category[];
  averageVotes: number | null;
  votesCount: number;
}

interface SelectedAnnotationLocation {
  lat: number;
  lng: number;
  neighborhoodId: number;
}

interface OfficialTrackingSnapshot {
  id_official: number;
  id_entity?: number | null;
  latitude: number;
  longitude: number;
  last_gps_update?: string | null;
  lastUpdate?: string | null;
  gps_active?: boolean;
}

interface EntityGeocodeCacheEntry {
  lat: number;
  lng: number;
  address: string;
}

type OfficialConnectionState = 'ONLINE' | 'OFFLINE' | 'LAST_KNOWN_POSITION';
type TrackingSource = 'rest' | 'socket';
type MapMode = 'officials' | 'annotations';
type TrackingDebugSource =
  | 'socket-update'
  | 'polling-refresh'
  | 'refresh-realtime-panel'
  | 'rebuild-visible-markers'
  | 'offline-detector'
  | 'merge-tracking-snapshot:rest'
  | 'merge-tracking-snapshot:socket';

interface TrackingDebugEvent {
  ts: string;
  source: TrackingDebugSource;
  officialId: number | null;
  previousState: OfficialConnectionState | 'UNKNOWN';
  nextState: OfficialConnectionState | 'UNKNOWN';
  gps_active: boolean | null;
  lastUpdate: string | null;
  markerType: 'dot-green' | 'dot-blue' | 'dot-gray' | 'missing-marker' | 'unknown';
  panelLabel: string | null;
}

interface AnnotationMarkerConfig {
  icon: string;
  color: string;
  markerType: string;
}

interface AnnotationMarkerRule {
  label: string;
  icon: string;
  color: string;
  markerType: string;
  keywords: string[];
}

const ANNOTATION_MARKER_RULES: AnnotationMarkerRule[] = [
  { label: 'Infraestructura', icon: 'cone', color: '#f59e0b', markerType: 'infrastructure', keywords: ['infraestructura', 'road', 'via', 'calle', 'carretera', 'ande'] },
  { label: 'Movilidad', icon: 'bus', color: '#f59e0b', markerType: 'mobility', keywords: ['movilidad', 'trafico', 'tránsito', 'bus', 'transporte'] },
  { label: 'Seguridad', icon: 'shield', color: '#f59e0b', markerType: 'security', keywords: ['seguridad', 'alarma', 'alerta', 'delito', 'policia'] },
  { label: 'Salud', icon: 'cross', color: '#f59e0b', markerType: 'health', keywords: ['salud', 'hospital', 'medic', 'medicina'] },
  { label: 'Educación', icon: 'book', color: '#f59e0b', markerType: 'education', keywords: ['educacion', 'educación', 'colegio', 'escuela', 'universidad'] },
  { label: 'Espacio público', icon: 'tree', color: '#f59e0b', markerType: 'public-space', keywords: ['espacio publico', 'espacio público', 'parque'] },
  { label: 'Medio ambiente', icon: 'leaf', color: '#f59e0b', markerType: 'environment', keywords: ['medio ambiente', 'ambiental', 'residuo', 'basura', 'hoja'] },
  { label: 'Comercio', icon: 'store', color: '#f59e0b', markerType: 'commerce', keywords: ['comercio', 'tienda', 'negocio', 'venta'] },
  { label: 'Riesgo', icon: 'alert', color: '#f59e0b', markerType: 'risk', keywords: ['riesgo', 'desliz', 'incendio', 'emergencia'] },
  { label: 'Ruido', icon: 'sound', color: '#f59e0b', markerType: 'noise', keywords: ['ruido', 'sonido', 'contaminacion auditiva', 'contaminación auditiva'] },
  { label: 'Alumbrado', icon: 'light', color: '#f59e0b', markerType: 'lighting', keywords: ['alumbrado', 'luz', 'poste', 'iluminacion', 'iluminación'] }
];

const ANNOTATION_MARKER_FALLBACK: AnnotationMarkerConfig = {
  icon: 'pin',
  color: '#f59e0b',
  markerType: 'other'
};

const NEIGHBORHOOD_SHAPES: NeighborhoodShape[] = [
  {
    id: 1,
    name: 'Barrio Central',
    coordinates: [
      [5.070, -75.515],
      [5.073, -75.515],
      [5.073, -75.510],
      [5.070, -75.508]
    ]
  },
  {
    id: 2,
    name: 'Barrio Las Palmas',
    coordinates: [
      [5.065, -75.520],
      [5.068, -75.520],
      [5.068, -75.514],
      [5.065, -75.512]
    ]
  },
  {
    id: 3,
    name: 'Barrio Mirador',
    coordinates: [
      [5.076, -75.522],
      [5.079, -75.522],
      [5.079, -75.516],
      [5.076, -75.514]
    ]
  }
];

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AnnotationDetailPanelComponent],
  template: `
    <section class="rt-shell app-card">
      <header class="rt-header">
        <div>
          <h2>
            Mapa territorial
            <span class="rt-live-pill" *ngIf="currentMapMode === 'officials'">En vivo</span>
          </h2>
          <p *ngIf="currentMapMode === 'officials'">Visualiza la ubicación actual de los funcionarios activos.</p>
          <p *ngIf="currentMapMode === 'annotations'">Gestiona territorio, capas y anotaciones sin salir del mapa.</p>
        </div>
      </header>

      <nav class="map-mode-switcher" aria-label="Modo del mapa">
        <button
          type="button"
          class="mode-tab"
          [class.mode-tab--active]="currentMapMode === 'officials'"
          (click)="setMapMode('officials')"
        >
          Funcionarios
        </button>
        <button
          type="button"
          class="mode-tab"
          [class.mode-tab--active]="currentMapMode === 'annotations'"
          (click)="setMapMode('annotations')"
        >
          Anotaciones
        </button>
      </nav>

      <div class="rt-toolbar" *ngIf="currentMapMode === 'officials'">
        <div class="rt-filter">
          <label for="entity-filter-select">Filtrar por entidad</label>
          <select id="entity-filter-select" [value]="selectedEntityFilter ?? ''" (change)="onEntityFilterSelected($event)">
            <option value="">Todas las entidades</option>
            <option *ngFor="let entity of trackingEntities" [value]="entity.id_entity">
              {{ entity.name }}
            </option>
          </select>
        </div>

        <div class="rt-stats">
          <div class="rt-stat-card">
            <small>Funcionarios activos</small>
            <strong>{{ getRealtimeActiveCount() }}</strong>
          </div>
          <div class="rt-stat-card">
            <small>Sin conexión</small>
            <strong>{{ getRealtimeOfflineCount() }}</strong>
          </div>
          <div class="rt-stat-card">
            <small>Total</small>
            <strong>{{ getRealtimeTotalCount() }}</strong>
          </div>
        </div>

        <div class="rt-actions">
          <span>Última actualización: {{ getLatestRealtimeUpdateLabel() }}</span>
          <button type="button" class="app-button app-button--secondary" (click)="refreshRealtimePanel()">
            Actualizar
          </button>
        </div>
      </div>

      <div
        class="rt-main"
        [class.rt-main--annotations]="currentMapMode === 'annotations'"
        [class.rt-main--annotations-with-detail]="currentMapMode === 'annotations' && selectedAnnotationDetail"
      >
        <aside class="map-sidebar map-sidebar--annotations app-card" *ngIf="currentMapMode === 'annotations'">
          <h3 class="map-sidebar__title">Herramientas avanzadas del mapa</h3>

          <div class="panel-section">
            <h3>Territorio</h3>
            <p>Seleccione barrio, capas y filtros para ver datos en el mapa.</p>
          </div>

          <div class="panel-section">
            <label for="neighborhood-select">Barrio</label>
            <select id="neighborhood-select" [value]="selectedNeighborhoodId ?? ''" (change)="onNeighborhoodSelected($event)">
              <option value="">Todos los barrios</option>
              <option *ngFor="let neighborhood of neighborhoods" [value]="neighborhood.id_neighborhood">
                {{ neighborhood.name }}
              </option>
            </select>
          </div>

          <div class="panel-section">
            <h3>Capas</h3>
            <label><input type="checkbox" [checked]="showNeighborhoods" (change)="toggleNeighborhoodLayer($event.target.checked)" /> Mostrar polígonos</label>
            <label><input type="checkbox" [checked]="showPoints" (change)="togglePointsLayer($event.target.checked)" /> Mostrar puntos</label>
          </div>

          <div class="panel-section">
            <h3>Tipo de punto</h3>
            <label><input type="checkbox" [checked]="pointFilters.annotation" (change)="togglePointType('annotation', $event.target.checked)" /> Anotaciones</label>
            <label><input type="checkbox" [checked]="pointFilters.polygon" (change)="togglePointType('polygon', $event.target.checked)" /> Polígonos</label>
            <label><input type="checkbox" [checked]="pointFilters.boundary" (change)="togglePointType('boundary', $event.target.checked)" /> Linderos</label>
          </div>

          <div class="panel-section">
            <h3>Categorías</h3>
            <div class="category-filters-header">
              <button
                type="button"
                class="app-button app-button--secondary app-button--small"
                [disabled]="selectedFilterCategoryIds.size === 0"
                (click)="clearCategoryFilters()"
              >
                Limpiar filtros
              </button>
            </div>
            <p class="category-filter-hint" *ngIf="selectedFilterCategoryIds.size > 0">
              Selección múltiple activa (OR): se muestran anotaciones de cualquiera de las categorías seleccionadas o sus descendientes.
            </p>
            <div class="category-tree" *ngIf="categoryFilterTree.length > 0; else noCategoriesTemplate">
              <ng-container *ngFor="let root of categoryFilterTree">
                <ng-container *ngTemplateOutlet="categoryNodeTemplate; context: { $implicit: root, level: 0 }"></ng-container>
              </ng-container>
            </div>
            <ng-template #noCategoriesTemplate>
              <p class="map-info-message">No hay categorías disponibles para filtrar.</p>
            </ng-template>
          </div>

          <div class="panel-section">
            <h3>Anotaciones</h3>
            <p *ngIf="!isAnnotationMode && !selectedAnnotationLocation">
              Active el modo para crear una anotación desde el mapa.
            </p>
            <p *ngIf="isAnnotationMode" class="annotation-mode-hint">
              Seleccione un barrio demarcado en el mapa para crear una anotación.
            </p>
            <button
              type="button"
              class="app-button"
              [class.app-button--primary]="!isAnnotationMode"
              [class.app-button--danger]="isAnnotationMode"
              (click)="toggleAnnotationMode()"
            >
              {{ isAnnotationMode ? 'Cancelar modo anotación' : 'Crear anotación' }}
            </button>
          </div>

          <div class="panel-section">
            <h3>Demarcación de barrio</h3>
            <p *ngIf="!isEditingPolygon">Seleccione un barrio y haga clic para demarcar sus límites.</p>
            <p *ngIf="isEditingPolygon" style="color: var(--color-danger);">Haga clic en el mapa para agregar puntos. Clic derecho en un punto para eliminarlo. Mínimo 3 puntos.</p>
            <button type="button" class="app-button app-button--primary" *ngIf="!isEditingPolygon" (click)="startPolygonEditing()">Demarcar barrio</button>
            <button type="button" class="app-button app-button--secondary" *ngIf="!isEditingPolygon" (click)="startExistingPolygonEditing()">Editar polígono</button>
            <button type="button" class="app-button app-button--secondary" *ngIf="isEditingPolygon" (click)="savePolygon()">Guardar polígono</button>
            <button type="button" class="app-button app-button--danger" *ngIf="isEditingPolygon" (click)="cancelPolygonEditing()">Cancelar</button>
          </div>

          <div class="panel-section">
            <h3>Mapa base</h3>
            <div class="base-layer-switch">
              <button
                type="button"
                class="app-button app-button--secondary app-button--small"
                [class.map-base-active]="currentBaseLayer === 'streets'"
                (click)="setBaseLayer('streets')"
              >
                Calles
              </button>
              <button
                type="button"
                class="app-button app-button--secondary app-button--small"
                [class.map-base-active]="currentBaseLayer === 'topographic'"
                (click)="setBaseLayer('topographic')"
              >
                Topográfico
              </button>
            </div>
          </div>
        </aside>

        <section class="map-view">
          <div class="map-view__header">
            <div class="map-view__title">
              Mapa | {{ currentMapMode === 'officials' ? 'Funcionarios' : 'Anotaciones' }}
            </div>
            <div class="map-legend" aria-label="Convenciones del mapa">
              <div class="legend-item legend-item--entity">
                <span class="legend-dot legend-dot--entity"></span>
                <span>Entidad</span>
              </div>
              <div class="legend-item legend-item--annotation">
                <span class="legend-dot legend-dot--annotation"></span>
                <span>Anotación</span>
              </div>
            </div>
          </div>

          <div class="map-floating-legend" *ngIf="currentMapMode === 'officials'">
            <h4>Convenciones</h4>
            <p><span class="dot dot--active"></span> En línea</p>
            <p><span class="dot dot--offline"></span> Sin conexión</p>
            <p><span class="dot dot--known"></span> Última posición conocida</p>
          </div>

          <p class="map-info-message" *ngIf="currentMapMode === 'officials' && showNoOfficialsForSelectedEntity">
            No hay funcionarios activos en la entidad filtrada.
          </p>
          <div #mapContainer class="leaflet-container" [class.annotation-cursor]="isAnnotationMode"></div>
        </section>

        <app-annotation-detail-panel
          *ngIf="currentMapMode === 'annotations'"
          [visible]="selectedAnnotationDetail != null"
          [selectedAnnotation]="selectedAnnotationDetail"
          [imageUrlResolver]="resolveEvidenceImageUrl"
          (closePanel)="closeAnnotationDetailPanel()"
        />

        <aside class="rt-side app-card" *ngIf="currentMapMode === 'officials'">
          <div class="rt-side__header">
            <h3>Funcionarios ({{ getRealtimeTotalCount() }})</h3>
            <input
              type="search"
              [(ngModel)]="officialRealtimeSearch"
              placeholder="Buscar funcionario..."
              aria-label="Buscar funcionario"
            />
          </div>

          <div class="rt-list">
            <article class="rt-item" *ngFor="let item of getRealtimePanelItems(); trackBy: trackRealtimeOfficial">
              <div class="rt-avatar">{{ getOfficialInitials(item.id_official) }}</div>
              <div class="rt-item__info">
                <strong>{{ getOfficialDisplayName(item.id_official) }}</strong>
                <small
                  [class.offline]="isOfficialPanelOffline(item)"
                  [class.known]="isOfficialPanelLastKnown(item)"
                >
                  {{ getOfficialPanelConnectionLabel(item) }}
                </small>
              </div>
              <div class="rt-item__meta">
                <small>{{ formatRealtimeTime(item.lastUpdate ?? item.last_gps_update) }}</small>
                <small>{{ formatRealtimeLocation(item.latitude, item.longitude) }}</small>
              </div>
            </article>
          </div>
        </aside>
      </div>
    </section>

    <ng-template #categoryNodeTemplate let-node let-level="level">
      <div class="category-tree-node" [style.padding-left.px]="level * 14">
        <button
          type="button"
          class="category-toggle"
          *ngIf="node.children.length > 0"
          (click)="toggleCategoryNode(node.category.id_category)"
        >
          {{ isCategoryNodeExpanded(node.category.id_category) ? '▾' : '▸' }}
        </button>
        <span class="category-toggle category-toggle--placeholder" *ngIf="node.children.length === 0"></span>
        <label>
          <input
            type="checkbox"
            [checked]="isCategorySelected(node.category.id_category)"
            (change)="toggleCategoryFilter(node.category.id_category, $any($event.target).checked)"
          />
          <span>{{ node.category.name }}</span>
          <span class="category-count">{{ getCategoryTotalCount(node.category.id_category) }}</span>
        </label>
      </div>

      <div *ngIf="node.children.length > 0 && isCategoryNodeExpanded(node.category.id_category)">
        <ng-container *ngFor="let child of node.children">
          <ng-container *ngTemplateOutlet="categoryNodeTemplate; context: { $implicit: child, level: level + 1 }"></ng-container>
        </ng-container>
      </div>
    </ng-template>

  `,
  styles: [
    `.rt-shell { display: grid; gap: 1rem; padding: 1rem; }`,
    `.rt-header h2 { margin: 0; font-size: 1.45rem; display: inline-flex; align-items: center; gap: 0.6rem; }`,
    `.rt-header p { margin: 0.25rem 0 0; color: var(--color-muted); font-size: 0.88rem; }`,
    `.rt-live-pill { background: #dcfce7; color: #15803d; border-radius: 999px; font-size: 0.72rem; font-weight: 800; padding: 0.25rem 0.55rem; }`,
    `.map-mode-switcher { display: inline-flex; align-items: center; gap: 0.45rem; background: #f8fafc; border: 1px solid var(--color-border); border-radius: 999px; padding: 0.35rem; width: fit-content; }`,
    `.mode-tab { border: none; background: transparent; color: #475569; font-weight: 700; font-size: 0.82rem; border-radius: 999px; padding: 0.45rem 0.9rem; cursor: pointer; }`,
    `.mode-tab--active { background: #2563eb; color: #fff; box-shadow: 0 8px 18px rgba(37, 99, 235, 0.25); }`,
    `.rt-toolbar { display: grid; grid-template-columns: minmax(220px, 280px) 1fr auto; gap: 0.75rem; align-items: stretch; }`,
    `.rt-filter { border: 1px solid var(--color-border); border-radius: 12px; padding: 0.7rem; background: #fff; display: grid; gap: 0.35rem; }`,
    `.rt-filter label { font-size: 0.75rem; color: var(--color-muted); font-weight: 700; }`,
    `.rt-stats { display: grid; grid-template-columns: repeat(3, minmax(120px, 1fr)); gap: 0.65rem; }`,
    `.rt-stat-card { border: 1px solid var(--color-border); border-radius: 12px; background: #fff; padding: 0.65rem 0.75rem; display: grid; gap: 0.2rem; }`,
    `.rt-stat-card small { color: var(--color-muted); font-size: 0.74rem; }`,
    `.rt-stat-card strong { font-size: 1.2rem; line-height: 1; }`,
    `.rt-actions { border: 1px solid var(--color-border); border-radius: 12px; background: #fff; padding: 0.65rem 0.75rem; display: flex; align-items: center; gap: 0.6rem; color: var(--color-muted); font-size: 0.78rem; }`,
    `.rt-main { display: grid; grid-template-columns: 1fr 330px; gap: 0.8rem; min-height: 690px; }`,
    `.rt-main--annotations { grid-template-columns: 320px 1fr; }`,
    `.rt-main--annotations-with-detail { grid-template-columns: 320px minmax(0, 1fr) 360px; }`,
    `.map-sidebar { display: grid; gap: 1rem; padding: 1.25rem; }`,
    `.map-sidebar--annotations { max-height: 690px; overflow-y: auto; align-content: start; }`,
    `.map-sidebar__title { margin: 0; padding-bottom: 0.75rem; border-bottom: 1px solid var(--color-border); font-size: 1rem; }`,
    `.panel-section { display: grid; gap: 0.75rem; }`,
    `.panel-section h3 { margin: 0; font-size: 0.95rem; }`,
    `.panel-section label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; color: var(--color-ink); }`,
    `.panel-section p { margin: 0; color: #64748b; font-size: 0.84rem; line-height: 1.35; }`,
    `.base-layer-switch { display: flex; flex-wrap: wrap; gap: 0.45rem; }`,
    `.map-base-active { background: #2563eb !important; color: #fff !important; border-color: #2563eb !important; }`,
    `.category-filters-header { display: flex; justify-content: flex-end; }`,
    `.category-filter-hint { margin: 0; color: var(--color-ink-muted, #6b7280); font-size: 0.82rem; line-height: 1.35; }`,
    `.category-tree { border: 1px solid var(--color-border); border-radius: 0.875rem; padding: 0.6rem; background: #fff; max-height: 260px; overflow-y: auto; display: grid; gap: 0.25rem; }`,
    `.category-tree-node { display: flex; align-items: center; gap: 0.4rem; }`,
    `.category-tree-node label { flex: 1; gap: 0.5rem; font-size: 0.87rem; justify-content: space-between; }`,
    `.category-toggle { border: none; background: transparent; cursor: pointer; color: var(--color-ink-muted, #6b7280); width: 1.1rem; padding: 0; line-height: 1; }`,
    `.category-toggle--placeholder { display: inline-block; }`,
    `.category-count { font-size: 0.78rem; color: var(--color-ink-muted, #6b7280); margin-left: auto; }`,
    `.map-info-message { margin: 0; color: var(--color-ink-muted, #6b7280); font-size: 0.9rem; }`,
    `select { width: 100%; border: 1px solid var(--color-border); border-radius: 12px; background: white; color: var(--color-ink); font: inherit; padding: 0.8rem 0.85rem; }`,
    `.map-view { border: 1px solid var(--color-border); border-radius: var(--radius-lg); background: #fff; overflow: hidden; position: relative; display: grid; grid-template-rows: auto 1fr; }`,
    `.map-view__header { border-bottom: 1px solid #e2e8f0; background: #f8fafc; padding: 0.55rem 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap; }`,
    `.map-view__title { font-size: 0.84rem; font-weight: 800; color: #334155; }`,
    `.map-legend { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }`,
    `.legend-item { display: inline-flex; align-items: center; gap: 0.4rem; border: 1px solid #dbe3ef; background: #fff; border-radius: 999px; padding: 0.25rem 0.6rem; font-size: 0.77rem; color: #334155; }`,
    `.legend-dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }`,
    `.legend-dot--entity { background: #22c55e; }`,
    `.legend-dot--annotation { background: #f59e0b; }`,
    `.map-floating-legend { position: absolute; right: 12px; top: 12px; z-index: 700; border: 1px solid var(--color-border); background: rgba(255,255,255,0.97); border-radius: 12px; padding: 0.6rem 0.7rem; box-shadow: 0 8px 18px rgba(15,35,95,0.08); max-width: 220px; }`,
    `.map-floating-legend h4 { margin: 0 0 0.35rem; font-size: 0.8rem; }`,
    `.map-floating-legend p { margin: 0.2rem 0; color: #334155; font-size: 0.76rem; display: flex; align-items: center; gap: 0.35rem; }`,
    `.dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }`,
    `.dot--active { background: #22c55e; }`,
    `.dot--offline { background: #94a3b8; }`,
    `.dot--known { background: #2563eb; }`,
    `.leaflet-container { min-height: 690px; width: 100%; border-radius: 0; box-shadow: none; }`,
    `.rt-side { display: grid; grid-template-rows: auto 1fr; padding: 0; overflow: hidden; }`,
    `.rt-side__header { padding: 0.85rem; border-bottom: 1px solid var(--color-border); display: grid; gap: 0.45rem; }`,
    `.rt-side__header h3 { margin: 0; font-size: 0.95rem; }`,
    `.rt-side__header input { border: 1px solid var(--color-border); border-radius: 10px; padding: 0.65rem 0.75rem; }`,
    `.rt-list { overflow: auto; max-height: 620px; }`,
    `.rt-item { display: grid; grid-template-columns: 38px 1fr auto; gap: 0.55rem; align-items: center; padding: 0.7rem 0.8rem; border-bottom: 1px solid #eef2f7; }`,
    `.rt-avatar { width: 38px; height: 38px; border-radius: 999px; background: linear-gradient(145deg, #e0ecff, #c7dcff); color: #1e40af; display: inline-flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 800; }`,
    `.rt-item__info { display: grid; }`,
    `.rt-item__info strong { font-size: 0.84rem; }`,
    `.rt-item__info small { font-size: 0.73rem; color: #16a34a; }`,
    `.rt-item__info small.offline { color: #64748b; }`,
    `.rt-item__info small.known { color: #2563eb; }`,
    `.rt-item__meta { display: grid; text-align: right; }`,
    `.rt-item__meta small { font-size: 0.72rem; color: #64748b; }`,
    `.map-point-marker { width: 16px; height: 16px; border: 2px solid #ffffff; border-radius: 50%; background: var(--color-danger); box-shadow: 0 0 0 5px rgba(239, 35, 60, 0.16); }`,
    `.map-annotation-marker { width: 20px; height: 20px; border: 2px solid #fff; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 0 5px rgba(245, 158, 11, 0.25); }`,
    `.official-marker {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 4px solid #ffffff;
      background: #00ff2a;
      box-shadow:
        0 0 0 10px rgba(0,255,42,.35),
        0 0 30px rgba(0,255,42,.8);
      animation: pulseOfficial 1.2s infinite;
    }`,
    `@keyframes pulseOfficial {

      0% {
        transform: scale(1);
      }

      50% {
        transform: scale(1.25);
      }

      100% {
        transform: scale(1);
      }
    }`,
    `.official-marker--offline {
      opacity: .45;
      filter: grayscale(1);
    }`,
    `.annotation-cursor, .annotation-cursor .leaflet-interactive { cursor: crosshair !important; }`,
    `.annotation-mode-hint { color: var(--color-primary); font-weight: 500; }`,
    `@media (max-width: 1240px) { .rt-toolbar { grid-template-columns: 1fr; } .rt-main { grid-template-columns: 1fr; } .rt-main--annotations { grid-template-columns: 1fr; } .rt-main--annotations-with-detail { grid-template-columns: 1fr; } .rt-stats { grid-template-columns: repeat(3, 1fr); } .map-floating-legend { left: 12px; right: auto; bottom: 12px; top: auto; } }`,
    `@media (max-width: 980px) { .map-sidebar--annotations { max-height: none; } }`,

    `.ann-form { display: grid; gap: 1rem; padding: 1.25rem 1.5rem 1.5rem; }`,
    `.ann-form--sidebar { padding: 0; margin-top: 0.25rem; }`,
    `.ann-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }`,
    `.ann-full-width { display: grid; gap: 0.5rem; }`,
    `.ann-extras-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }`,
    `.ann-field-group { border: 1px solid var(--color-border); border-radius: 0.875rem; padding: 0.875rem; display: grid; gap: 0.5rem; }`,
    `.ann-field-group h4 { margin: 0; font-size: 0.9rem; color: var(--color-ink); }`,
    `.ann-checkbox-grid { display: grid; gap: 0.5rem; max-height: 160px; overflow-y: auto; }`,
    `.ann-checkbox-grid label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer; }`,
    `.ann-actions { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; }`,
    `.ann-form label { display: grid; gap: 0.4rem; font-size: 0.9rem; font-weight: 500; }`,
    `.ann-form input, .ann-form select, .ann-form textarea { border: 1px solid var(--color-border); border-radius: 0.75rem; padding: 0.75rem; font: inherit; background: white; color: var(--color-ink); }`,
    `.app-button--small { font-size: 0.8rem; padding: 0.45rem 0.7rem; }`,
    `.ann-form textarea { resize: vertical; }`,
    `.readonly-input { background: var(--color-surface, #f9fafb) !important; color: var(--color-ink-muted, #6b7280) !important; cursor: default; }`,
    `@media (max-width: 640px) { .ann-form-grid { grid-template-columns: 1fr; } .ann-extras-grid { grid-template-columns: 1fr; } }`
  ],
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer!: ElementRef<HTMLDivElement>;

  // ── Map services ──────────────────────────────────────────────────────────
  private readonly neighborhoodService = inject(NeighborhoodCrudService);
  private readonly pointService = inject(PointCrudService);

  // ── CU-12 services ────────────────────────────────────────────────────────
  private readonly annotationService = inject(AnnotationCrudService);
  private readonly categoryService = inject(CategoryCrudService);
  private readonly citizenService = inject(CitizenCrudService);
  private readonly entityService = inject(EntityCrudService);
  private readonly evidenceService = inject(EvidenceCrudService);
  private readonly interestedPartyService = inject(InterestedPartyCrudService);
  private readonly annotationCategoryService = inject(AnnotationCategoryCrudService);
  private readonly voteService = inject(VoteCrudService);
  private readonly officialService = inject(OfficialCrudService);
  private readonly apiClient = inject(ApiClient);
  private readonly trackingService = inject(TrackingService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  private readonly destroy$ = new Subject<void>();

  // ── Map state ─────────────────────────────────────────────────────────────
  neighborhoods: Neighborhood[] = [];
  points: Point[] = [];
  showNeighborhoods = true;
  showPoints = true;
  pointFilters = {
    annotation: true,
    polygon: true,
    boundary: true
  };
  isEditingPolygon = false;
  isEditingExistingPolygon = false;
  private map!: L.Map;
  private baseLayers!: Record<string, L.TileLayer>;
  private neighborhoodLayer = L.layerGroup();
  private pointLayer = L.layerGroup();
  private annotationLayer = L.layerGroup();
  private entityLayer = L.layerGroup();
  private selectedNeighborhoodLayer = L.layerGroup();
  private editingLayer = L.layerGroup();
  private trackingLayer = L.layerGroup();
  private officialsById = new Map<number, Official>();
  private officialMarkers = new Map<number, L.Marker>();
  private officialConnectionStateById = new Map<number, OfficialConnectionState>();
  private latestTrackingByOfficial = new Map<number, OfficialTrackingSnapshot>();
  private readonly entityGeocodeStorageKey = 'territorial.map.entityGeocodes.v1';
  private readonly realtimeOfficialsToggleStorageKey = 'territorial.map.showRealtimeOfficials';
  private readonly entityGeocodeCache = new Map<number, EntityGeocodeCacheEntry>();
  private readonly failedEntityGeocodeAddress = new Map<number, string>();
  private readonly pendingEntityGeocoding = new Set<number>();
  private readonly renderedEntityCoordsById = new Map<number, L.LatLngTuple>();
  private mapEntities: Entity[] = [];
  private polygonPoints: L.LatLng[] = [];
  private polygonMarkers: L.Marker[] = [];
  private polygonLine: L.Polyline | null = null;
  private officialsPollingSubscription: Subscription | null = null;
  private officialOfflineIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly trackingDebugBuffer: TrackingDebugEvent[] = [];
  private readonly trackingDebugBufferMaxSize = 50;
  selectedNeighborhoodId: number | null = null;
  private existingPolygonPoints: Point[] = [];

  // ── CU-12 state ───────────────────────────────────────────────────────────
  isAnnotationMode = false;
  isSavingAnnotation = false;
  selectedAnnotationLocation: SelectedAnnotationLocation | null = null;

  annotationCategories: Category[] = [];
  annotationEntities: Entity[] = [];
  annotationCitizens: Citizen[] = [];
  annotationPhotoFiles: File[] = [];
  trackingEntities: Entity[] = [];
  currentMapMode: MapMode = 'officials';
  currentBaseLayer: 'streets' | 'topographic' = 'streets';
  selectedAnnotationDetail: AnnotationDetailPanelData | null = null;
  selectedEntityFilter: number | null = null;
  showRealtimeOfficials = true;
  showNoOfficialsForSelectedEntity = false;
  officialRealtimeSearch = '';
  categoryFilterTree: CategoryTreeNode[] = [];
  selectedFilterCategoryIds = new Set<number>();
  expandedFilterCategoryIds = new Set<number>();
  categoryDirectCount = new Map<number, number>();
  categoryTotalCount = new Map<number, number>();
  visibleAnnotationCount = 0;
  hasAnnotationPoints = false;

  private readonly defaultAnnotationMarkerStyle = {
    background: '#f59e0b',
    shadow: 'rgba(245, 158, 11, 0.25)'
  };
  private readonly rootPalette = [
    { background: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.25)' },
    { background: '#2563eb', shadow: 'rgba(37, 99, 235, 0.25)' },
    { background: '#16a34a', shadow: 'rgba(22, 163, 74, 0.25)' },
    { background: '#dc2626', shadow: 'rgba(220, 38, 38, 0.25)' },
    { background: '#7c3aed', shadow: 'rgba(124, 58, 237, 0.25)' },
    { background: '#0891b2', shadow: 'rgba(8, 145, 178, 0.25)' },
    { background: '#ea580c', shadow: 'rgba(234, 88, 12, 0.25)' }
  ];
  private allCategories: Category[] = [];
  private allAnnotationCategories: AnnotationCategory[] = [];
  private categoriesById = new Map<number, Category>();
  private categoryChildrenMap = new Map<number | null, Category[]>();
  private categoryDescendantsMap = new Map<number, Set<number>>();
  private categoryColorMap = new Map<number, { background: string; shadow: string }>();
  private annotationCategoryMap = new Map<number, Set<number>>();
  private annotationDescriptionMap = new Map<number, string>();

  annotationForm = new FormGroup({
    id_citizen: new FormControl<number | null>(null),
    description: new FormControl('', { nonNullable: true }),
    categoryIds: new FormControl<number[]>([], { nonNullable: true }),
    interestedEntityIds: new FormControl<number[]>([], { nonNullable: true })
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.restoreRealtimeOfficialsToggle();
    this.restoreEntityGeocodeCache();
    this.initializeMap();
    this.loadTerritorialData();
    this.loadAnnotationFormData();
    this.loadOfficialsBaseData();
    this.startOfficialsFallbackPolling();
    this.initializeTracking();
    this.startOfficialOfflineDetector();

    this.editingLayer.addTo(this.map);
  }

  ngOnDestroy(): void {
    this.officialsPollingSubscription?.unsubscribe();
    this.officialsPollingSubscription = null;
    if (this.officialOfflineIntervalId != null) {
      clearInterval(this.officialOfflineIntervalId);
      this.officialOfflineIntervalId = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Base map ──────────────────────────────────────────────────────────────

  setBaseLayer(layerKey: 'streets' | 'topographic'): void {
    if (!this.map || !this.baseLayers) return;
    this.currentBaseLayer = layerKey;
    Object.values(this.baseLayers).forEach((layer) => this.map.removeLayer(layer));
    this.baseLayers[layerKey].addTo(this.map);
  }

  setMapMode(mode: MapMode): void {
    if (this.currentMapMode === mode) return;
    this.currentMapMode = mode;
    if (mode !== 'annotations') {
      this.selectedAnnotationDetail = null;
    }
    this.applyMapModeLayerVisibility();
    this.triggerRealtimeViewSync();
  }

  toggleNeighborhoodLayer(enabled: boolean): void {
    this.showNeighborhoods = enabled;
    this.refreshMapLayers();
  }

  togglePointsLayer(enabled: boolean): void {
    this.showPoints = enabled;
    this.refreshMapLayers();
  }

  togglePointType(type: keyof typeof this.pointFilters, checked: boolean): void {
    this.pointFilters[type] = checked;
    this.refreshMapLayers();
  }

  toggleCategoryFilter(categoryId: number, checked: boolean): void {
    if (checked) {
      this.selectedFilterCategoryIds.add(categoryId);
    } else {
      this.selectedFilterCategoryIds.delete(categoryId);
    }
    this.refreshMapLayers();
  }

  clearCategoryFilters(): void {
    this.selectedFilterCategoryIds.clear();
    this.refreshMapLayers();
  }

  toggleCategoryNode(categoryId: number): void {
    if (this.expandedFilterCategoryIds.has(categoryId)) {
      this.expandedFilterCategoryIds.delete(categoryId);
      return;
    }
    this.expandedFilterCategoryIds.add(categoryId);
  }

  isCategoryNodeExpanded(categoryId: number): boolean {
    return this.expandedFilterCategoryIds.has(categoryId);
  }

  isCategorySelected(categoryId: number): boolean {
    return this.selectedFilterCategoryIds.has(categoryId);
  }

  getCategoryTotalCount(categoryId: number): number {
    return this.categoryTotalCount.get(categoryId) ?? 0;
  }

  toggleRealtimeOfficials(enabled: boolean): void {
    this.showRealtimeOfficials = enabled;
    this.persistRealtimeOfficialsToggle();
    if (!enabled) {
      this.trackingLayer.clearLayers();
      this.showNoOfficialsForSelectedEntity = false;
      this.applyMapModeLayerVisibility();
      return;
    }
    this.applyMapModeLayerVisibility();
    if (this.currentMapMode === 'officials') {
      this.rebuildVisibleTrackingMarkers();
    }
  }

  onEntityFilterSelected(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    this.selectedEntityFilter = value ? Number(value) : null;
    this.rebuildVisibleTrackingMarkers();
  }

  refreshRealtimePanel(): void {
    combineLatest([
      this.officialService.listCollection(),
      this.entityService.listCollection()
    ])
      .pipe(take(1))
      .subscribe({
        next: ([officialCollection, entityCollection]) => {
          this.applyEntityBaseState(entityCollection.items);
          this.applyOfficialsBaseState(officialCollection.items);
          this.auditRealtimeSync('refresh-realtime-panel');
          this.triggerRealtimeViewSync();
        }
      });
  }

  getRealtimeTotalCount(): number {
    return this.getRealtimeVisibleItemsBase().length;
  }

  getRealtimeActiveCount(): number {
    return this.getRealtimeVisibleItemsBase().filter((item) => this.getOfficialConnectionStateForUi(item.id_official) === 'ONLINE').length;
  }

  getRealtimeOfflineCount(): number {
    return this.getRealtimeVisibleItemsBase().filter((item) => this.getOfficialConnectionStateForUi(item.id_official) !== 'ONLINE').length;
  }

  getLatestRealtimeUpdateLabel(): string {
    let latest = 0;
    for (const item of this.getRealtimeVisibleItemsBase()) {
      const ts = item.lastUpdate ?? item.last_gps_update;
      if (!ts) continue;
      const ms = new Date(ts).getTime();
      if (Number.isFinite(ms) && ms > latest) {
        latest = ms;
      }
    }
    if (!latest) return 'Sin datos';
    return new Date(latest).toLocaleTimeString();
  }

  getRealtimePanelItems(): OfficialTrackingSnapshot[] {
    const all = this.getRealtimeVisibleItemsBase();
    const query = this.officialRealtimeSearch.trim().toLowerCase();

    return all
      .filter((item) => {
        if (!query) return true;
        const name = this.getOfficialDisplayName(item.id_official).toLowerCase();
        return name.includes(query);
      })
      .sort((a, b) => {
        const aOnline = this.getOfficialConnectionStateForUi(a.id_official) === 'ONLINE' ? 1 : 0;
        const bOnline = this.getOfficialConnectionStateForUi(b.id_official) === 'ONLINE' ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        return this.getOfficialDisplayName(a.id_official).localeCompare(this.getOfficialDisplayName(b.id_official));
      });
  }

  private getRealtimeVisibleItemsBase(): OfficialTrackingSnapshot[] {
    return Array.from(this.latestTrackingByOfficial.values())
      .filter((item) => this.shouldRenderOfficial(item));
  }

  trackRealtimeOfficial(_: number, item: OfficialTrackingSnapshot): number {
    return item.id_official;
  }

  getOfficialDisplayName(idOfficial: number): string {
    return this.officialsById.get(idOfficial)?.name ?? `Funcionario #${idOfficial}`;
  }

  getOfficialInitials(idOfficial: number): string {
    const name = this.getOfficialDisplayName(idOfficial);
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'FN';
  }

  formatRealtimeTime(timestamp: string | null | undefined): string {
    if (!timestamp) return 'Sin hora';
    const ms = new Date(timestamp).getTime();
    if (!Number.isFinite(ms)) return 'Sin hora';
    return new Date(ms).toLocaleTimeString();
  }

  formatRealtimeLocation(latitude: number, longitude: number): string {
    return `Lat ${latitude.toFixed(3)} · Lng ${longitude.toFixed(3)}`;
  }

  onNeighborhoodSelected(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    const selectedId = value ? Number(value) : null;
    this.selectedNeighborhoodId = selectedId;
    this.focusOnNeighborhood(selectedId);
    this.refreshMapLayers();
  }

  // ── Polygon editing ───────────────────────────────────────────────────────

  startPolygonEditing(): void {
    if (this.isAnnotationMode) this.toggleAnnotationMode();
    if (this.selectedNeighborhoodId == null) {
      alert('Por favor seleccione un barrio primero');
      return;
    }
    this.isEditingPolygon = true;
    this.isEditingExistingPolygon = false;
    this.polygonPoints = [];
    this.polygonMarkers = [];
    this.existingPolygonPoints = [];
    this.editingLayer.clearLayers();
    if (this.polygonLine) {
      this.map.removeLayer(this.polygonLine);
      this.polygonLine = null;
    }
    this.map.on('click', this.onMapClick);
  }

  startExistingPolygonEditing(): void {
    if (this.isAnnotationMode) this.toggleAnnotationMode();
    if (this.selectedNeighborhoodId == null) {
      alert('Por favor seleccione un barrio primero');
      return;
    }

    const polygonPoints = this.points
      .filter(p => p.point_type === 'polygon' && p.id_neighborhood === this.selectedNeighborhoodId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (polygonPoints.length < 3) {
      alert('Este barrio no tiene un polígono guardado. Use "Demarcar barrio" para crear uno nuevo.');
      return;
    }

    this.isEditingPolygon = true;
    this.isEditingExistingPolygon = true;
    this.existingPolygonPoints = [...polygonPoints];
    this.polygonPoints = polygonPoints.map(p => L.latLng(p.latitude, p.longitude));
    this.polygonMarkers = [];
    this.editingLayer.clearLayers();
    if (this.polygonLine) {
      this.map.removeLayer(this.polygonLine);
      this.polygonLine = null;
    }

    this.renderExistingPolygonMarkers();
    this.updatePolygonLine();
    this.map.on('click', this.onMapClick);
  }

  cancelPolygonEditing(): void {
    this.isEditingPolygon = false;
    this.isEditingExistingPolygon = false;
    this.polygonPoints = [];
    this.polygonMarkers.forEach(marker => this.editingLayer.removeLayer(marker));
    this.polygonMarkers = [];
    this.existingPolygonPoints = [];
    if (this.polygonLine) {
      this.map.removeLayer(this.polygonLine);
      this.polygonLine = null;
    }
    this.map.off('click', this.onMapClick);
  }

  savePolygon(): void {
    if (this.polygonPoints.length < 3) {
      alert('Se necesitan al menos 3 puntos para formar un polígono');
      return;
    }

    if (this.isEditingExistingPolygon) {
      this.updateExistingPolygon();
    } else {
      this.createNewPolygon();
    }
  }

  private createNewPolygon(): void {
    const pointsToSave: PointPayload[] = this.polygonPoints.map((latLng, index) => ({
      id_neighborhood: this.selectedNeighborhoodId,
      latitude: latLng.lat,
      longitude: latLng.lng,
      order: index,
      point_type: 'polygon'
    }));

    pointsToSave.forEach(pointPayload => {
      this.pointService.create(pointPayload).subscribe();
    });

    alert('Polígono guardado exitosamente');
    this.cancelPolygonEditing();
    this.loadTerritorialData();
  }

  private updateExistingPolygon(): void {
    const pointsToDelete = this.existingPolygonPoints.filter(
      existing => !this.polygonPoints.some(p => p.lat === existing.latitude && p.lng === existing.longitude)
    );

    const pointsToUpdate: { point: Point; latLng: L.LatLng }[] = [];
    const pointsToCreate: PointPayload[] = [];

    this.polygonPoints.forEach((latLng, index) => {
      const existingPoint = this.existingPolygonPoints.find(
        p => p.latitude === latLng.lat && p.longitude === latLng.lng
      );

      if (existingPoint) {
        pointsToUpdate.push({ point: existingPoint, latLng });
      } else {
        pointsToCreate.push({
          id_neighborhood: this.selectedNeighborhoodId,
          latitude: latLng.lat,
          longitude: latLng.lng,
          order: index,
          point_type: 'polygon'
        });
      }
    });

    pointsToDelete.forEach(point => {
      this.pointService.delete(point.id_point).subscribe();
    });

    pointsToUpdate.forEach(({ point, latLng }) => {
      this.pointService.update(point.id_point, {
        latitude: latLng.lat,
        longitude: latLng.lng,
        order: this.polygonPoints.indexOf(latLng)
      }).subscribe();
    });

    pointsToCreate.forEach(pointPayload => {
      this.pointService.create(pointPayload).subscribe();
    });

    alert('Polígono actualizado exitosamente');
    this.cancelPolygonEditing();
    this.loadTerritorialData();
  }

  private renderExistingPolygonMarkers(): void {
    this.polygonPoints.forEach((latLng, index) => {
      const marker = L.marker(latLng, {
        draggable: true,
        icon: L.divIcon({
          className: 'polygon-edit-marker',
          html: '<div style="width: 12px; height: 12px; background: #ef233c; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 0 3px rgba(239, 35, 60, 0.3);"></div>',
          iconSize: [12, 12],
          iconAnchor: [6, 6]
        })
      });

      marker.on('dragend', (event) => {
        const draggedMarker = event.target as L.Marker;
        const newIndex = this.polygonMarkers.indexOf(draggedMarker);
        if (newIndex !== -1) {
          this.polygonPoints[newIndex] = draggedMarker.getLatLng();
          this.updatePolygonLine();
        }
      });

      marker.on('contextmenu', (event) => {
        event.originalEvent.preventDefault();
        event.originalEvent.stopPropagation();
        const currentIndex = this.polygonMarkers.indexOf(marker);
        if (currentIndex !== -1) {
          this.removePolygonPoint(currentIndex);
        }
      });

      this.polygonMarkers.push(marker);
      this.editingLayer.addLayer(marker);
    });
  }

  private removePolygonPoint(index: number): void {
    if (this.polygonPoints.length <= 3) {
      alert('No se pueden eliminar más puntos. Mínimo 3 puntos requeridos.');
      return;
    }

    this.polygonPoints.splice(index, 1);
    const marker = this.polygonMarkers[index];
    this.editingLayer.removeLayer(marker);
    this.polygonMarkers.splice(index, 1);

    this.updatePolygonLine();
  }

  private onMapClick = (e: L.LeafletMouseEvent): void => {
    if (!this.isEditingPolygon) return;

    const latLng = e.latlng;
    this.polygonPoints.push(latLng);

    const marker = L.marker(latLng, {
      draggable: true,
      icon: L.divIcon({
        className: 'polygon-edit-marker',
        html: '<div style="width: 12px; height: 12px; background: #ef233c; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 0 3px rgba(239, 35, 60, 0.3);"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    });

    marker.on('dragend', (event) => {
      const draggedMarker = event.target as L.Marker;
      const newIndex = this.polygonMarkers.indexOf(draggedMarker);
      if (newIndex !== -1) {
        this.polygonPoints[newIndex] = draggedMarker.getLatLng();
        this.updatePolygonLine();
      }
    });

    marker.on('contextmenu', (event) => {
      event.originalEvent.preventDefault();
      event.originalEvent.stopPropagation();
      const index = this.polygonMarkers.indexOf(marker);
      if (index !== -1) {
        this.removePolygonPoint(index);
      }
    });

    this.polygonMarkers.push(marker);
    this.editingLayer.addLayer(marker);
    this.updatePolygonLine();
  };

  private updatePolygonLine(): void {
    if (this.polygonLine) {
      this.map.removeLayer(this.polygonLine);
    }

    if (this.polygonPoints.length < 2) return;

    const points = [...this.polygonPoints];
    if (points.length >= 3) {
      points.push(points[0]);
    }

    this.polygonLine = L.polyline(points, {
      color: '#ef233c',
      weight: 3,
      opacity: 0.8,
      dashArray: '10, 5'
    }).addTo(this.map);
  }

  // ── CU-12: Annotation mode ─────────────────────────────────────────────────

  toggleAnnotationMode(): void {
    if (this.isEditingPolygon) {
      // Si el usuario está editando/demarcando, salir de ese modo para no bloquear la anotación.
      this.cancelPolygonEditing();
      this.toastService.info('Modo demarcación desactivado', 'Ahora puede registrar una anotación en el mapa.');
    }
    this.isAnnotationMode = !this.isAnnotationMode;
    if (this.isAnnotationMode) {
      // Evita handlers duplicados en cambios repetidos de modo.
      this.map.off('click', this.onAnnotationMapClick);
      this.map.on('click', this.onAnnotationMapClick);
    } else {
      this.map.off('click', this.onAnnotationMapClick);
    }
  }

  private onAnnotationMapClick = (e: L.LeafletMouseEvent): void => {
    if (!this.isAnnotationMode) return;
    this.openAnnotationFromMap(e.latlng);
  };

  openAnnotationFromMap(latlng: L.LatLng): void {
    const pendingNeighborhoodId = this.findNeighborhoodForPoint(latlng.lat, latlng.lng);
    if (pendingNeighborhoodId === null) {
      this.toastService.warning(
        'Punto fuera de demarcación',
        'Debe seleccionar un punto dentro de un barrio demarcado.'
      );
      return;
    }

    this.isAnnotationMode = false;
    this.map.off('click', this.onAnnotationMapClick);
    const neighborhoodName = this.getNeighborhoodName(pendingNeighborhoodId);
    this.router.navigate(['/anotaciones'], {
      queryParams: {
        fromMap: '1',
        neighborhoodId: pendingNeighborhoodId,
        neighborhoodName,
        latitude: latlng.lat,
        longitude: latlng.lng
      }
    });
  }

  clearAnnotationSelection(): void {
    this.isAnnotationMode = false;
    this.map.off('click', this.onAnnotationMapClick);
    this.selectedAnnotationLocation = null;
    this.resetAnnotationForm();
  }

  toggleAnnotationCategory(categoryId: number, checked: boolean): void {
    const selected = [...(this.annotationForm.value.categoryIds ?? [])];
    if (checked) {
      if (!selected.includes(categoryId)) selected.push(categoryId);
    } else {
      const idx = selected.indexOf(categoryId);
      if (idx >= 0) selected.splice(idx, 1);
    }
    this.annotationForm.controls.categoryIds.setValue(selected);
  }

  toggleAnnotationEntity(entityId: number, checked: boolean): void {
    const selected = [...(this.annotationForm.value.interestedEntityIds ?? [])];
    if (checked) {
      if (!selected.includes(entityId)) selected.push(entityId);
    } else {
      const idx = selected.indexOf(entityId);
      if (idx >= 0) selected.splice(idx, 1);
    }
    this.annotationForm.controls.interestedEntityIds.setValue(selected);
  }

  onAnnotationFilesSelected(files: File[]): void {
    this.annotationPhotoFiles = files;
  }

  onAnnotationInvalidFiles(names: string[]): void {
    if (names.length > 0) {
      this.toastService.warning('Archivos inválidos', `No se pudieron agregar (superan 2 MB): ${names.join(', ')}`);
    }
  }

  // ── CU-12: Submit annotation ───────────────────────────────────────────────

  submitAnnotation(): void {
    const idCitizen = this.annotationForm.controls.id_citizen.value;
    const description = this.annotationForm.controls.description.value?.trim();

    if (!idCitizen) {
      this.toastService.danger('Campo requerido', 'Debe seleccionar un ciudadano.');
      return;
    }

    if (!description) {
      this.toastService.danger('Campo requerido', 'Debe escribir una descripción.');
      return;
    }

    if (!this.selectedAnnotationLocation) {
      this.toastService.warning(
        'Ubicación requerida',
        'Seleccione un barrio demarcado en el mapa para crear una anotación.'
      );
      return;
    }

    const lat = this.selectedAnnotationLocation.lat;
    const lng = this.selectedAnnotationLocation.lng;

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      this.toastService.danger('Coordenadas inválidas', 'Las coordenadas del punto no son válidas.');
      return;
    }

    this.isSavingAnnotation = true;

    const payload: AnnotationPayload = {
      id_neighborhood: this.selectedAnnotationLocation.neighborhoodId,
      id_citizen: Number(idCitizen),
      description,
      latitude: lat,
      longitude: lng,
      status: 'active'
    };

    this.annotationService.create(payload).pipe(
      catchError((error) => {
        const backendMessage = this.extractErrorMessage(error);
        this.toastService.danger(
          'Error al crear',
          backendMessage ? `No se pudo registrar la anotación: ${backendMessage}` : 'No se pudo registrar la anotación. Intente nuevamente.'
        );
        this.isSavingAnnotation = false;
        return of(null);
      })
    ).subscribe((annotation) => {
      if (!annotation) return;

      const categoryIds = this.annotationForm.value.categoryIds ?? [];
      const entityIds = this.annotationForm.value.interestedEntityIds ?? [];

      const tasks: Observable<unknown>[] = [];
      let optionalTaskFailures = 0;
      const wrapOptionalTask = (task$: Observable<unknown>): Observable<unknown> =>
        task$.pipe(
          catchError((error) => {
            optionalTaskFailures += 1;
            console.error('[CU-12] Error en tarea opcional de anotación:', error);
            return of(null);
          })
        );

      // Point for map display (always first — used to update annotationLayer).
      // id_neighborhood is intentionally omitted: the backend rejects payloads that
      // include both id_neighborhood and id_annotation simultaneously.
      // The barrio association is already stored on the Annotation record itself.
      tasks.push(
        this.pointService.create({
          id_annotation: annotation.id_annotation,
          latitude: lat,
          longitude: lng,
          point_type: 'annotation'
        })
      );

      // Annotation–category links
      for (const categoryId of categoryIds) {
        const catPayload: AnnotationCategoryPayload = {
          id_annotation: annotation.id_annotation,
          id_category: categoryId
        };
        tasks.push(wrapOptionalTask(this.annotationCategoryService.create(catPayload)));
      }

      // Interested parties
      for (const entityId of entityIds) {
        tasks.push(
          wrapOptionalTask(this.interestedPartyService.create({
            id_annotation: annotation.id_annotation,
            id_entity: entityId
          }))
        );
      }

      // Photo evidences (structure supports multiple files → future multi-image ready)
      for (const file of this.annotationPhotoFiles) {
        const fd = new FormData();
        fd.append('id_annotation', String(annotation.id_annotation));
        fd.append('file', file);
        tasks.push(wrapOptionalTask(this.evidenceService.createForm(fd)));
      }

      forkJoin(tasks).pipe(
        catchError((error) => {
          const backendMessage = this.extractErrorMessage(error);
          this.toastService.danger(
            'Error al crear punto de mapa',
            backendMessage
              ? `La anotación se registró, pero no se pudo crear su punto en el mapa: ${backendMessage}`
              : 'La anotación se registró, pero no se pudo crear su punto en el mapa.'
          );
          this.isSavingAnnotation = false;
          this.clearAnnotationSelection();
          return of(null);
        })
      ).subscribe((results) => {
        this.isSavingAnnotation = false;

        if (results) {
          if (optionalTaskFailures > 0) {
            this.toastService.warning(
              'Anotación registrada parcialmente',
              'La anotación fue guardada y aparece en el mapa, pero algunas asociaciones opcionales no se registraron.'
            );
          } else {
            this.toastService.success('Anotación registrada', 'La anotación fue guardada y ya aparece en el mapa.');
          }

          // Add the new Point (index 0) to this.points and refresh the map immediately
          const newPoint = results[0] as Point;
          if (newPoint?.id_point != null) {
            const newAnnotationId = annotation.id_annotation;
            const selectedCategories = new Set<number>(categoryIds);
            this.annotationCategoryMap.set(newAnnotationId, selectedCategories);

            for (const categoryId of categoryIds) {
              this.allAnnotationCategories.push({
                id_annotation_category: -(Date.now() + categoryId),
                id_annotation: newAnnotationId,
                id_category: categoryId
              });
            }
            this.buildCategoryCounts();

            this.points = [...this.points, newPoint];
            this.annotationDescriptionMap.set(newAnnotationId, description);
            this.refreshMapLayers();
          }
        }

        this.clearAnnotationSelection();
      });
    });
  }

  // ── CU-12: Helpers ────────────────────────────────────────────────────────

  getNeighborhoodName(id: number): string {
    const found = this.neighborhoods.find(n => n.id_neighborhood === id);
    if (found) return found.name;
    const shape = NEIGHBORHOOD_SHAPES.find(s => s.id === id);
    return shape?.name ?? `Barrio #${id}`;
  }

  /**
   * Determines which neighborhood (if any) contains the given lat/lng.
   * Checks API-loaded polygon points first, then hardcoded NEIGHBORHOOD_SHAPES.
   */
  private findNeighborhoodForPoint(lat: number, lng: number): number | null {
    // Build polygon map from API points
    const polygonPoints = this.points.filter(p => p.point_type === 'polygon' && p.id_neighborhood != null);
    const neighborhoodPolygonsMap = new Map<number, Point[]>();

    for (const pt of polygonPoints) {
      const nid = pt.id_neighborhood!;
      if (!neighborhoodPolygonsMap.has(nid)) {
        neighborhoodPolygonsMap.set(nid, []);
      }
      neighborhoodPolygonsMap.get(nid)!.push(pt);
    }

    for (const [neighborhoodId, pts] of neighborhoodPolygonsMap) {
      const coords = this.buildNeighborhoodPolygonCoordinates(pts);
      if (coords.length >= 3 && this.isPointInPolygon(lat, lng, coords)) {
        return neighborhoodId;
      }
    }

    // Fallback: check hardcoded shapes
    for (const shape of NEIGHBORHOOD_SHAPES) {
      if (this.isPointInPolygon(lat, lng, shape.coordinates)) {
        return shape.id;
      }
    }

    return null;
  }

  /**
   * Ray-casting point-in-polygon test.
   * coords: array of [lat, lng] tuples forming a closed polygon.
   */
  private isPointInPolygon(lat: number, lng: number, coords: L.LatLngTuple[]): boolean {
    let inside = false;
    const x = lng;
    const y = lat;
    const n = coords.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = coords[i][1];
      const yi = coords[i][0];
      const xj = coords[j][1];
      const yj = coords[j][0];

      const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  }

  private resetAnnotationForm(): void {
    this.annotationForm.reset({
      id_citizen: null,
      description: '',
      categoryIds: [],
      interestedEntityIds: []
    });
    this.annotationPhotoFiles = [];
  }

  private loadAnnotationFormData(): void {
    forkJoin({
      categories: this.categoryService.listCollection().pipe(
        catchError(() => of({ items: [] as Category[], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false }))
      ),
      entities: this.entityService.listCollection().pipe(
        catchError(() => of({ items: [] as Entity[], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false }))
      ),
      citizens: this.citizenService.listCollection().pipe(
        catchError(() => of({ items: [] as Citizen[], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false }))
      )
    }).subscribe(({ categories, entities, citizens }) => {
      this.annotationCategories = categories.items;
      this.annotationEntities = entities.items;
      this.annotationCitizens = citizens.items;
    });
  }

  private loadCategoryFilterData(): Observable<{
    categories: Category[];
    annotationCategories: AnnotationCategory[];
  }> {
    return forkJoin({
      categories: this.categoryService.listCollection().pipe(
        catchError(() => of({ items: [] as Category[], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false }))
      ),
      annotationCategories: this.annotationCategoryService.listCollection().pipe(
        catchError(() => of({ items: [] as AnnotationCategory[], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false }))
      )
    }).pipe(
      map(({ categories, annotationCategories }) => ({
        categories: categories.items,
        annotationCategories: annotationCategories.items
      })),
      catchError(() => of({
        categories: [] as Category[],
        annotationCategories: [] as AnnotationCategory[]
      }))
    );
  }

  private initializeCategoryFilterState(categories: Category[], annotationCategories: AnnotationCategory[]): void {
    this.allCategories = categories;
    this.allAnnotationCategories = annotationCategories;
    this.categoriesById = new Map(categories.map((cat) => [cat.id_category, cat]));

    this.categoryChildrenMap.clear();
    for (const category of categories) {
      const parentId = category.id_parent_category ?? null;
      const bucket = this.categoryChildrenMap.get(parentId) ?? [];
      bucket.push(category);
      this.categoryChildrenMap.set(parentId, bucket);
    }

    this.annotationCategoryMap.clear();
    for (const relation of annotationCategories) {
      const categoryBucket = this.annotationCategoryMap.get(relation.id_annotation) ?? new Set<number>();
      categoryBucket.add(relation.id_category);
      this.annotationCategoryMap.set(relation.id_annotation, categoryBucket);
    }

    this.buildCategoryDescendantsMap();
    this.buildCategoryCounts();
    this.buildCategoryColorMap();
    this.categoryFilterTree = this.buildCategoryTree(null);
    this.expandAllFilterRoots();
  }

  private buildCategoryTree(parentId: number | null): CategoryTreeNode[] {
    const children = this.categoryChildrenMap.get(parentId) ?? [];
    return children
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((category) => ({
        category,
        children: this.buildCategoryTree(category.id_category)
      }));
  }

  private expandAllFilterRoots(): void {
    for (const root of this.categoryFilterTree) {
      this.expandedFilterCategoryIds.add(root.category.id_category);
    }
  }

  private buildCategoryDescendantsMap(): void {
    this.categoryDescendantsMap.clear();

    const walk = (categoryId: number): Set<number> => {
      const descendants = new Set<number>([categoryId]);
      const children = this.categoryChildrenMap.get(categoryId) ?? [];
      for (const child of children) {
        const childSet = walk(child.id_category);
        for (const id of childSet) descendants.add(id);
      }
      this.categoryDescendantsMap.set(categoryId, descendants);
      return descendants;
    };

    for (const category of this.allCategories) {
      if (!this.categoryDescendantsMap.has(category.id_category)) {
        walk(category.id_category);
      }
    }
  }

  private buildCategoryCounts(): void {
    this.categoryDirectCount.clear();
    this.categoryTotalCount.clear();

    for (const relation of this.allAnnotationCategories) {
      this.categoryDirectCount.set(
        relation.id_category,
        (this.categoryDirectCount.get(relation.id_category) ?? 0) + 1
      );
    }

    for (const category of this.allCategories) {
      const descendants = this.categoryDescendantsMap.get(category.id_category) ?? new Set<number>([category.id_category]);
      let total = 0;
      for (const id of descendants) {
        total += this.categoryDirectCount.get(id) ?? 0;
      }
      this.categoryTotalCount.set(category.id_category, total);
    }
  }

  private buildCategoryColorMap(): void {
    this.categoryColorMap.clear();
    const roots = this.categoryChildrenMap.get(null) ?? [];
    roots
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((root, index) => {
        const palette = this.rootPalette[index % this.rootPalette.length];
        this.categoryColorMap.set(root.id_category, palette);
      });
  }

  private getExpandedSelectedCategoryIds(): Set<number> {
    if (this.selectedFilterCategoryIds.size === 0) {
      return new Set<number>();
    }

    const expanded = new Set<number>();
    for (const selectedId of this.selectedFilterCategoryIds) {
      const descendants = this.categoryDescendantsMap.get(selectedId) ?? new Set<number>([selectedId]);
      for (const id of descendants) expanded.add(id);
    }
    return expanded;
  }

  private passesCategoryFilter(annotationId: number | null | undefined): boolean {
    if (this.selectedFilterCategoryIds.size === 0) return true;
    if (annotationId == null) return false;

    const annotationCategories = this.annotationCategoryMap.get(annotationId);
    if (!annotationCategories || annotationCategories.size === 0) return false;

    const allowedCategories = this.getExpandedSelectedCategoryIds();
    for (const id of annotationCategories) {
      if (allowedCategories.has(id)) return true;
    }
    return false;
  }

  private getAnnotationMarkerConfigForAnnotation(annotationId: number | null | undefined): AnnotationMarkerConfig {
    if (annotationId == null) return ANNOTATION_MARKER_FALLBACK;
    const categoryIds = this.annotationCategoryMap.get(annotationId);
    if (!categoryIds || categoryIds.size === 0) return ANNOTATION_MARKER_FALLBACK;

    const categories = Array.from(categoryIds)
      .map((categoryId) => this.categoriesById.get(categoryId))
      .filter((category): category is Category => category != null);
    return this.getAnnotationMarkerConfig(categories);
  }

  private getAnnotationMarkerConfig(categories: Category[]): AnnotationMarkerConfig {
    const terms = categories
      .flatMap((category) => {
        const related = [category.name];
        if (category.id_parent_category != null) {
          const parent = this.categoriesById.get(category.id_parent_category);
          if (parent) related.push(parent.name);
        }
        return related;
      })
      .map((value) => this.normalizeSearchTerm(value));

    for (const rule of ANNOTATION_MARKER_RULES) {
      const matches = rule.keywords.some((keyword) => terms.some((term) => term.includes(this.normalizeSearchTerm(keyword))));
      if (matches) {
        return { icon: rule.icon, color: rule.color, markerType: rule.markerType };
      }
    }
    return ANNOTATION_MARKER_FALLBACK;
  }

  private normalizeSearchTerm(value: string | null | undefined): string {
    if (!value) return '';
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private getAnnotationMarkerIconSvg(icon: string): string {
    const common = 'stroke="#ffffff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    switch (icon) {
      case 'cone':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M10 3l4 12H6L10 3z"/><path ${common} d="M8 8h4"/></svg>`;
      case 'bus':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><rect x="4" y="4.5" width="12" height="9" rx="2" ${common}/><path ${common} d="M6 8h8"/><circle cx="7" cy="14.5" r="1.2" fill="#fff"/><circle cx="13" cy="14.5" r="1.2" fill="#fff"/></svg>`;
      case 'shield':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M10 3l5 2v4c0 3.4-2.1 5.8-5 7-2.9-1.2-5-3.6-5-7V5l5-2z"/></svg>`;
      case 'cross':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M10 4v12M4 10h12"/></svg>`;
      case 'book':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M5 4h6a2 2 0 012 2v10H7a2 2 0 00-2 2V4z"/><path ${common} d="M13 6h2v12h-2"/></svg>`;
      case 'tree':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M10 4l4 5H6l4-5z"/><path ${common} d="M10 9v6"/><path ${common} d="M8.5 15h3"/></svg>`;
      case 'leaf':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M4 11c0-4 4-7 11-7 0 7-3 11-7 11-2.2 0-4-1.8-4-4z"/><path ${common} d="M7 13l5-5"/></svg>`;
      case 'store':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M4 8h12l-1-3H5l-1 3z"/><path ${common} d="M5 8v7h10V8"/><path ${common} d="M8 15v-3h4v3"/></svg>`;
      case 'alert':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M10 3l7 13H3L10 3z"/><path ${common} d="M10 8v4"/><circle cx="10" cy="14" r="1" fill="#fff"/></svg>`;
      case 'sound':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M4 12h3l4 3V5L7 8H4v4z"/><path ${common} d="M13 8.5c1 .8 1 2.2 0 3"/><path ${common} d="M14.8 7c1.8 1.5 1.8 4.5 0 6"/></svg>`;
      case 'light':
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M10 3a4 4 0 00-2.5 7.1c.9.7 1.5 1.7 1.5 2.9h2c0-1.2.6-2.2 1.5-2.9A4 4 0 0010 3z"/><path ${common} d="M8.3 15h3.4M8.8 17h2.4"/></svg>`;
      default:
        return `<svg viewBox="0 0 20 20" width="12" height="12"><path ${common} d="M10 3a5 5 0 00-5 5c0 3.3 5 9 5 9s5-5.7 5-9a5 5 0 00-5-5z"/><circle cx="10" cy="8" r="1.5" fill="#fff"/></svg>`;
    }
  }

  private getAnnotationMarkerIconGlyph(icon: string): string {
    switch (icon) {
      case 'cone': return '🚧';
      case 'bus': return '🚌';
      case 'shield': return '🛡️';
      case 'cross': return '✚';
      case 'book': return '📘';
      case 'tree': return '🌳';
      case 'leaf': return '🍃';
      case 'store': return '🏪';
      case 'alert': return '⚠️';
      case 'sound': return '🔊';
      case 'light': return '💡';
      default: return '📍';
    }
  }

  private buildPinMarkerHtml(color: string, iconSvg: string): string {
    return `
      <div style="
        width: 36px;
        height: 48px;
        position: relative;
        transform: translate(-2px, -10px);
        filter: drop-shadow(0 8px 12px rgba(15, 23, 42, 0.28));
      ">
        <svg viewBox="0 0 36 48" width="36" height="48" style="display:block;">
          <path
            d="M18 2C10.3 2 4 8.2 4 15.9c0 10.5 11.3 22.6 13.3 24.7a1 1 0 0 0 1.4 0C20.7 38.5 32 26.4 32 15.9 32 8.2 25.7 2 18 2Z"
            fill="${color}"
            stroke="#ffffff"
            stroke-width="2"
          />
        </svg>
        <div style="
          position: absolute;
          top: 9px;
          left: 50%;
          transform: translateX(-50%);
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${iconSvg}
        </div>
      </div>
    `;
  }

  private buildAnnotationMarkerHtml(config: AnnotationMarkerConfig): string {
    return this.buildPinMarkerHtml(config.color, this.getAnnotationMarkerIconSvg(config.icon));
  }

  private getEntityMarkerIconSvg(): string {
    const common = 'stroke="#ffffff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"';
    return `<svg viewBox="0 0 20 20" width="12" height="12">
      <rect x="4" y="5" width="12" height="11" rx="1.5" ${common}/>
      <path ${common} d="M8 16v-3h4v3M8 8h.01M12 8h.01M8 11h.01M12 11h.01"/>
    </svg>`;
  }

  // ── Map rendering ─────────────────────────────────────────────────────────

  private initializeMap(): void {
    const center = [5.074, -75.515] as L.LatLngExpression;

    this.map = L.map(this.mapContainer.nativeElement, {
      center,
      zoom: 14,
      scrollWheelZoom: true,
      attributionControl: false
    });

    this.baseLayers = {
      streets: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }),
      topographic: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; CartoDB'
      })
    };

    this.setBaseLayer('streets');
    this.neighborhoodLayer.addTo(this.map);
    this.annotationLayer.addTo(this.map);
    this.entityLayer.addTo(this.map);
    this.pointLayer.addTo(this.map);
    this.selectedNeighborhoodLayer.addTo(this.map);
    this.applyMapModeLayerVisibility();
  }

  private applyMapModeLayerVisibility(): void {
    if (!this.map) return;
    const shouldShowTracking = this.currentMapMode === 'officials' && this.showRealtimeOfficials;
    if (shouldShowTracking) {
      if (!this.map.hasLayer(this.trackingLayer)) {
        this.trackingLayer.addTo(this.map);
      }
      return;
    }

    if (this.map.hasLayer(this.trackingLayer)) {
      this.map.removeLayer(this.trackingLayer);
    }
    this.showNoOfficialsForSelectedEntity = false;
  }

  private loadTerritorialData(): void {
    combineLatest([
      this.neighborhoodService.listCollection().pipe(
        catchError(() => of({ items: [] as Neighborhood[], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false }))
      ),
      this.pointService.listCollection().pipe(
        catchError(() => of({ items: [] as Point[], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false }))
      ),
      this.annotationService.listCollection().pipe(
        catchError(() => of({ items: [] as Annotation[], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false }))
      ),
      this.entityService.listCollection().pipe(
        catchError(() => of({ items: [] as Entity[], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false }))
      ),
      this.loadCategoryFilterData()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([neighborhoodCollection, pointCollection, annotationCollection, entityCollection, categoryFilterData]) => {
        this.neighborhoods = neighborhoodCollection.items;
        this.points = pointCollection.items;
        this.mapEntities = entityCollection.items;
        this.annotationDescriptionMap = new Map(
          annotationCollection.items.map((annotation) => [annotation.id_annotation, annotation.description ?? ''])
        );
        this.initializeCategoryFilterState(categoryFilterData.categories, categoryFilterData.annotationCategories);
        this.refreshMapLayers();
        this.refreshEntityMarkers();
      });
  }

  private refreshMapLayers(): void {
    this.neighborhoodLayer.clearLayers();
    this.pointLayer.clearLayers();
    this.annotationLayer.clearLayers();
    this.selectedNeighborhoodLayer.clearLayers();
    this.visibleAnnotationCount = 0;
    this.hasAnnotationPoints = this.points.some((point) => point.point_type === 'annotation' && point.id_annotation != null);

    if (this.showNeighborhoods) {
      this.renderNeighborhoodPolygons();
    }

    if (this.showPoints) {
      this.renderPointMarkers();
    }
  }

  private refreshEntityMarkers(): void {
    if (this.mapEntities.length === 0) return;
    this.entityLayer.clearLayers();
    this.renderedEntityCoordsById.clear();

    for (const entity of this.mapEntities) {
      if (!this.isEntityStatusActive(entity.status)) {
        continue;
      }

      const coords = this.getEntityCoordsFromCache(entity);
      if (coords) {
        this.addEntityMarker(entity, coords, false);
        continue;
      }

      const officialCoords = this.getEntityCoordsFromOfficials(entity.id_entity);
      if (officialCoords) {
        this.addEntityMarker(entity, officialCoords, false);
      } else {
        this.addEntityMarker(entity, this.getEntityFallbackCoords(entity.id_entity), true);
      }

      const address = this.normalizeAddress(entity.address);
      const failedAddress = this.failedEntityGeocodeAddress.get(entity.id_entity);
      if (!address || this.pendingEntityGeocoding.has(entity.id_entity) || failedAddress === address) {
        continue;
      }

      this.pendingEntityGeocoding.add(entity.id_entity);
      void this.geocodeEntityAddress(entity, address);
    }
  }

  private addEntityMarker(entity: Entity, coords: L.LatLngTuple, approximate: boolean): void {
    const officialsCount = this.countOfficialsForEntity(entity.id_entity);
    this.renderedEntityCoordsById.set(entity.id_entity, coords);
    const marker = L.marker(coords, {
      icon: L.divIcon({
        className: 'map-entity-marker',
        html: this.buildPinMarkerHtml('#16a34a', this.getEntityMarkerIconSvg())
      }),
      draggable: false
    });
    marker.bindTooltip(entity.name, { direction: 'top' });
    marker.bindPopup(
      `<strong>${entity.name}</strong><br>` +
      `NIT: ${entity.nit ?? 'Sin dato'}<br>` +
      `Dirección: ${entity.address ?? 'Sin dato'}<br>` +
      `Teléfono: ${entity.phone ?? 'Sin dato'}<br>` +
      `Correo: ${entity.email ?? 'Sin dato'}<br>` +
      `Funcionarios: ${officialsCount}<br>` +
      `Ubicación: ${approximate ? 'Aproximada' : 'Precisa'}<br>` +
      `Estado: ${entity.status ?? 'Sin dato'}`
    );
    this.entityLayer.addLayer(marker);
  }

  private async geocodeEntityAddress(entity: Entity, address: string): Promise<void> {
    try {
      const query = encodeURIComponent(`${address}, Manizales, Colombia`);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`, {
        headers: {
          Accept: 'application/json'
        }
      });
      if (!response.ok) {
        return;
      }

      const results = await response.json() as Array<{ lat: string; lon: string }>;
      const first = results[0];
      if (!first) return;

      const lat = Number(first.lat);
      const lng = Number(first.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      this.entityGeocodeCache.set(entity.id_entity, {
        lat,
        lng,
        address
      });
      this.failedEntityGeocodeAddress.delete(entity.id_entity);
      this.persistEntityGeocodeCache();
      this.refreshEntityMarkers();
    } catch {
      // Best effort: geocoding may fail for ambiguous addresses.
      this.failedEntityGeocodeAddress.set(entity.id_entity, address);
    } finally {
      this.pendingEntityGeocoding.delete(entity.id_entity);
    }
  }

  private getEntityCoordsFromCache(entity: Entity): L.LatLngTuple | null {
    const cached = this.entityGeocodeCache.get(entity.id_entity);
    if (!cached) return null;
    if (cached.address !== this.normalizeAddress(entity.address)) {
      this.entityGeocodeCache.delete(entity.id_entity);
      return null;
    }
    return [cached.lat, cached.lng];
  }

  private normalizeAddress(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  private getEntityCoordsFromOfficials(entityId: number): L.LatLngTuple | null {
    for (const tracking of this.latestTrackingByOfficial.values()) {
      const official = this.officialsById.get(tracking.id_official);
      const trackedEntityId = tracking.id_entity ?? official?.id_entity ?? null;
      if (trackedEntityId !== entityId) {
        continue;
      }

      if (
        Number.isFinite(tracking.latitude)
        && Number.isFinite(tracking.longitude)
      ) {
        return [tracking.latitude, tracking.longitude];
      }
    }
    return null;
  }

  private getEntityFallbackCoords(entityId: number): L.LatLngTuple {
    const baseLat = 5.074;
    const baseLng = -75.515;
    const angleDeg = (entityId * 137.5) % 360;
    const angleRad = angleDeg * (Math.PI / 180);
    const radius = 0.0028 + ((entityId % 5) * 0.00045);
    const lat = baseLat + (Math.sin(angleRad) * radius);
    const lng = baseLng + (Math.cos(angleRad) * radius);
    return [lat, lng];
  }

  private countOfficialsForEntity(entityId: number): number {
    let count = 0;
    for (const official of this.officialsById.values()) {
      if (official.id_entity === entityId) {
        count += 1;
      }
    }
    return count;
  }

  private restoreEntityGeocodeCache(): void {
    const raw = localStorage.getItem(this.entityGeocodeStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, EntityGeocodeCacheEntry>;
      for (const [id, entry] of Object.entries(parsed)) {
        const entityId = Number(id);
        if (!Number.isFinite(entityId)) continue;
        if (
          !entry
          || typeof entry.lat !== 'number'
          || typeof entry.lng !== 'number'
          || typeof entry.address !== 'string'
        ) {
          continue;
        }
        this.entityGeocodeCache.set(entityId, entry);
      }
    } catch {
      localStorage.removeItem(this.entityGeocodeStorageKey);
    }
  }

  private persistEntityGeocodeCache(): void {
    const serializable: Record<string, EntityGeocodeCacheEntry> = {};
    for (const [id, entry] of this.entityGeocodeCache.entries()) {
      serializable[String(id)] = entry;
    }
    localStorage.setItem(this.entityGeocodeStorageKey, JSON.stringify(serializable));
  }

  private restoreRealtimeOfficialsToggle(): void {
    const raw = localStorage.getItem(this.realtimeOfficialsToggleStorageKey);
    if (raw === 'true') {
      this.showRealtimeOfficials = true;
      return;
    }
    if (raw === 'false') {
      this.showRealtimeOfficials = false;
    }
  }

  private persistRealtimeOfficialsToggle(): void {
    localStorage.setItem(this.realtimeOfficialsToggleStorageKey, String(this.showRealtimeOfficials));
  }

  private renderNeighborhoodPolygons(): void {
    for (const shape of NEIGHBORHOOD_SHAPES) {
      const polygon = L.polygon(shape.coordinates, {
        color: '#1459f5',
        weight: 2,
        fillOpacity: 0.12
      });

      polygon.bindTooltip(shape.name, { direction: 'top' });
      polygon.on('click', () => {
        this.focusOnNeighborhood(shape.id);
      });

      this.neighborhoodLayer.addLayer(polygon);
    }

    this.renderSavedPolygons();
  }

  private renderSavedPolygons(): void {
    const polygonPoints = this.points.filter(p => p.point_type === 'polygon' && p.id_neighborhood != null);

    const neighborhoodPointsMap = new Map<number, Point[]>();
    polygonPoints.forEach(point => {
      const neighborhoodId = point.id_neighborhood!;
      if (!neighborhoodPointsMap.has(neighborhoodId)) {
        neighborhoodPointsMap.set(neighborhoodId, []);
      }
      neighborhoodPointsMap.get(neighborhoodId)!.push(point);
    });

    neighborhoodPointsMap.forEach((pts, neighborhoodId) => {
      const coordinates = this.buildNeighborhoodPolygonCoordinates(pts);

      if (coordinates.length >= 3) {
        const neighborhood = this.neighborhoods.find(n => n.id_neighborhood === neighborhoodId);
        const polygon = L.polygon(coordinates, {
          color: '#1459f5',
          weight: 2,
          fillOpacity: 0.12
        });

        if (neighborhood) {
          polygon.bindTooltip(neighborhood.name, { direction: 'top' });
        }

        polygon.on('click', () => {
          this.focusOnNeighborhood(neighborhoodId);
        });

        this.neighborhoodLayer.addLayer(polygon);
      }
    });
  }

  private renderPointMarkers(): void {
    for (const point of this.points) {
      if (point.latitude == null || point.longitude == null) continue;

      const isAnnotationPoint = point.point_type === 'annotation';

      if (!this.pointFilters[point.point_type as keyof typeof this.pointFilters]) continue;

      if (isAnnotationPoint) {
        if (!this.passesCategoryFilter(point.id_annotation)) continue;
        this.visibleAnnotationCount += 1;

        const markerConfig = this.getAnnotationMarkerConfigForAnnotation(point.id_annotation);
        const marker = L.marker([point.latitude, point.longitude], {
          icon: L.divIcon({
            className: 'map-annotation-marker',
            html: this.buildAnnotationMarkerHtml(markerConfig)
          }),
          draggable: false
        });
        marker.on('click', () => {
          if (point.id_annotation != null) {
            this.openAnnotationDetailPanel(marker, point.id_annotation, point);
          }
        });
        marker.bindPopup(`Cargando anotación #${point.id_annotation ?? point.id_point}...`);
        const annotationDescription = point.id_annotation != null ? this.annotationDescriptionMap.get(point.id_annotation) : '';
        marker.bindTooltip((annotationDescription ?? '').trim() || 'Anotación sin descripción', { direction: 'top' });
        this.annotationLayer.addLayer(marker);
      } else {
        // Other point types → general pointLayer (draggable)
        const marker = L.marker([point.latitude, point.longitude], {
          icon: L.divIcon({ className: 'map-point-marker' }),
          draggable: true
        });

        marker.bindPopup(`Tipo: ${point.point_type}<br>ID: ${point.id_point}`);
        marker.on('dragend', () => this.updatePointLocation(point, marker.getLatLng()));
        this.pointLayer.addLayer(marker);
      }
    }
  }

  private openAnnotationDetailPanel(marker: L.Marker, annotationId: number, point: Point): void {
    marker.setPopupContent(`Cargando anotación #${annotationId}...`);

    forkJoin({
      annotation: this.annotationService.getById(annotationId).pipe(catchError(() => of(null))),
      evidences: this.evidenceService.searchCollection({ id_annotation: annotationId }).pipe(
        map((response) => response.items),
        catchError(() => of([] as Evidence[]))
      ),
      votes: this.voteService.searchCollection({ id_annotation: annotationId }).pipe(
        map((response) => response.items),
        catchError(() => of([] as Vote[]))
      )
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ annotation, evidences, votes }) => {
        const annotationCategoryIds = this.annotationCategoryMap.get(annotationId) ?? new Set<number>();
        const categories = Array.from(annotationCategoryIds)
          .map((categoryId) => this.categoriesById.get(categoryId))
          .filter((category): category is Category => category != null);

        const votesCount = votes.length;
        const averageVotes = votesCount > 0
          ? votes.reduce((sum, vote) => sum + vote.stars, 0) / votesCount
          : null;

        const popupData: AnnotationPopupData = {
          annotation,
          evidences,
          categories,
          averageVotes,
          votesCount
        };

        this.selectedAnnotationDetail = this.buildAnnotationDetailPanelData(annotationId, point, popupData);
        marker.setPopupContent(this.buildAnnotationPopupHtml(annotationId, point, popupData));
        marker.openPopup();
        this.triggerRealtimeViewSync();
      });
  }

  private buildAnnotationDetailPanelData(
    annotationId: number,
    point: Point,
    data: AnnotationPopupData
  ): AnnotationDetailPanelData {
    const markerConfig = this.getAnnotationMarkerConfig(data.categories);
    const primaryCategory = data.categories.find((category) => category.id_parent_category == null) ?? data.categories[0] ?? null;
    const subcategory = data.categories.find((category) => category.id_parent_category != null) ?? null;
    const neighborhood = data.annotation?.id_neighborhood != null
      ? this.neighborhoods.find((item) => item.id_neighborhood === data.annotation?.id_neighborhood)
      : null;
    const citizen = data.annotation?.id_citizen != null
      ? this.annotationCitizens.find((item) => item.id_citizen === data.annotation?.id_citizen)
      : null;

    return {
      idAnnotation: annotationId,
      markerType: markerConfig.markerType,
      markerIcon: this.getAnnotationMarkerIconGlyph(markerConfig.icon),
      markerColor: markerConfig.color,
      title: `Anotación #${annotationId}`,
      categoryName: primaryCategory?.name ?? null,
      subcategoryName: subcategory?.name ?? null,
      categories: data.categories.map((category) => category.name),
      description: data.annotation?.description?.trim() || 'Sin descripción registrada.',
      status: data.annotation?.status ?? null,
      registrationDate: data.annotation?.registration_date
        ? new Date(data.annotation.registration_date).toLocaleString()
        : null,
      address: citizen?.address ?? null,
      neighborhoodName: neighborhood?.name ?? null,
      communeName: null,
      cityName: null,
      latitude: point.latitude,
      longitude: point.longitude,
      createdByName: citizen?.name ?? null,
      createdByType: citizen ? 'Ciudadano' : null,
      averageRating: data.averageVotes,
      votesCount: data.votesCount,
      evidences: data.evidences
    };
  }

  private buildAnnotationPopupHtml(annotationId: number, point: Point, data: AnnotationPopupData): string {
    const description = data.annotation?.description?.trim() || 'Sin descripción registrada.';
    const registrationDate = data.annotation?.registration_date
      ? new Date(data.annotation.registration_date).toLocaleString()
      : 'Sin fecha';
    const categoriesHtml = data.categories.length > 0
      ? data.categories.map((category) => category.name).join(', ')
      : 'Sin categorías';
    const votesHtml = data.averageVotes != null
      ? `${data.averageVotes.toFixed(1)} / 5 (${data.votesCount} voto${data.votesCount === 1 ? '' : 's'})`
      : 'Sin votos';
    const evidencesHtml = data.evidences.length > 0
      ? `<div style="display:grid;gap:0.35rem;">${data.evidences.map((evidence) => {
          const url = this.apiClient.imageUrl(evidence.file_url);
          const safeUrl = url.replace(/"/g, '&quot;');
          return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Evidencia #${evidence.id_evidence}</a>`;
        }).join('')}</div>`
      : 'Sin evidencias';

    return `
      <div style="min-width: 250px; display:grid; gap:0.45rem;">
        <strong>Anotación #${annotationId}</strong>
        <span><strong>Descripción:</strong> ${description}</span>
        <span><strong>Categorías:</strong> ${categoriesHtml}</span>
        <span><strong>Fecha:</strong> ${registrationDate}</span>
        <span><strong>Votación:</strong> ${votesHtml}</span>
        <span><strong>Ubicación:</strong> ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}</span>
        <span><strong>Evidencias:</strong></span>
        ${evidencesHtml}
      </div>
    `;
  }

  closeAnnotationDetailPanel(): void {
    this.selectedAnnotationDetail = null;
    this.triggerRealtimeViewSync();
  }

  readonly resolveEvidenceImageUrl = (path: string): string => this.apiClient.imageUrl(path);

  private focusOnNeighborhood(neighborhoodId: number | null): void {
    // Sincroniza selección lógica con el barrio enfocado (incluye click sobre polígonos).
    this.selectedNeighborhoodId = neighborhoodId;

    if (neighborhoodId == null) {
      this.map.setView([5.074, -75.515], 14);
      this.selectedNeighborhoodLayer.clearLayers();
      return;
    }

    const polygonPoints = this.points
      .filter(p => p.point_type === 'polygon' && p.id_neighborhood === neighborhoodId)
      .slice();

    const coordinates = this.buildNeighborhoodPolygonCoordinates(polygonPoints);
    if (coordinates.length >= 3) {
      this.map.fitBounds(coordinates as L.LatLngBoundsExpression);
      this.selectedNeighborhoodLayer.clearLayers();

      const highlight = L.polygon(coordinates, {
        color: '#ef233c',
        weight: 3,
        fillOpacity: 0.04
      });

      this.selectedNeighborhoodLayer.addLayer(highlight);
      return;
    }

    const shape = NEIGHBORHOOD_SHAPES.find((item) => item.id === neighborhoodId);

    if (!shape) return;

    this.map.fitBounds(shape.coordinates as L.LatLngBoundsExpression);
    this.selectedNeighborhoodLayer.clearLayers();

    const highlight = L.polygon(shape.coordinates, {
      color: '#ef233c',
      weight: 3,
      fillOpacity: 0.04
    });

    this.selectedNeighborhoodLayer.addLayer(highlight);
  }

  private buildNeighborhoodPolygonCoordinates(points: Point[]): L.LatLngTuple[] {
    const valid = points.filter(
      (point) =>
        point.latitude != null &&
        point.longitude != null &&
        Number.isFinite(point.latitude) &&
        Number.isFinite(point.longitude)
    );

    if (valid.length < 3) {
      return valid.map((point) => [point.latitude, point.longitude] as L.LatLngTuple);
    }

    const hasCompleteOrder = valid.every((point) => point.order != null);
    const uniqueOrderCount = new Set(valid.map((point) => point.order)).size;

    if (hasCompleteOrder && uniqueOrderCount === valid.length) {
      return valid
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((point) => [point.latitude, point.longitude] as L.LatLngTuple);
    }

    const centroid = valid.reduce(
      (acc, point) => ({ lat: acc.lat + point.latitude, lng: acc.lng + point.longitude }),
      { lat: 0, lng: 0 }
    );
    const centerLat = centroid.lat / valid.length;
    const centerLng = centroid.lng / valid.length;

    return valid
      .slice()
      .sort((a, b) => {
        const angleA = Math.atan2(a.latitude - centerLat, a.longitude - centerLng);
        const angleB = Math.atan2(b.latitude - centerLat, b.longitude - centerLng);
        return angleA - angleB;
      })
      .map((point) => [point.latitude, point.longitude] as L.LatLngTuple);
  }

  private extractErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const err = error as Record<string, any>;
    if (typeof err['message'] === 'string' && err['message'] && err['message'] !== 'Unknown Error') {
      return err['message'];
    }

    const body = err['error'];
    if (body && typeof body === 'object') {
      const message = (body as Record<string, unknown>)['message'] ?? (body as Record<string, unknown>)['error'];
      return typeof message === 'string' ? message : '';
    }

    return typeof body === 'string' ? body : '';
  }

  private updatePointLocation(point: Point, latLng: L.LatLng): void {
    point.latitude = latLng.lat;
    point.longitude = latLng.lng;
    this.pointService.update(point.id_point, { latitude: latLng.lat, longitude: latLng.lng }).subscribe();
  }

  private loadOfficialsBaseData(): void {
    combineLatest([
      this.officialService.listCollection(),
      this.entityService.listCollection()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([officialCollection, entityCollection]) => {
        this.applyEntityBaseState(entityCollection.items);
        this.applyOfficialsBaseState(officialCollection.items);
      });
  }

  private startOfficialsFallbackPolling(): void {
    this.officialsPollingSubscription?.unsubscribe();
    this.officialsPollingSubscription = combineLatest([
      this.officialService.listCollection(),
      this.entityService.listCollection()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([officialCollection, entityCollection]) => {
          this.applyEntityBaseState(entityCollection.items);
          this.applyOfficialsBaseState(officialCollection.items);
        }
      });

    const pollingMs = 15000;
    const schedule = window.setInterval(() => {
      combineLatest([
        this.officialService.listCollection(),
        this.entityService.listCollection()
      ])
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: ([officialCollection, entityCollection]) => {
            this.applyEntityBaseState(entityCollection.items);
            this.applyOfficialsBaseState(officialCollection.items);
            this.auditRealtimeSync('polling-refresh');
          }
        });
    }, pollingMs);

    this.officialsPollingSubscription.add(() => window.clearInterval(schedule));
  }

  private applyOfficialsBaseState(officials: Official[]): void {
    const incomingOfficialIds = new Set<number>();
    this.officialsById.clear();

    for (const official of officials) {
      incomingOfficialIds.add(official.id_official);
      this.officialsById.set(official.id_official, official);
      if (!this.isOfficialStatusActive(official.status)) {
        this.latestTrackingByOfficial.delete(official.id_official);
        this.removeOfficialMarker(official.id_official);
        continue;
      }

      const coords = this.resolveOfficialDisplayCoords(official);
      if (!coords) {
        continue;
      }

      const snapshot: OfficialTrackingSnapshot = {
        id_official: official.id_official,
        id_entity: official.id_entity,
        latitude: coords[0],
        longitude: coords[1],
        last_gps_update: official.last_gps_update ?? null,
        lastUpdate: official.last_gps_update ?? null,
        gps_active: official.gps_active
      };
      this.latestTrackingByOfficial.set(
        official.id_official,
        this.mergeTrackingSnapshot(official.id_official, snapshot, 'rest')
      );
    }

    for (const trackedId of Array.from(this.latestTrackingByOfficial.keys())) {
      if (!incomingOfficialIds.has(trackedId)) {
        this.latestTrackingByOfficial.delete(trackedId);
        this.removeOfficialMarker(trackedId);
      }
    }

    if (this.showRealtimeOfficials) {
      this.rebuildVisibleTrackingMarkers();
    }
    this.refreshEntityMarkers();
    this.triggerRealtimeViewSync();
  }

  private resolveOfficialDisplayCoords(official: Official): L.LatLngTuple | null {
    if (
      typeof official.last_latitude === 'number'
      && typeof official.last_longitude === 'number'
      && Number.isFinite(official.last_latitude)
      && Number.isFinite(official.last_longitude)
    ) {
      return [official.last_latitude, official.last_longitude];
    }

    const entity = this.mapEntities.find((item) => item.id_entity === official.id_entity);
    if (entity) {
      const fromEntityCache = this.getEntityCoordsFromCache(entity);
      if (fromEntityCache) {
        return fromEntityCache;
      }
    }

    const fromOtherOfficials = this.getEntityCoordsFromOfficials(official.id_entity);
    if (fromOtherOfficials) {
      return fromOtherOfficials;
    }

    return this.getEntityFallbackCoords(official.id_entity);
  }

  private applyEntityBaseState(entities: Entity[]): void {
    // Defensive guard: do not wipe already-rendered entities
    // when backend temporarily responds empty during polling/reconnect.
    if (entities.length === 0 && this.mapEntities.length > 0) {
      return;
    }

    this.trackingEntities = entities;
    this.mapEntities = entities;
    this.refreshEntityMarkers();
  }

  private initializeTracking(): void {
    this.trackingService
      .listenTracking()
      .pipe(takeUntil(this.destroy$))
      .subscribe((payload) => {
        this.ngZone.run(() => {
          this.applyTrackingPayload(payload);
        });
      });

    this.trackingService
      .connectionStatus$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((status) => {
        if (status === 'error' || status === 'disconnected') {
          this.toastService.warning(
            'Seguimiento en tiempo real temporalmente no disponible',
            'Reintentando reconexión automática.'
          );
        }
      });
  }

  private applyTrackingPayload(payload: TrackingPayload): void {
    if (!payload || !Array.isArray(payload.officials) || payload.officials.length === 0) {
      return;
    }

    for (const officialTracking of payload.officials) {
      const normalized: OfficialTrackingSnapshot = {
        ...officialTracking,
        lastUpdate: officialTracking.lastUpdate ?? officialTracking.last_gps_update ?? new Date().toISOString(),
        last_gps_update: officialTracking.last_gps_update ?? officialTracking.lastUpdate ?? new Date().toISOString()
      };
      const merged = this.mergeTrackingSnapshot(officialTracking.id_official, normalized, 'socket');
      this.latestTrackingByOfficial.set(officialTracking.id_official, merged);
      this.updateOfficialMarker(merged);
    }
    this.auditRealtimeSync('socket-update');
    this.refreshEntityMarkers();
    this.triggerRealtimeViewSync();
  }

  private startOfficialOfflineDetector(): void {
    if (this.officialOfflineIntervalId != null) return;
    this.officialOfflineIntervalId = setInterval(() => {
      this.ngZone.run(() => {
        const nowMs = Date.now();
        const staleMs = 30_000;
        let changed = false;
        for (const tracking of this.latestTrackingByOfficial.values()) {
          const previousState = this.resolveOfficialConnectionState(tracking);
          const ts = tracking.lastUpdate ?? tracking.last_gps_update;
          if (!ts) continue;
          const trackedAt = new Date(ts).getTime();
          if (!Number.isFinite(trackedAt)) continue;
          if ((nowMs - trackedAt) > staleMs && tracking.gps_active !== false) {
            tracking.gps_active = false;
            const nextState = this.resolveOfficialConnectionState(tracking);
            this.pushTrackingDebugEvent({
              ts: new Date().toISOString(),
              source: 'offline-detector',
              officialId: tracking.id_official,
              previousState,
              nextState,
              gps_active: typeof tracking.gps_active === 'boolean' ? tracking.gps_active : null,
              lastUpdate: tracking.lastUpdate ?? tracking.last_gps_update ?? null,
              markerType: this.getMarkerTypeByOfficialId(tracking.id_official),
              panelLabel: this.getPanelLabelByOfficialId(tracking.id_official)
            });
            changed = true;
          }
        }
        this.auditRealtimeSync('offline-detector');
        if (changed) {
          this.rebuildVisibleTrackingMarkers();
        }
      });
    }, 5_000);
  }

  private updateOfficialMarker(officialTracking: OfficialTracking): void;
  private updateOfficialMarker(
    official: Official,
    latitude: number,
    longitude: number,
    gps_active: boolean
  ): void;
  private updateOfficialMarker(
    officialOrTracking: Official | OfficialTracking,
    latitude?: number,
    longitude?: number,
    gps_active?: boolean
  ): void {
    if (typeof latitude === 'number' && typeof longitude === 'number' && typeof gps_active === 'boolean' && 'name' in officialOrTracking) {
      const official = officialOrTracking;
      const officialId = official.id_official;
      const adjustedCoords = this.getAdjustedOfficialCoords(officialId, official.id_entity, [latitude, longitude]);
      const entityName = this.trackingEntities.find((entity) => entity.id_entity === official.id_entity)?.name ?? `#${official.id_entity}`;
      const state = this.resolveOfficialConnectionState({
        id_official: official.id_official,
        id_entity: official.id_entity,
        latitude,
        longitude,
        gps_active
      });
      this.officialConnectionStateById.set(officialId, state);
      const gpsStatus = this.connectionStateLabel(state);
      const popupContent = `<strong>${official.name}</strong><br>Entidad: ${entityName}<br>Estado: ${gpsStatus}`;
      const existingMarker = this.officialMarkers.get(officialId);

      if (existingMarker) {
        existingMarker.setLatLng(adjustedCoords);
        existingMarker.setIcon(this.buildOfficialIcon(state));
        existingMarker.bindPopup(popupContent);
        return;
      }

      const marker = L.marker(adjustedCoords, {
        icon: this.buildOfficialIcon(state),
        draggable: false
      });
      marker.bindPopup(popupContent);
      this.officialMarkers.set(officialId, marker);
      marker.addTo(this.trackingLayer);
      return;
    }

    const officialTracking = officialOrTracking as OfficialTracking;
    const knownOfficial = this.officialsById.get(officialTracking.id_official);
    if (knownOfficial && !this.isOfficialStatusActive(knownOfficial.status)) {
      this.removeOfficialMarker(officialTracking.id_official);
      this.latestTrackingByOfficial.delete(officialTracking.id_official);
      this.updateNoOfficialsMessageState();
      return;
    }
    const entityId = officialTracking.id_entity ?? knownOfficial?.id_entity ?? null;

    if (knownOfficial && entityId !== null) {
      knownOfficial.id_entity = entityId;
    }

    const adjustedTrackingCoords = this.getAdjustedOfficialCoords(
      officialTracking.id_official,
      entityId,
      [officialTracking.latitude, officialTracking.longitude]
    );

    if (!this.shouldRenderOfficial(officialTracking)) {
      this.removeOfficialMarker(officialTracking.id_official);
      this.updateNoOfficialsMessageState();
      return;
    }

    const existingMarker = this.officialMarkers.get(officialTracking.id_official);
    const connectionState = this.resolveOfficialConnectionState(officialTracking);
    this.officialConnectionStateById.set(officialTracking.id_official, connectionState);

    if (existingMarker) {
      existingMarker.setLatLng(adjustedTrackingCoords);
      existingMarker.setIcon(this.buildOfficialIcon(connectionState));
      existingMarker.bindPopup(this.buildOfficialPopupContent(officialTracking, connectionState));
      this.updateNoOfficialsMessageState();
      return;
    }

    const marker = L.marker(adjustedTrackingCoords, {
      icon: this.buildOfficialIcon(connectionState),
      draggable: false
    });
    marker.bindPopup(this.buildOfficialPopupContent(officialTracking, connectionState));
    this.officialMarkers.set(officialTracking.id_official, marker);
    marker.addTo(this.trackingLayer);
    this.updateNoOfficialsMessageState();
  }

  private buildOfficialIcon(connectionState: OfficialConnectionState): L.DivIcon {
    const markerDotColor = connectionState === 'ONLINE'
      ? '#22c55e'
      : connectionState === 'LAST_KNOWN_POSITION'
        ? '#2563eb'
        : '#94a3b8';
    return L.divIcon({
      className: '',
      html: `
        <div style="
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: #dbeafe;
          border: 3px solid #3b82f6;
          box-shadow:
            0 0 0 5px rgba(255,255,255,.95),
            0 8px 18px rgba(15,35,95,.2);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:18px;
          cursor:pointer;
          user-select:none;
          position: relative;
          color: #1d4ed8;
          transition: all .25s ease;
        ">
          <span style="font-weight:800;">👤</span>
          <span style="
            position:absolute;
            right:-1px;
            bottom:-1px;
            width:13px;
            height:13px;
            border-radius:999px;
            border:2px solid #fff;
            background:${markerDotColor};
          "></span>
        </div>
      `,
      iconSize: [54, 54],
      iconAnchor: [27, 27],
      popupAnchor: [0, -30]
    });
  }

  private buildOfficialPopupContent(
    officialTracking: OfficialTracking,
    connectionState: OfficialConnectionState = this.getOfficialConnectionStateForUi(officialTracking.id_official)
  ): string {
    const knownOfficial = this.officialsById.get(officialTracking.id_official);
    const entityId = officialTracking.id_entity ?? knownOfficial?.id_entity ?? null;
    const entityName = entityId != null
      ? (this.trackingEntities.find((entity) => entity.id_entity === entityId)?.name ?? `#${entityId}`)
      : 'Sin entidad';
    const lastUpdate = officialTracking.last_gps_update
      ? new Date(officialTracking.last_gps_update).toLocaleString()
      : 'Sin dato';
    const gpsStatus = this.connectionStateLabel(connectionState);
    return `<strong>${knownOfficial?.name ?? `Funcionario #${officialTracking.id_official}`}</strong><br>`
      + `Correo: ${knownOfficial?.email ?? 'Sin dato'}<br>`
      + `Teléfono: ${knownOfficial?.phone ?? 'Sin dato'}<br>`
      + `Rol: ${knownOfficial?.role ?? 'Sin dato'}<br>`
      + `Entidad: ${entityName}<br>`
      + `Última actualización: ${lastUpdate}<br>`
      + `Estado GPS: ${gpsStatus}`;
  }

  private getAdjustedOfficialCoords(
    officialId: number,
    entityId: number | null,
    coords: L.LatLngTuple
  ): L.LatLngTuple {
    if (entityId == null) return coords;
    const entityCoords = this.renderedEntityCoordsById.get(entityId);
    if (!entityCoords) return coords;

    const overlapThreshold = 0.00002;
    if (
      Math.abs(coords[0] - entityCoords[0]) > overlapThreshold
      || Math.abs(coords[1] - entityCoords[1]) > overlapThreshold
    ) {
      return coords;
    }

    const angleDeg = (officialId * 53) % 360;
    const angleRad = angleDeg * (Math.PI / 180);
    const radius = 0.00022;
    return [
      entityCoords[0] + (Math.sin(angleRad) * radius),
      entityCoords[1] + (Math.cos(angleRad) * radius)
    ];
  }

  private isOfficialVisibleForFilters(idOfficial: number, entityId: number | null): boolean {
    if (this.selectedEntityFilter == null) return true;
    if (entityId != null) return entityId === this.selectedEntityFilter;
    const knownOfficial = this.officialsById.get(idOfficial);
    return knownOfficial?.id_entity === this.selectedEntityFilter;
  }

  private removeOfficialMarker(idOfficial: number): void {
    const marker = this.officialMarkers.get(idOfficial);
    if (marker) {
      this.trackingLayer.removeLayer(marker);
      this.officialMarkers.delete(idOfficial);
    }
    this.officialConnectionStateById.delete(idOfficial);
    this.updateNoOfficialsMessageState();
  }

  private rebuildVisibleTrackingMarkers(): void {
    this.trackingLayer.clearLayers();
    this.officialMarkers.clear();
    this.officialConnectionStateById.clear();

    if (!this.showRealtimeOfficials) {
      this.showNoOfficialsForSelectedEntity = false;
      return;
    }

    for (const tracking of this.latestTrackingByOfficial.values()) {
      this.updateOfficialMarker(tracking);
    }
    this.updateNoOfficialsMessageState();
    this.auditRealtimeSync('rebuild-visible-markers');
    this.triggerRealtimeViewSync();
  }

  private isOfficialStatusActive(status: unknown): boolean {
    if (typeof status !== 'string') return false;
    const normalized = status.trim().toLowerCase();
    return normalized === 'active' || normalized === 'activo' || normalized === 'activa';
  }

  private isEntityStatusActive(status: unknown): boolean {
    if (typeof status !== 'string') return false;
    const normalized = status.trim().toLowerCase();
    return normalized === 'active' || normalized === 'activo' || normalized === 'activa';
  }

  isOfficialGpsActive(officialTracking: OfficialTracking): boolean {
    return this.getOfficialConnectionStateForUi(officialTracking.id_official) === 'ONLINE';
  }

  private resolveOfficialConnectionState(officialTracking: OfficialTracking): OfficialConnectionState {
    const knownOfficial = this.officialsById.get(officialTracking.id_official);
    if (knownOfficial && !this.isOfficialStatusActive(knownOfficial.status)) {
      return 'OFFLINE';
    }

    const gpsActive = officialTracking.gps_active === true;
    const hasKnownPosition = Number.isFinite(officialTracking.latitude) && Number.isFinite(officialTracking.longitude);

    if (gpsActive) {
      return 'ONLINE';
    }

    if (hasKnownPosition) {
      return 'LAST_KNOWN_POSITION';
    }

    return 'OFFLINE';
  }

  private connectionStateLabel(state: OfficialConnectionState): string {
    if (state === 'ONLINE') return 'En línea';
    if (state === 'LAST_KNOWN_POSITION') return 'Última posición conocida';
    return 'Sin conexión';
  }

  getOfficialConnectionStateLabel(officialTracking: OfficialTracking): string {
    return this.connectionStateLabel(this.resolveOfficialConnectionState(officialTracking));
  }

  getOfficialPanelConnectionLabel(officialTracking: OfficialTracking): string {
    return this.getOfficialConnectionStateForUi(officialTracking.id_official) === 'ONLINE'
      ? 'En línea'
      : 'Sin conexión';
  }

  isOfficialPanelOffline(officialTracking: OfficialTracking): boolean {
    return this.getOfficialConnectionStateForUi(officialTracking.id_official) === 'OFFLINE';
  }

  isOfficialPanelLastKnown(officialTracking: OfficialTracking): boolean {
    return this.getOfficialConnectionStateForUi(officialTracking.id_official) === 'LAST_KNOWN_POSITION';
  }

  private getOfficialConnectionStateForUi(idOfficial: number): OfficialConnectionState {
    const renderedMarkerState = this.getMarkerConnectionStateByOfficialId(idOfficial);
    if (
      renderedMarkerState === 'ONLINE'
      || renderedMarkerState === 'OFFLINE'
      || renderedMarkerState === 'LAST_KNOWN_POSITION'
    ) {
      return renderedMarkerState;
    }
    return this.officialConnectionStateById.get(idOfficial) ?? 'OFFLINE';
  }

  private shouldRenderOfficial(officialTracking: OfficialTracking): boolean {
    if (!this.showRealtimeOfficials) {
      return false;
    }

    const knownOfficial = this.officialsById.get(officialTracking.id_official);
    if (knownOfficial && !this.isOfficialStatusActive(knownOfficial.status)) {
      return false;
    }

    const entityId = officialTracking.id_entity ?? knownOfficial?.id_entity ?? null;
    return this.isOfficialVisibleForFilters(officialTracking.id_official, entityId);
  }

  private mergeTrackingSnapshot(
    idOfficial: number,
    incoming: OfficialTrackingSnapshot,
    source: TrackingSource
  ): OfficialTrackingSnapshot {
    const current = this.latestTrackingByOfficial.get(idOfficial);
    if (!current) {
      this.pushTrackingDebugEvent({
        ts: new Date().toISOString(),
        source: source === 'socket' ? 'merge-tracking-snapshot:socket' : 'merge-tracking-snapshot:rest',
        officialId: idOfficial,
        previousState: 'UNKNOWN',
        nextState: this.resolveOfficialConnectionState(incoming),
        gps_active: typeof incoming.gps_active === 'boolean' ? incoming.gps_active : null,
        lastUpdate: incoming.lastUpdate ?? incoming.last_gps_update ?? null,
        markerType: this.getMarkerTypeByOfficialId(idOfficial),
        panelLabel: this.getPanelLabelByOfficialId(idOfficial)
      });
      this.auditRealtimeSync(source === 'socket' ? 'merge-tracking-snapshot:socket' : 'merge-tracking-snapshot:rest');
      return incoming;
    }

    const incomingTs = this.toTimestampMs(incoming.lastUpdate ?? incoming.last_gps_update);
    const currentTs = this.toTimestampMs(current.lastUpdate ?? current.last_gps_update);
    const incomingWins = incomingTs > currentTs || (incomingTs === currentTs && source === 'socket');
    const primary = incomingWins ? incoming : current;
    const secondary = incomingWins ? current : incoming;

    const merged = {
      ...secondary,
      ...primary,
      id_official: primary.id_official ?? secondary.id_official ?? idOfficial,
      id_entity: primary.id_entity ?? secondary.id_entity ?? null,
      latitude: this.pickFiniteNumber(primary.latitude, secondary.latitude, 0),
      longitude: this.pickFiniteNumber(primary.longitude, secondary.longitude, 0),
      lastUpdate: primary.lastUpdate ?? primary.last_gps_update ?? secondary.lastUpdate ?? secondary.last_gps_update ?? null,
      last_gps_update: primary.last_gps_update ?? primary.lastUpdate ?? secondary.last_gps_update ?? secondary.lastUpdate ?? null,
      gps_active: this.pickBoolean(primary.gps_active, secondary.gps_active)
    };
    this.pushTrackingDebugEvent({
      ts: new Date().toISOString(),
      source: source === 'socket' ? 'merge-tracking-snapshot:socket' : 'merge-tracking-snapshot:rest',
      officialId: idOfficial,
      previousState: this.resolveOfficialConnectionState(current),
      nextState: this.resolveOfficialConnectionState(merged),
      gps_active: typeof merged.gps_active === 'boolean' ? merged.gps_active : null,
      lastUpdate: merged.lastUpdate ?? merged.last_gps_update ?? null,
      markerType: this.getMarkerTypeByOfficialId(idOfficial),
      panelLabel: this.getPanelLabelByOfficialId(idOfficial)
    });
    this.auditRealtimeSync(source === 'socket' ? 'merge-tracking-snapshot:socket' : 'merge-tracking-snapshot:rest');
    return merged;
  }

  private pushTrackingDebugEvent(event: TrackingDebugEvent): void {
    this.trackingDebugBuffer.push(event);
    if (this.trackingDebugBuffer.length > this.trackingDebugBufferMaxSize) {
      this.trackingDebugBuffer.splice(0, this.trackingDebugBuffer.length - this.trackingDebugBufferMaxSize);
    }
    (window as unknown as { trackingDebugBuffer?: TrackingDebugEvent[] }).trackingDebugBuffer = [...this.trackingDebugBuffer];
  }

  private getMarkerConnectionStateByOfficialId(idOfficial: number): OfficialConnectionState | 'MISSING_MARKER' | 'UNKNOWN' {
    const marker = this.officialMarkers.get(idOfficial);
    if (!marker) return 'MISSING_MARKER';
    const html = marker.options?.icon && 'options' in marker.options.icon
      ? String((marker.options.icon as L.DivIcon).options?.html ?? '').toLowerCase()
      : '';
    if (html.includes('#22c55e')) return 'ONLINE';
    if (html.includes('#2563eb')) return 'LAST_KNOWN_POSITION';
    if (html.includes('#94a3b8')) return 'OFFLINE';
    return 'UNKNOWN';
  }

  private getMarkerTypeByOfficialId(idOfficial: number): TrackingDebugEvent['markerType'] {
    const state = this.getMarkerConnectionStateByOfficialId(idOfficial);
    if (state === 'ONLINE') return 'dot-green';
    if (state === 'LAST_KNOWN_POSITION') return 'dot-blue';
    if (state === 'OFFLINE') return 'dot-gray';
    if (state === 'MISSING_MARKER') return 'missing-marker';
    return 'unknown';
  }

  private getPanelLabelByOfficialId(idOfficial: number): string | null {
    const panelItem = this.getRealtimePanelItems().find((item) => item.id_official === idOfficial);
    if (!panelItem) return null;
    return this.getOfficialPanelConnectionLabel(panelItem);
  }

  private auditRealtimeSync(source: TrackingDebugSource): void {
    const timestamp = new Date().toISOString();
    const panelItems = this.getRealtimePanelItems();
    const panelById = new Map<number, OfficialTrackingSnapshot>(panelItems.map((item) => [item.id_official, item]));
    const trackedIds = new Set<number>([
      ...Array.from(this.latestTrackingByOfficial.keys()),
      ...Array.from(this.officialMarkers.keys()),
      ...panelItems.map((item) => item.id_official)
    ]);

    const rows = Array.from(trackedIds).map((idOfficial) => {
      const tracking = this.latestTrackingByOfficial.get(idOfficial);
      const panelItem = panelById.get(idOfficial);
      const resolvedState = tracking ? this.resolveOfficialConnectionState(tracking) : 'UNKNOWN';
      const mapState = this.getMarkerConnectionStateByOfficialId(idOfficial);
      const panelState = panelItem ? this.resolveOfficialConnectionState(panelItem) : 'UNKNOWN';
      const panelLabel = panelItem ? this.getOfficialPanelConnectionLabel(panelItem) : null;
      return {
        officialId: idOfficial,
        name: this.getOfficialDisplayName(idOfficial),
        mapState,
        panelState,
        resolvedState,
        timestamp,
        eventSource: source,
        mapMarkerType: this.getMarkerTypeByOfficialId(idOfficial),
        panelConnectionState: panelState,
        gps_active: tracking?.gps_active ?? null,
        status: this.officialsById.get(idOfficial)?.status ?? null,
        latitude: tracking?.latitude ?? null,
        longitude: tracking?.longitude ?? null,
        last_gps_update: tracking?.last_gps_update ?? null,
        lastUpdate: tracking?.lastUpdate ?? null,
        resolveOfficialConnectionStateResult: resolvedState,
        isOnlineForMap: mapState === 'ONLINE',
        isOnlineForPanel: panelState === 'ONLINE',
        panelLabel
      };
    });

    const stateMismatch = rows
      .filter((row) => (row.mapState === 'OFFLINE' || row.mapState === 'LAST_KNOWN_POSITION') && row.panelState === 'ONLINE')
      .map((row) => ({
        officialId: row.officialId,
        name: row.name,
        mapState: row.mapState,
        panelState: row.panelState,
        resolvedState: row.resolvedState,
        timestamp: row.timestamp,
        source: row.eventSource,
        gps_active: row.gps_active,
        status: row.status,
        lastUpdate: row.lastUpdate ?? row.last_gps_update ?? null,
        reason: 'map marker visual state is non-online while panel state is online'
      }));

    console.debug('[RealtimeSyncAudit]', { source, timestamp, rows, stateMismatch });

    if (stateMismatch.length > 0) {
      for (const mismatch of stateMismatch) {
        console.warn('[RealtimeStateMismatch]', mismatch);
      }
      console.warn('[RealtimeStateMismatchBufferDump]', [...this.trackingDebugBuffer]);
    }
  }

  private triggerRealtimeViewSync(): void {
    if (this.destroy$.isStopped) return;
    queueMicrotask(() => {
      if (this.destroy$.isStopped) return;
      try {
        this.changeDetectorRef.detectChanges();
      } catch {
        // Best-effort UI sync for realtime updates.
      }
    });
  }

  private toTimestampMs(value: string | null | undefined): number {
    if (!value) return 0;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
  }

  private pickFiniteNumber(primary: number | undefined, fallback: number | undefined, defaultValue: number): number {
    if (typeof primary === 'number' && Number.isFinite(primary)) return primary;
    if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
    return defaultValue;
  }

  private pickBoolean(primary: boolean | undefined, fallback: boolean | undefined): boolean | undefined {
    if (typeof primary === 'boolean') return primary;
    if (typeof fallback === 'boolean') return fallback;
    return undefined;
  }

  private updateNoOfficialsMessageState(): void {
    if (!this.showRealtimeOfficials || this.selectedEntityFilter == null) {
      this.showNoOfficialsForSelectedEntity = false;
      return;
    }

    this.showNoOfficialsForSelectedEntity = this.officialMarkers.size === 0;
  }
}
