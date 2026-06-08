import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { combineLatest, Subject, takeUntil } from 'rxjs';

import { Neighborhood, Point, PointPayload } from '../../core/models/territorial.models';
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
  isEditingPolygon = false;
  isEditingExistingPolygon = false;
  private map!: L.Map;
  private baseLayers!: Record<string, L.TileLayer>;
  private neighborhoodLayer = L.layerGroup();
  private pointLayer = L.layerGroup();
  private selectedNeighborhoodLayer = L.layerGroup();
  private editingLayer = L.layerGroup();
  private polygonPoints: L.LatLng[] = [];
  private polygonMarkers: L.Marker[] = [];
  private polygonLine: L.Polyline | null = null;
  private selectedNeighborhoodId: number | null = null;
  private existingPolygonPoints: Point[] = [];

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadTerritorialData();
    this.editingLayer.addTo(this.map);
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
    this.selectedNeighborhoodId = selectedId;
    this.focusOnNeighborhood(selectedId);
    this.refreshMapLayers();
  }

  startPolygonEditing(): void {
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

    neighborhoodPointsMap.forEach((points, neighborhoodId) => {
      const sortedPoints = points.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const coordinates = sortedPoints.map(p => [p.latitude, p.longitude] as L.LatLngTuple);

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

    const polygonPoints = this.points
      .filter(p => p.point_type === 'polygon' && p.id_neighborhood === neighborhoodId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (polygonPoints.length >= 3) {
      const coordinates = polygonPoints.map(p => [p.latitude, p.longitude] as L.LatLngTuple);
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
