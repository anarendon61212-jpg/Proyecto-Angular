import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import {
  Annotation,
  AnnotationCategoryPayload,
  AnnotationDetail,
  AnnotationPayload,
  Category,
  Citizen,
  Entity,
  Neighborhood,
  TerritorialStatus,
  VotePayload
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
  VoteCrudService
} from '../../core/api/territorial-crud.services';
import { DataTableAction, DataTableColumn } from '../../shared/components/data-table/data-table.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { FileUploadComponent } from '../../shared/components/file-upload/file-upload.component';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-annotations-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DataTableComponent, FileUploadComponent],
  template: `
    <div class="annotations-page">
      <section class="annotations-panel app-card">
        <header class="annotations-header">
          <div>
            <h2>Anotaciones</h2>
            <p>Registre nuevos hallazgos territoriales, adjunte fotos y asigne categorías.</p>
          </div>
        </header>

        <form class="annotation-form" [formGroup]="annotationForm" (ngSubmit)="createAnnotation()">
          <div class="form-grid">
            <label>
              Ciudadano
              <select formControlName="id_citizen">
                <option value="">Seleccione ciudadano</option>
                <option *ngFor="let citizen of citizens" [value]="citizen.id_citizen">{{ citizen.name }}</option>
              </select>
            </label>

            <label>
              Barrio
              <select formControlName="id_neighborhood">
                <option value="">Sin barrio</option>
                <option *ngFor="let neighborhood of neighborhoods" [value]="neighborhood.id_neighborhood">
                  {{ neighborhood.name }}
                </option>
              </select>
            </label>

            <label>
              Estado
              <select formControlName="status">
                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
              </select>
            </label>

            <label>
              Latitud
              <input type="number" step="0.000001" formControlName="latitude" />
            </label>

            <label>
              Longitud
              <input type="number" step="0.000001" formControlName="longitude" />
            </label>
          </div>

          <label class="full-width">
            Descripción
            <textarea formControlName="description" rows="4" placeholder="Describe la anotación"></textarea>
          </label>

          <div class="annotation-extras">
            <div class="field-group">
              <h3>Categorías</h3>
              <div class="checkbox-grid">
                <label *ngFor="let category of categories">
                  <input
                    type="checkbox"
                    [value]="category.id_category"
                    [checked]="annotationForm.value.categoryIds?.includes(category.id_category)"
                    (change)="toggleCategory(category.id_category, $event.target.checked)"
                  />
                  {{ category.name }}
                </label>
              </div>
            </div>

            <div class="field-group">
              <h3>Entidades interesadas</h3>
              <div class="checkbox-grid">
                <label *ngFor="let entity of entities">
                  <input
                    type="checkbox"
                    [value]="entity.id_entity"
                    [checked]="annotationForm.value.interestedEntityIds?.includes(entity.id_entity)"
                    (change)="toggleEntity(entity.id_entity, $event.target.checked)"
                  />
                  {{ entity.name }}
                </label>
              </div>
            </div>
          </div>

          <div class="field-group">
            <h3>Fotos / Evidencias</h3>
            <app-file-upload
              [multiple]="true"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              label="Suba fotos de la anotación"
              hint="Arrastre o seleccione archivos"
              (filesSelected)="onFilesSelected($event)"
              (invalidFiles)="onInvalidFiles($event)"
            ></app-file-upload>
          </div>

          <button type="submit" class="app-button app-button--primary">Crear anotación</button>
        </form>
      </section>

      <section class="annotations-list app-card">
        <div class="annotations-toolbar">
          <div class="filter-row">
            <label>
              Buscar
              <input type="search" placeholder="Buscar descripción o ID" [(ngModel)]="filters.search" (input)="filterAnnotations()" />
            </label>
            <label>
              Barrio
              <select [(ngModel)]="filters.neighborhoodId" (change)="filterAnnotations()">
                <option value="">Todos</option>
                <option *ngFor="let neighborhood of neighborhoods" [value]="neighborhood.id_neighborhood">
                  {{ neighborhood.name }}
                </option>
              </select>
            </label>
            <label>
              Estado
              <select [(ngModel)]="filters.status" (change)="filterAnnotations()">
                <option value="">Todos</option>
                <option value="Activa">Activa</option>
                <option value="Inactiva">Inactiva</option>
              </select>
            </label>
          </div>

          <button type="button" class="app-button app-button--secondary" (click)="clearFilters()">Limpiar filtros</button>
        </div>

        <app-data-table
          [title]="'Listado de anotaciones'"
          [rows]="filteredAnnotations"
          [columns]="columns"
          [actions]="actions"
          [trackByKey]="'id_annotation'"
          (actionClick)="handleAction($event)"
        >
          <div empty>
            <p>No se encontraron anotaciones con los filtros actuales.</p>
          </div>
        </app-data-table>
      </section>

      <section class="annotations-detail app-card" *ngIf="selectedAnnotation">
        <header>
          <h2>Anotación #{{ selectedAnnotation.id_annotation }}</h2>
          <p>{{ selectedAnnotation.description }}</p>
        </header>

        <div class="detail-grid">
          <div>
            <p><strong>Ciudadano:</strong> {{ selectedAnnotation.citizen?.name || 'No disponible' }}</p>
            <p><strong>Barrio:</strong> {{ selectedAnnotation.neighborhood?.name || 'No especificado' }}</p>
            <p><strong>Estado:</strong> {{ selectedAnnotation.status }}</p>
            <p><strong>Registrada:</strong> {{ selectedAnnotation.registration_date || '—' }}</p>
            <p><strong>Ubicación:</strong> {{ selectedAnnotation.latitude }}, {{ selectedAnnotation.longitude }}</p>
          </div>
          <div>
            <p><strong>Categorías:</strong></p>
            <div class="chip-list">
              <span *ngFor="let category of selectedAnnotation.categories" class="chip">{{ category.name }}</span>
            </div>
            <p><strong>Entidades interesadas:</strong></p>
            <div class="chip-list">
              <span *ngFor="let party of selectedAnnotation.interested_parties" class="chip">ID entidad {{ party.id_entity }}</span>
            </div>
          </div>
        </div>

        <div class="evidence-section">
          <h3>Fotos / Evidencias</h3>
          <div *ngIf="selectedAnnotation.evidences?.length; else noEvidence" class="evidence-grid">
            <img *ngFor="let evidence of selectedAnnotation.evidences" [src]="evidence.file_url" alt="Evidencia" />
          </div>
          <ng-template #noEvidence><p>No hay evidencias registradas.</p></ng-template>
        </div>

        <div class="rating-section">
          <h3>Votar / Calificar</h3>
          <form [formGroup]="voteForm" (ngSubmit)="submitVote()">
            <label>
              Estrellas
              <select formControlName="stars">
                <option *ngFor="let star of [1,2,3,4,5]" [value]="star">{{ star }} ⭐</option>
              </select>
            </label>
            <label class="full-width">
              Comentario
              <textarea formControlName="comment" rows="3" placeholder="Agrega un comentario"></textarea>
            </label>
            <button type="submit" class="app-button app-button--primary">Enviar voto</button>
          </form>
          <div class="rating-summary">
            <p><strong>Promedio:</strong> {{ selectedAnnotation.average_rating ?? 0 }} ⭐</p>
            <p><strong>Votos:</strong> {{ selectedAnnotation.votes_count ?? 0 }}</p>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    ".annotations-page { display: grid; gap: 1rem; grid-template-columns: 1.4fr 1fr; min-height: calc(100vh - 3rem); }",
    ".annotations-panel, .annotations-list, .annotations-detail { padding: 1.25rem; }",
    ".annotations-header h2 { margin: 0 0 0.35rem; }",
    ".annotation-form { display: grid; gap: 1rem; }",
    ".form-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }",
    ".full-width { width: 100%; display: grid; gap: 0.5rem; }",
    "label { display: grid; gap: 0.5rem; font-size: 0.95rem; }",
    "input, select, textarea { border: 1px solid var(--color-border); border-radius: 0.75rem; padding: 0.85rem; font: inherit; background: white; color: var(--color-ink); }",
    "textarea { min-height: 6rem; resize: vertical; }",
    ".annotation-extras { display: grid; gap: 1rem; }",
    ".field-group { border: 1px solid var(--color-border); border-radius: 1rem; padding: 1rem; }",
    ".checkbox-grid { display: grid; gap: 0.75rem; max-height: 180px; overflow: auto; }",
    ".app-button { margin-top: 0.5rem; }",
    ".annotations-toolbar { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }",
    ".filter-row { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); width: 100%; }",
    ".annotations-detail { display: grid; gap: 1rem; }",
    ".detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }",
    ".chip-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }",
    ".chip { background: rgba(20, 89, 245, 0.1); border-radius: 999px; padding: 0.4rem 0.75rem; font-size: 0.85rem; }",
    ".evidence-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; }",
    ".evidence-grid img { width: 100%; min-height: 120px; object-fit: cover; border-radius: 0.75rem; }",
    ".rating-section { display: grid; gap: 1rem; }",
    "@media (max-width: 1100px) { .annotations-page { grid-template-columns: 1fr; } .detail-grid { grid-template-columns: 1fr; } }"
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotationsListComponent {
  private readonly annotationService = inject(AnnotationCrudService);
  private readonly categoryService = inject(CategoryCrudService);
  private readonly citizenService = inject(CitizenCrudService);
  private readonly neighborhoodService = inject(NeighborhoodCrudService);
  private readonly entityService = inject(EntityCrudService);
  private readonly evidenceService = inject(EvidenceCrudService);
  private readonly interestedPartyService = inject(InterestedPartyCrudService);
  private readonly annotationCategoryService = inject(AnnotationCategoryCrudService);
  private readonly voteService = inject(VoteCrudService);
  private readonly toastService = inject(ToastService);

  annotations: Annotation[] = [];
  filteredAnnotations: Annotation[] = [];
  categories: Category[] = [];
  citizens: Citizen[] = [];
  neighborhoods: Neighborhood[] = [];
  entities: Entity[] = [];
  selectedAnnotation: AnnotationDetail | null = null;
  photoFiles: File[] = [];

  filters = {
    search: '',
    neighborhoodId: '',
    status: ''
  };

  annotationForm = new FormGroup({
    id_neighborhood: new FormControl<number | null>(null),
    id_citizen: new FormControl<number | null>(null),
    description: new FormControl('', { nonNullable: true }),
    latitude: new FormControl<number | null>(null),
    longitude: new FormControl<number | null>(null),
    status: new FormControl<TerritorialStatus>('Activa', { nonNullable: true }),
    categoryIds: new FormControl<number[]>([]),
    interestedEntityIds: new FormControl<number[]>([])
  });

  voteForm = new FormGroup({
    stars: new FormControl<number>(5, { nonNullable: true }),
    comment: new FormControl('', { nonNullable: true })
  });

  readonly columns: DataTableColumn<Annotation>[] = [
    { key: 'id_annotation', header: 'ID' },
    { key: 'description', header: 'Descripción', formatter: (row) => row.description?.slice(0, 60) + (row.description?.length > 60 ? '…' : '') },
    { key: 'id_neighborhood', header: 'Barrio' },
    { key: 'status', header: 'Estado' }
  ];

  readonly actions: DataTableAction<Annotation>[] = [
    { id: 'view', label: 'Ver detalle', icon: '👁️' }
  ];

  constructor() {
    this.loadData();
  }

  handleAction(event: { actionId: string; row: Annotation }): void {
    if (event.actionId === 'view') {
      this.selectAnnotation(event.row.id_annotation);
    }
  }

  toggleCategory(categoryId: number, checked: boolean): void {
    const selected = [...(this.annotationForm.value.categoryIds ?? [])];
    if (checked) {
      selected.push(categoryId);
    } else {
      const index = selected.indexOf(categoryId);
      if (index >= 0) {
        selected.splice(index, 1);
      }
    }

    this.annotationForm.controls.categoryIds.setValue(selected);
  }

  toggleEntity(entityId: number, checked: boolean): void {
    const selected = [...(this.annotationForm.value.interestedEntityIds ?? [])];
    if (checked) {
      selected.push(entityId);
    } else {
      const index = selected.indexOf(entityId);
      if (index >= 0) {
        selected.splice(index, 1);
      }
    }

    this.annotationForm.controls.interestedEntityIds.setValue(selected);
  }

  onFilesSelected(files: File[]): void {
    this.photoFiles = files;
  }

  onInvalidFiles(invalid: string[]): void {
    if (invalid.length > 0) {
      this.toastService.warning('Archivo inválido', `Los archivos mayores a 2 MB no se pueden subir: ${invalid.join(', ')}`);
    }
  }

  createAnnotation(): void {
    if (!this.annotationForm.value.id_citizen || !this.annotationForm.value.description) {
      this.toastService.danger('Formulario incompleto', 'Seleccione un ciudadano y escriba una descripción.');
      return;
    }

    const payload: AnnotationPayload = {
      id_neighborhood: this.annotationForm.controls.id_neighborhood.value
        ? Number(this.annotationForm.controls.id_neighborhood.value)
        : undefined,
      id_citizen: Number(this.annotationForm.controls.id_citizen.value),
      description: this.annotationForm.controls.description.value,
      latitude: Number(this.annotationForm.controls.latitude.value ?? 0),
      longitude: Number(this.annotationForm.controls.longitude.value ?? 0),
      status: this.annotationForm.controls.status.value
    };

    this.annotationService.create(payload).pipe(
      catchError((error) => {
        this.toastService.danger('Error al crear anotación', 'Intente nuevamente.');
        return of(null);
      })
    ).subscribe((annotation) => {
      if (!annotation) {
        return;
      }

      const tasks = [] as Array<import('rxjs').Observable<unknown>>;
      const categoryIds = this.annotationForm.value.categoryIds ?? [];
      const entityIds = this.annotationForm.value.interestedEntityIds ?? [];

      for (const categoryId of categoryIds) {
        const payloadCategory: AnnotationCategoryPayload = {
          id_annotation: annotation.id_annotation,
          id_category: categoryId
        };
        tasks.push(this.annotationCategoryService.create(payloadCategory));
      }

      for (const entityId of entityIds) {
        tasks.push(this.interestedPartyService.create({ id_annotation: annotation.id_annotation, id_entity: entityId }));
      }

      for (const file of this.photoFiles) {
        const formData = new FormData();
        formData.append('id_annotation', String(annotation.id_annotation));
        formData.append('file', file);
        tasks.push(this.evidenceService.createForm(formData));
      }

      if (tasks.length === 0) {
        this.toastService.success('Anotación creada', 'La anotación se agregó correctamente.');
        this.resetForm();
        return this.loadData();
      }

      forkJoin(tasks)
        .pipe(catchError(() => {
          this.toastService.warning('Anotación creada', 'La anotación se creó, pero algunos datos auxiliares no se guardaron completamente.');
          return of(null);
        }))
        .subscribe(() => {
          this.toastService.success('Anotación creada', 'La anotación y sus datos relacionados se guardaron correctamente.');
          this.resetForm();
          this.loadData();
        });
    });
  }

  clearFilters(): void {
    this.filters = { search: '', neighborhoodId: '', status: '' };
    this.filterAnnotations();
  }

  selectAnnotation(annotationId: number): void {
    this.annotationService.getById(annotationId).subscribe((annotation) => {
      this.selectedAnnotation = annotation as AnnotationDetail;
      this.toastService.info('Detalle cargado', `Detalle de anotación #${annotationId} cargado.`);
    });
  }

  submitVote(): void {
    if (!this.selectedAnnotation) {
      return;
    }

    const payload: VotePayload = {
      id_annotation: this.selectedAnnotation.id_annotation,
      id_citizen: this.selectedAnnotation.id_citizen,
      stars: Number(this.voteForm.controls.stars.value),
      comment: this.voteForm.controls.comment.value || undefined
    };

    this.voteService.create(payload).subscribe(() => {
      this.toastService.success('Voto guardado', 'Tu calificación se registró correctamente.');
      this.voteForm.reset({ stars: 5, comment: '' });
      this.selectAnnotation(this.selectedAnnotation!.id_annotation);
    });
  }

  filterAnnotations(): void {
    const search = this.filters.search.trim().toLowerCase();
    const neighborhoodId = Number(this.filters.neighborhoodId || 0);
    const status = this.filters.status;

    this.filteredAnnotations = this.annotations.filter((annotation) => {
      const matchesSearch =
        !search || annotation.description.toLowerCase().includes(search) || String(annotation.id_annotation).includes(search);
      const matchesNeighborhood = !neighborhoodId || annotation.id_neighborhood === neighborhoodId;
      const matchesStatus = !status || annotation.status === status;
      return matchesSearch && matchesNeighborhood && matchesStatus;
    });
  }

  private loadData(): void {
    forkJoin({
      annotations: this.annotationService.listCollection(),
      categories: this.categoryService.listCollection(),
      neighborhoods: this.neighborhoodService.listCollection(),
      citizens: this.citizenService.listCollection(),
      entities: this.entityService.listCollection()
    }).subscribe(({ annotations, categories, neighborhoods, citizens, entities }) => {
      this.annotations = annotations.items;
      this.filteredAnnotations = [...this.annotations];
      this.categories = categories.items;
      this.neighborhoods = neighborhoods.items;
      this.citizens = citizens.items;
      this.entities = entities.items;
    });
  }

  private resetForm(): void {
    this.annotationForm.reset({
      id_neighborhood: null,
      id_citizen: null,
      description: '',
      latitude: null,
      longitude: null,
      status: 'Activa',
      categoryIds: [],
      interestedEntityIds: []
    });
    this.photoFiles = [];
  }
}
