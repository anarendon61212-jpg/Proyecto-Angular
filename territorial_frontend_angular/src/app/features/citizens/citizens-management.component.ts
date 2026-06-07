import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import * as L from 'leaflet';
import { catchError, of, take } from 'rxjs';

import { Citizen, CitizenPayload, TerritorialStatus } from '@core/models/territorial.models';
import { CitizenCrudService } from '@core/api/territorial-crud.services';
import {
  DataTableAction,
  DataTableActionEvent,
  DataTableColumn,
  DataTableComponent
} from '@shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { ToastService } from '@shared/services/toast.service';
import { normalizeStatus } from '@core/utils/status.utils';

type CitizenFormValue = {
  name: string;
  email: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: TerritorialStatus;
};

const MANIZALES_CENTER: L.LatLngTuple = [5.0703, -75.5138];

@Component({
  selector: 'app-citizens-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DataTableComponent],
  template: `
    <div class="citizens-page">
      <section class="citizen-form-panel app-card">
        <header class="section-header">
          <div>
            <p class="eyebrow">CU-03</p>
            <h2>{{ editingCitizen ? 'Actualizar ciudadano' : 'Registrar ciudadano' }}</h2>
            <p>Ingresa los datos del ciudadano y ubica su dirección colocando el pin en el mapa.</p>
          </div>

          @if (editingCitizen) {
            <button class="app-button app-button--secondary" type="button" (click)="resetForm()">Nuevo registro</button>
          }
        </header>

        <form class="citizen-form" [formGroup]="citizenForm" (ngSubmit)="saveCitizen()">
          <div class="form-grid">
            <label>
              Nombre
              <input type="text" formControlName="name" placeholder="Nombre completo" />
              @if (showError('name')) {
                <span class="field-error">El nombre es obligatorio y debe tener mínimo 3 caracteres.</span>
              }
            </label>

            <label>
              Correo
              <input type="email" formControlName="email" placeholder="correo@email.com" />
              @if (showError('email')) {
                <span class="field-error">Ingresa un correo válido.</span>
              }
            </label>

            <label>
              Celular
              <input type="tel" formControlName="phone" placeholder="+57 3xx xxx xxxx" />
              @if (showError('phone')) {
                <span class="field-error">El celular es obligatorio.</span>
              }
            </label>

            <label>
              Estado
              <select formControlName="status">
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
          </div>

          <label>
            Dirección
            <input type="text" formControlName="address" placeholder="Carrera 5 # 22-10" />
            @if (showError('address')) {
              <span class="field-error">La dirección es obligatoria.</span>
            }
          </label>

          <div class="map-layout">
            <div class="map-copy">
              <strong>Pin de dirección</strong>
              <p>Haz clic en el mapa o arrastra el marcador para guardar la ubicación del ciudadano.</p>
              <div class="coordinates">
                <span>Lat: {{ coordinateLabel(citizenForm.controls.latitude.value) }}</span>
                <span>Lng: {{ coordinateLabel(citizenForm.controls.longitude.value) }}</span>
              </div>
              @if (showLocationError()) {
                <span class="field-error">Debes colocar el pin en el mapa antes de guardar.</span>
              }
            </div>

            <div #mapContainer class="citizen-map" aria-label="Mapa para seleccionar dirección"></div>
          </div>

          <div class="form-actions">
            <button class="app-button app-button--secondary" type="button" (click)="resetForm()" [disabled]="isSubmitting">
              Limpiar
            </button>
            <button class="app-button app-button--primary" type="submit" [disabled]="isSubmitting">
              {{ isSubmitting ? 'Guardando...' : editingCitizen ? 'Actualizar ciudadano' : 'Registrar ciudadano' }}
            </button>
          </div>
        </form>
      </section>

      <section class="citizen-list-panel app-card">
        <header class="section-header">
          <div>
            <h2>Ciudadanos registrados</h2>
            <p>Consulta, edita o elimina ciudadanos desde el panel.</p>
          </div>
          <button class="app-button app-button--secondary" type="button" (click)="loadCitizens()">Actualizar</button>
        </header>

        <div class="citizen-table-shell">
          <app-data-table
            [title]="'Listado de ciudadanos'"
            [rows]="citizens"
            [columns]="columns"
            [actions]="actions"
            [trackByKey]="'id_citizen'"
            (actionClick)="handleTableAction($event)"
          >
            <div empty>
              <p>No hay ciudadanos registrados.</p>
            </div>
          </app-data-table>
        </div>
      </section>
    </div>
  `,
  styles: [
    `.citizens-page { display: grid; gap: 1.25rem; margin-inline: auto; max-width: 1280px; width: 100%; }`,
    `.citizen-form-panel, .citizen-list-panel { display: grid; gap: 1.25rem; min-width: 0; padding: 1.4rem; }`,
    `.section-header { align-items: flex-start; display: flex; gap: 1rem; justify-content: space-between; min-width: 0; }`,
    `.section-header > div { min-width: 0; }`,
    `.section-header h2, .section-header p { margin: 0; }`,
    `.section-header h2 { font-size: 1.35rem; line-height: 1.2; }`,
    `.section-header p { color: var(--color-muted); margin-top: 0.35rem; }`,
    `.eyebrow { color: var(--color-primary); font-size: 0.78rem; font-weight: 900; letter-spacing: 0.08em; margin: 0 0 0.35rem; text-transform: uppercase; }`,
    `.citizen-form { display: grid; gap: 1rem; }`,
    `.form-grid { display: grid; gap: 1rem; grid-template-columns: repeat(4, minmax(0, 1fr)); }`,
    `label { color: var(--color-ink); display: grid; font-size: 0.95rem; gap: 0.5rem; }`,
    `input, select { background: #ffffff; border: 1px solid var(--color-border); border-radius: 12px; color: var(--color-ink); font: inherit; padding: 0.85rem; width: 100%; }`,
    `input:focus, select:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(20, 89, 245, 0.12); outline: none; }`,
    `.field-error { color: var(--color-danger); font-size: 0.82rem; }`,
    `.map-layout { background: #fbfdff; border: 1px solid var(--color-border); border-radius: var(--radius-lg); display: grid; gap: 1rem; grid-template-columns: 260px 1fr; padding: 1rem; }`,
    `.map-copy { align-content: start; display: grid; gap: 0.75rem; }`,
    `.map-copy p { color: var(--color-muted); margin: 0; }`,
    `.coordinates { display: grid; gap: 0.4rem; }`,
    `.coordinates span { background: rgba(20, 89, 245, 0.08); border-radius: 999px; color: var(--color-primary); font-size: 0.82rem; padding: 0.45rem 0.7rem; }`,
    `.citizen-map { min-height: 460px; width: 100%; border-radius: var(--radius-lg); overflow: hidden; }`,
    `:host ::ng-deep .citizen-location-marker { background: var(--color-danger); border: 3px solid #ffffff; border-radius: 999px; box-shadow: 0 0 0 6px rgba(239, 35, 60, 0.18); height: 18px; width: 18px; }`,
    `.form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }`,
    `.citizen-table-shell { min-width: 0; overflow: hidden; }`,
    `:host ::ng-deep .citizen-table-shell .data-table { border: 0; border-radius: 0; box-shadow: none; min-width: 0; padding: 0; }`,
    `:host ::ng-deep .citizen-table-shell .data-table__header { align-items: center; padding-inline: 0; }`,
    `:host ::ng-deep .citizen-table-shell .data-table__scroll { max-width: 100%; overflow-x: auto; }`,
    `:host ::ng-deep .citizen-table-shell table { min-width: 920px; }`,
    `:host ::ng-deep .citizen-table-shell th, :host ::ng-deep .citizen-table-shell td { white-space: nowrap; }`,
    `@media (max-width: 980px) { .form-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .map-layout { grid-template-columns: 1fr; } .citizen-map { min-height: 420px; } }`,
    `@media (max-width: 720px) { .citizen-form-panel, .citizen-list-panel { padding: 1rem; } .section-header, .form-actions { align-items: stretch; flex-direction: column; } .form-grid { grid-template-columns: 1fr; } .citizen-map { min-height: 360px; } }`
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CitizensManagementComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private readonly citizenService = inject(CitizenCrudService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  citizens: Citizen[] = [];
  editingCitizen: Citizen | null = null;
  isSubmitting = false;
  submitted = false;

  private map?: L.Map;
  private marker?: L.Marker;

  readonly citizenForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    latitude: new FormControl<number | null>(null, { validators: [Validators.required] }),
    longitude: new FormControl<number | null>(null, { validators: [Validators.required] }),
    status: new FormControl<TerritorialStatus>('active', { nonNullable: true, validators: [Validators.required] })
  });

  readonly columns: DataTableColumn<Citizen>[] = [
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Correo' },
    { key: 'phone', header: 'Celular', emptyValue: 'Sin celular' },
    { key: 'address', header: 'Dirección', emptyValue: 'Sin dirección' },
    {
      key: 'latitude',
      header: 'Pin',
      formatter: (citizen) => citizen.latitude != null && citizen.longitude != null
        ? `${Number(citizen.latitude).toFixed(5)}, ${Number(citizen.longitude).toFixed(5)}`
        : 'Sin pin'
    },
    { key: 'status', header: 'Estado' }
  ];

  readonly actions: DataTableAction<Citizen>[] = [
    { id: 'edit', label: 'Editar', icon: 'E' },
    { id: 'delete', label: 'Eliminar', icon: 'X', tone: 'danger' }
  ];

  ngAfterViewInit(): void {
    this.initializeMap();
    this.loadCitizens();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  loadCitizens(): void {
    this.citizenService.listCollection().pipe(
      take(1),
      catchError(() => {
        this.toastService.danger('Error', 'No se pudieron cargar los ciudadanos.');
        return of({ items: [], page: 1, pageSize: 0, totalItems: 0, totalPages: 1, paginated: false });
      })
    ).subscribe((collection) => {
      this.citizens = collection.items;
      this.changeDetector.markForCheck();
    });
  }

  saveCitizen(): void {
    this.submitted = true;

    if (this.citizenForm.invalid) {
      this.citizenForm.markAllAsTouched();
      this.toastService.warning('Datos incompletos', 'Completa los campos obligatorios y coloca el pin en el mapa.');
      return;
    }

    this.isSubmitting = true;
    const payload = this.buildPayload(this.citizenForm.getRawValue());
    const request = this.editingCitizen
      ? this.citizenService.update(this.editingCitizen.id_citizen, payload)
      : this.citizenService.create(payload);

    request.pipe(take(1)).subscribe({
      next: () => {
        this.toastService.success(
          this.editingCitizen ? 'Ciudadano actualizado' : 'Ciudadano registrado',
          'Los datos se guardaron correctamente.'
        );
        this.resetForm();
        this.loadCitizens();
      },
      error: (error) => {
        this.toastService.danger('Error', this.saveErrorMessage(error));
        this.isSubmitting = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  handleTableAction(event: DataTableActionEvent<Citizen>): void {
    if (event.actionId === 'edit') {
      this.editCitizen(event.row);
      return;
    }

    if (event.actionId === 'delete') {
      void this.deleteCitizen(event.row);
    }
  }

  editCitizen(citizen: Citizen): void {
    this.editingCitizen = citizen;
    this.submitted = false;
    this.citizenForm.reset({
      name: citizen.name,
      email: citizen.email,
      phone: citizen.phone ?? '',
      address: citizen.address ?? '',
      latitude: citizen.latitude ?? null,
      longitude: citizen.longitude ?? null,
      status: citizen.status ?? 'active'
    });

    if (citizen.latitude != null && citizen.longitude != null) {
      this.setPin(citizen.latitude, citizen.longitude, true);
    } else {
      this.clearPin();
    }

    this.changeDetector.markForCheck();
  }

  async deleteCitizen(citizen: Citizen): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: 'Eliminar ciudadano',
      message: `¿Deseas eliminar "${citizen.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    this.citizenService.delete(citizen.id_citizen).pipe(take(1)).subscribe({
      next: () => {
        this.toastService.success('Ciudadano eliminado', 'El registro fue eliminado correctamente.');
        if (this.editingCitizen?.id_citizen === citizen.id_citizen) {
          this.resetForm();
        }
        this.loadCitizens();
      },
      error: () => {
        this.toastService.danger('Error', 'No se pudo eliminar el ciudadano.');
        this.changeDetector.markForCheck();
      }
    });
  }

  resetForm(): void {
    this.editingCitizen = null;
    this.submitted = false;
    this.isSubmitting = false;
    this.citizenForm.reset({
      name: '',
      email: '',
      phone: '',
      address: '',
      latitude: null,
      longitude: null,
      status: 'active'
    });
    this.clearPin();
    this.map?.setView(MANIZALES_CENTER, 13);
    this.changeDetector.markForCheck();
  }

  showError(fieldName: keyof CitizenFormValue): boolean {
    const control = this.citizenForm.get(fieldName);
    return Boolean(control?.invalid && (control.touched || this.submitted));
  }

  showLocationError(): boolean {
    return this.showError('latitude') || this.showError('longitude');
  }

  coordinateLabel(value: number | null): string {
    return value == null ? 'Sin seleccionar' : Number(value).toFixed(6);
  }

  private initializeMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: MANIZALES_CENTER,
      zoom: 13,
      scrollWheelZoom: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.map.on('click', (event: L.LeafletMouseEvent) => {
      this.setPin(event.latlng.lat, event.latlng.lng);
    });
  }

  private setPin(latitude: number, longitude: number, focus = false): void {
    const latLng = L.latLng(latitude, longitude);

    if (!this.marker) {
      this.marker = L.marker(latLng, {
        draggable: true,
        icon: L.divIcon({ className: 'citizen-location-marker' })
      }).addTo(this.map!);

      this.marker.on('dragend', () => {
        const nextPosition = this.marker!.getLatLng();
        this.updateLocationControls(nextPosition.lat, nextPosition.lng);
      });
    } else {
      this.marker.setLatLng(latLng);
    }

    this.updateLocationControls(latitude, longitude);

    if (focus) {
      this.map?.setView(latLng, 16);
    }
  }

  private clearPin(): void {
    if (this.marker) {
      this.marker.remove();
      this.marker = undefined;
    }
  }

  private updateLocationControls(latitude: number, longitude: number): void {
    this.citizenForm.patchValue({
      latitude: Number(latitude.toFixed(7)),
      longitude: Number(longitude.toFixed(7))
    });
    this.citizenForm.controls.latitude.markAsTouched();
    this.citizenForm.controls.longitude.markAsTouched();
    this.changeDetector.markForCheck();
  }

  private buildPayload(formValue: CitizenFormValue): CitizenPayload {
    return {
      name: formValue.name.trim(),
      email: formValue.email.trim(),
      phone: formValue.phone.trim() || undefined,
      address: formValue.address.trim(),
      latitude: Number(formValue.latitude),
      longitude: Number(formValue.longitude),
      status: normalizeStatus(formValue.status)
    };
  }

  private saveErrorMessage(error: unknown): string {
    const isUpdate = Boolean(this.editingCitizen);
    return isUpdate
      ? 'No se pudo actualizar el ciudadano. Verifica los datos e inténtalo de nuevo.'
      : 'No se pudo crear el ciudadano. Verifica los datos e inténtalo de nuevo.';
  }
}
