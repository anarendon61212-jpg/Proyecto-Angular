import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { combineLatest, Subject, takeUntil } from 'rxjs';

import { Neighborhood, Point } from '../../core/models/territorial.models';
import { NeighborhoodCrudService, PointCrudService } from '../../core/api/territorial-crud.services';

interface NeighborhoodShape {
  id: number;
  name: string;
  coordinates: L.LatLngTuple[];
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
  imports: [CommonModule],
  template: `
    <div class="map-page">
      <aside class="map-sidebar app-card">
        <div class="panel-section">
          <h2>Territorio</h2>
          <p>Seleccione barrio, capas y filtros para ver datos en el mapa.</p>
        </div>

        <div class="panel-section">
          <label for="neighborhood-select">Barrio</label>
          <select id="neighborhood-select" (change)="onNeighborhoodSelected($event)">
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
          </div>
        </div>

        <div #mapContainer class="leaflet-container"></div>
      </section>
    </div>
  `,
  styles: [
    `.map-page { display: grid; grid-template-columns: 320px 1fr; gap: 1rem; margin: 0; padding: 0; }`,
    `.map-sidebar { display: grid; gap: 1rem; padding: 1.25rem; }`,
    `.panel-section { display: grid; gap: 0.75rem; }`,
    `.panel-section h3 { margin: 0; font-size: 0.95rem; }`,
    `.panel-section label { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; color: var(--color-ink); }`,
    `select { width: 100%; border: 1px solid var(--color-border); border-radius: 12px; background: white; color: var(--color-ink); font: inherit; padding: 0.8rem 0.85rem; }`,
    `.map-view { display: grid; gap: 1rem; min-height: calc(100vh - 3rem); padding: 1.25rem; }`,
    `.map-header { align-items: center; display: flex; justify-content: space-between; gap: 1rem; }`,
    `.map-legend { display: flex; gap: 0.75rem; flex-wrap: wrap; }`,
    `.legend-item { align-items: center; border-radius: 999px; display: inline-flex; gap: 0.5rem; font-size: 0.9rem; padding: 0.6rem 0.85rem; }`,
    `.legend-item--neighborhood { background: rgba(20, 89, 245, 0.1); color: var(--color-primary); }`,
    `.legend-item--point { background: rgba(239, 35, 60, 0.1); color: var(--color-danger); }`,
    `.leaflet-container { min-height: 640px; width: 100%; border-radius: var(--radius-lg); box-shadow: var(--shadow-card); }`,
    `.map-point-marker { width: 16px; height: 16px; border: 2px solid #ffffff; border-radius: 50%; background: var(--color-danger); box-shadow: 0 0 0 5px rgba(239, 35, 60, 0.16); }`,
    `@media (max-width: 980px) { .map-page { grid-template-columns: 1fr; } }`
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private readonly neighborhoodService = inject(NeighborhoodCrudService);
  private readonly pointService = inject(PointCrudService);
  private readonly destroy$ = new Subject<void>();

  neighborhoods: Neighborhood[] = [];
  points: Point[] = [];
  showNeighborhoods = true;
  showPoints = true;
  pointFilters = {
    annotation: true,
    polygon: true,
    boundary: true
  };
  private map!: L.Map;
  private baseLayers!: Record<string, L.TileLayer>;
  private neighborhoodLayer = L.layerGroup();
  private pointLayer = L.layerGroup();
  private selectedNeighborhoodLayer = L.layerGroup();

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadTerritorialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setBaseLayer(layerKey: 'streets' | 'topographic'): void {
    if (!this.map || !this.baseLayers) {
      return;
    }

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

  onNeighborhoodSelected(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    const value = target?.value ?? '';
    const selectedId = value ? Number(value) : null;
    this.focusOnNeighborhood(selectedId);
    this.refreshMapLayers();
  }

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
    this.pointLayer.addTo(this.map);
    this.selectedNeighborhoodLayer.addTo(this.map);
  }

  private loadTerritorialData(): void {
    combineLatest([
      this.neighborhoodService.listCollection(),
      this.pointService.listCollection()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([neighborhoodCollection, pointCollection]) => {
        this.neighborhoods = neighborhoodCollection.items;
        this.points = pointCollection.items;
        this.refreshMapLayers();
      });
  }

  private refreshMapLayers(): void {
    this.neighborhoodLayer.clearLayers();
    this.pointLayer.clearLayers();
    this.selectedNeighborhoodLayer.clearLayers();

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
  }

  private renderPointMarkers(): void {
    const filteredPoints = this.points.filter((point) => this.pointFilters[point.point_type as keyof typeof this.pointFilters]);

    for (const point of filteredPoints) {
      if (point.latitude == null || point.longitude == null) {
        continue;
      }

      const marker = L.marker([point.latitude, point.longitude], {
        icon: L.divIcon({ className: 'map-point-marker' }),
        draggable: true
      });

      marker.bindPopup(`Tipo: ${point.point_type}<br>ID: ${point.id_point}`);
      marker.on('dragend', () => this.updatePointLocation(point, marker.getLatLng()));
      this.pointLayer.addLayer(marker);
    }
  }

  private focusOnNeighborhood(neighborhoodId: number | null): void {
    if (neighborhoodId == null) {
      this.map.setView([5.074, -75.515], 14);
      return;
    }

    const shape = NEIGHBORHOOD_SHAPES.find((item) => item.id === neighborhoodId);

    if (!shape) {
      return;
    }

    this.map.fitBounds(shape.coordinates as L.LatLngBoundsExpression);
    this.selectedNeighborhoodLayer.clearLayers();

    const highlight = L.polygon(shape.coordinates, {
      color: '#ef233c',
      weight: 3,
      fillOpacity: 0.04
    });

    this.selectedNeighborhoodLayer.addLayer(highlight);
  }

  private updatePointLocation(point: Point, latLng: L.LatLng): void {
    point.latitude = latLng.lat;
    point.longitude = latLng.lng;
    this.pointService.update(point.id_point, { latitude: latLng.lat, longitude: latLng.lng }).subscribe();
  }
}
