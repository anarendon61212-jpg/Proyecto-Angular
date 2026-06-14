import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { combineLatest, forkJoin, Observable, of, Subject, takeUntil } from 'rxjs';
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
import { FileUploadComponent } from '../../shared/components/file-upload/file-upload.component';
import { ToastService } from '../../shared/services/toast.service';
import { TrackingService } from '../../core/services/tracking.service';

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FileUploadComponent],
  template: `
    <div class="map-page">
      <aside class="map-sidebar app-card">
        <div class="panel-section">
          <h2>Territorio</h2>
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
          <h3>Funcionarios en tiempo real</h3>
          <label>
            <input
              type="checkbox"
              [checked]="showRealtimeOfficials"
              (change)="toggleRealtimeOfficials($event.target.checked)"
            />
            Mostrar funcionarios en tiempo real
          </label>
          <label for="entity-filter-select">Entidad</label>
          <select id="entity-filter-select" [value]="selectedEntityFilter ?? ''" (change)="onEntityFilterSelected($event)">
            <option value="">Todas las entidades</option>
            <option *ngFor="let entity of trackingEntities" [value]="entity.id_entity">
              {{ entity.name }}
            </option>
          </select>
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
          <h3>Mapa</h3>
          <button type="button" class="app-button app-button--secondary" (click)="setBaseLayer('streets')">Calles</button>
          <button type="button" class="app-button app-button--secondary" (click)="setBaseLayer('topographic')">Topográfico</button>
        </div>
      </aside>

      <section class="map-view app-card">
        <div class="map-header">
          <div>
            <strong>Mapa territorial</strong>
            <p>Explora barrios, polígonos y puntos geoespaciales.</p>
          </div>
          <div class="map-legend">
            <span class="legend-item legend-item--neighborhood">Polígonos</span>
            <span class="legend-item legend-item--point">Puntos editables</span>
            <span class="legend-item legend-item--annotation" *ngIf="isAnnotationMode">Modo anotación activo</span>
          </div>
        </div>

        <p class="map-info-message" *ngIf="showPoints && pointFilters.annotation && !hasAnnotationPoints">
          No existen anotaciones registradas.
        </p>
        <p class="map-info-message" *ngIf="showPoints && pointFilters.annotation && hasAnnotationPoints && visibleAnnotationCount === 0">
          No hay anotaciones para los filtros seleccionados.
        </p>

        <div #mapContainer class="leaflet-container" [class.annotation-cursor]="isAnnotationMode"></div>
      </section>
    </div>

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
    `.map-page { display: grid; grid-template-columns: 320px 1fr; gap: 1rem; margin: 0; padding: 0; }`,
    `.map-sidebar { display: grid; gap: 1rem; padding: 1.25rem; }`,
    `.panel-section { display: grid; gap: 0.75rem; }`,
    `.panel-section h3 { margin: 0; font-size: 0.95rem; }`,
    `.panel-section label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; color: var(--color-ink); }`,
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
    `.map-view { display: grid; gap: 1rem; min-height: calc(100vh - 3rem); padding: 1.25rem; }`,
    `.map-header { align-items: center; display: flex; justify-content: space-between; gap: 1rem; }`,
    `.map-legend { display: flex; gap: 0.75rem; flex-wrap: wrap; }`,
    `.legend-item { align-items: center; border-radius: 999px; display: inline-flex; gap: 0.5rem; font-size: 0.9rem; padding: 0.6rem 0.85rem; }`,
    `.legend-item--neighborhood { background: rgba(20, 89, 245, 0.1); color: var(--color-primary); }`,
    `.legend-item--point { background: rgba(239, 35, 60, 0.1); color: var(--color-danger); }`,
    `.legend-item--annotation { background: rgba(255, 165, 0, 0.15); color: #b45309; font-weight: 600; }`,
    `.leaflet-container { min-height: 640px; width: 100%; border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }`,
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
    `@media (max-width: 980px) { .map-page { grid-template-columns: 1fr; } }`,

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
  private selectedNeighborhoodLayer = L.layerGroup();
  private editingLayer = L.layerGroup();
  private trackingLayer = L.layerGroup();
  private officialsById = new Map<number, Official>();
  private officialMarkers = new Map<number, L.Marker>();
  private simulatedOfficials = new Map<number, {
    latitude: number;
    longitude: number;
    gps_active: boolean;
  }>();
  private polygonPoints: L.LatLng[] = [];
  private polygonMarkers: L.Marker[] = [];
  private polygonLine: L.Polyline | null = null;
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
  selectedEntityFilter: number | null = null;
  showRealtimeOfficials = true;
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
    this.initializeMap();
    this.loadTerritorialData();
    this.loadAnnotationFormData();
    this.loadOfficialsBaseData();
    this.initializeTracking();
    setTimeout(() => {
      this.initializeDemoTracking();
    }, 1500);

    this.editingLayer.addTo(this.map);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Base map ──────────────────────────────────────────────────────────────

  setBaseLayer(layerKey: 'streets' | 'topographic'): void {
    if (!this.map || !this.baseLayers) return;
    Object.values(this.baseLayers).forEach((layer) => this.map.removeLayer(layer));
    this.baseLayers[layerKey].addTo(this.map);
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
    if (!enabled) {
      this.trackingLayer.clearLayers();
      this.officialMarkers.clear();
      return;
    }
    this.rebuildVisibleTrackingMarkers();
  }

  onEntityFilterSelected(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    this.selectedEntityFilter = value ? Number(value) : null;
    this.rebuildVisibleTrackingMarkers();
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

  private getAnnotationMarkerStyle(annotationId: number | null | undefined): { background: string; shadow: string } {
    if (annotationId == null) return this.defaultAnnotationMarkerStyle;
    const categoryIds = this.annotationCategoryMap.get(annotationId);
    if (!categoryIds || categoryIds.size === 0) return this.defaultAnnotationMarkerStyle;

    for (const selectedCategory of categoryIds) {
      let current = this.categoriesById.get(selectedCategory);
      while (current) {
        if (current.id_parent_category == null) {
          return this.categoryColorMap.get(current.id_category) ?? this.defaultAnnotationMarkerStyle;
        }
        current = this.categoriesById.get(current.id_parent_category);
      }
    }
    return this.defaultAnnotationMarkerStyle;
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
    this.pointLayer.addTo(this.map);
    this.selectedNeighborhoodLayer.addTo(this.map);
    this.trackingLayer.addTo(this.map);
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
      this.loadCategoryFilterData()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([neighborhoodCollection, pointCollection, annotationCollection, categoryFilterData]) => {
        this.neighborhoods = neighborhoodCollection.items;
        this.points = pointCollection.items;
        this.annotationDescriptionMap = new Map(
          annotationCollection.items.map((annotation) => [annotation.id_annotation, annotation.description ?? ''])
        );
        this.initializeCategoryFilterState(categoryFilterData.categories, categoryFilterData.annotationCategories);
        this.refreshMapLayers();
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

        const markerStyle = this.getAnnotationMarkerStyle(point.id_annotation);
        // Annotation markers → dedicated annotationLayer with amber icon
        const marker = L.marker([point.latitude, point.longitude], {
          icon: L.divIcon({
            className: 'map-annotation-marker',
            html: `<div style="width: 20px; height: 20px; border: 2px solid #fff; border-radius: 50%; background: ${markerStyle.background}; box-shadow: 0 0 0 5px ${markerStyle.shadow};"></div>`
          }),
          draggable: false
        });
        marker.on('click', () => {
          if (point.id_annotation != null) {
            this.openAnnotationPopup(marker, point.id_annotation, point);
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

  private openAnnotationPopup(marker: L.Marker, annotationId: number, point: Point): void {
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

        marker.setPopupContent(this.buildAnnotationPopupHtml(annotationId, point, popupData));
        marker.openPopup();
      });
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
        this.trackingEntities = entityCollection.items;
        this.officialsById.clear();
        for (const official of officialCollection.items) {
          this.officialsById.set(official.id_official, official);
        }
      });
  }

  private initializeDemoTracking(): void {
    for (const official of this.officialsById.values()) {
      const latitude = 5.0689 + ((Math.random() - 0.5) * 0.02);
      const longitude = -75.5174 + ((Math.random() - 0.5) * 0.02);
      const gps_active = Math.random() > 0.2;

      this.simulatedOfficials.set(official.id_official, {
        latitude,
        longitude,
        gps_active
      });

      this.updateOfficialMarker(official, latitude, longitude, gps_active);
    }
  }

  private initializeTracking(): void {
    this.trackingService
      .listenTracking()
      .pipe(takeUntil(this.destroy$))
      .subscribe((payload) => {
        this.applyTrackingPayload(payload);
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
      this.updateOfficialMarker(officialTracking);
    }
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
      const entityName = this.trackingEntities.find((entity) => entity.id_entity === official.id_entity)?.name ?? `#${official.id_entity}`;
      const gpsStatus = gps_active ? 'GPS activo' : 'Sin conexión';
      const popupContent = `<strong>${official.name}</strong><br>Entidad: ${entityName}<br>Estado: ${gpsStatus}`;
      const existingMarker = this.officialMarkers.get(officialId);

      if (existingMarker) {
        existingMarker.setLatLng([latitude, longitude]);
        existingMarker.setIcon(this.buildOfficialIcon(gps_active));
        existingMarker.bindPopup(popupContent);
        return;
      }

      const marker = L.marker([latitude, longitude], {
        icon: this.buildOfficialIcon(gps_active),
        draggable: false
      });
      marker.bindPopup(popupContent);
      this.officialMarkers.set(officialId, marker);
      marker.addTo(this.trackingLayer);
      return;
    }

    const officialTracking = officialOrTracking as OfficialTracking;
    const knownOfficial = this.officialsById.get(officialTracking.id_official);
    const entityId = officialTracking.id_entity ?? knownOfficial?.id_entity ?? null;

    if (knownOfficial && entityId !== null) {
      knownOfficial.id_entity = entityId;
    }

    if (!this.showRealtimeOfficials || !this.isOfficialVisibleForFilters(officialTracking.id_official, entityId)) {
      this.removeOfficialMarker(officialTracking.id_official);
      return;
    }

    const existingMarker = this.officialMarkers.get(officialTracking.id_official);

    if (existingMarker) {
      existingMarker.setLatLng([officialTracking.latitude, officialTracking.longitude]);
      existingMarker.setIcon(this.buildOfficialIcon(officialTracking.gps_active !== false));
      existingMarker.bindPopup(this.buildOfficialPopupContent(officialTracking));
      return;
    }

    const marker = L.marker([officialTracking.latitude, officialTracking.longitude], {
      icon: this.buildOfficialIcon(officialTracking.gps_active !== false),
      draggable: false
    });
    marker.bindPopup(this.buildOfficialPopupContent(officialTracking));
    this.officialMarkers.set(officialTracking.id_official, marker);
    marker.addTo(this.trackingLayer);
  }

  private buildOfficialIcon(gps_active: boolean): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `
        <div style="
          width: 62px;
          height: 62px;
          border-radius: 50%;
          background:
            ${gps_active ? '#00ff2a' : '#9ca3af'};
          border: 4px solid white;
          box-shadow:
            0 0 0 12px rgba(0,255,0,.25),
            0 0 35px rgba(0,255,0,.6);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:28px;
          cursor:pointer;
          user-select:none;
          transition: all .25s ease;
        ">
          👤
        </div>
      `,
      iconSize: [62, 62],
      iconAnchor: [31, 31],
      popupAnchor: [0, -30]
    });
  }

  private buildOfficialPopupContent(officialTracking: OfficialTracking): string {
    const lastUpdate = officialTracking.last_gps_update
      ? new Date(officialTracking.last_gps_update).toLocaleString()
      : 'Sin dato';
    const gpsStatus = officialTracking.gps_active === false ? 'Sin conexión' : 'Activo';
    return `<strong>Funcionario #${officialTracking.id_official}</strong><br>Última actualización: ${lastUpdate}<br>Estado GPS: ${gpsStatus}`;
  }

  private isOfficialVisibleForFilters(idOfficial: number, entityId: number | null): boolean {
    if (this.selectedEntityFilter == null) return true;
    if (entityId != null) return entityId === this.selectedEntityFilter;
    const knownOfficial = this.officialsById.get(idOfficial);
    return knownOfficial?.id_entity === this.selectedEntityFilter;
  }

  private removeOfficialMarker(idOfficial: number): void {
    const marker = this.officialMarkers.get(idOfficial);
    if (!marker) return;
    this.trackingLayer.removeLayer(marker);
    this.officialMarkers.delete(idOfficial);
  }

  private rebuildVisibleTrackingMarkers(): void {
    this.trackingLayer.clearLayers();
    const existingEntries = Array.from(this.officialMarkers.entries());
    this.officialMarkers.clear();

    for (const [idOfficial, marker] of existingEntries) {
      const knownOfficial = this.officialsById.get(idOfficial);
      const entityId = knownOfficial?.id_entity ?? null;
      if (!this.showRealtimeOfficials || !this.isOfficialVisibleForFilters(idOfficial, entityId)) {
        continue;
      }
      this.trackingLayer.addLayer(marker);
      this.officialMarkers.set(idOfficial, marker);
    }
  }
}
