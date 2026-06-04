import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { take } from 'rxjs';

import { Entity } from '@core/models/territorial.models';
import { EntityCrudService, OfficialCrudService } from '@core/api/territorial-crud.services';
import { ApiCollection } from '@core/api/crud-resource.service';
import { DataTableColumn, DataTableComponent, DataTableActionEvent } from '@shared/components/data-table/data-table.component';
import { PaginatorComponent } from '@shared/components/paginator/paginator.component';
import { DrawerPanelComponent } from '@shared/components/drawer-panel/drawer-panel.component';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { ToastService } from '@shared/services/toast.service';
import { EntitiesFormComponent } from './entities-form.component';

@Component({
  selector: 'app-entities-list',
  standalone: true,
  imports: [
    CommonModule,
    DataTableComponent,
    PaginatorComponent,
    DrawerPanelComponent,
    EntitiesFormComponent
  ],
  template: `
    <section class="app-card">
      <div class="section-header">
        <div>
          <h2>Entidades</h2>
          <p class="description">Gestiona las entidades del sistema</p>
        </div>
        <button (click)="openCreateForm()" class="btn btn-primary">
          + Nueva Entidad
        </button>
      </div>

      <ng-container *ngIf="collection() as collection">
        <app-data-table
          [title]="'Listado de Entidades'"
          [rows]="collection.items"
          [columns]="columns"
          [actions]="tableActions"
          (actionClick)="onTableAction($event)"
          [trackByKey]="'id_entity'"
        ></app-data-table>

        <app-paginator
          [page]="collection.page"
          [pageSize]="collection.pageSize"
          [totalItems]="collection.totalItems"
        ></app-paginator>
      </ng-container>
    </section>

    <!-- Drawer para formulario -->
    <app-drawer-panel
      [open]="isFormOpen()"
      [title]="editingEntity() ? 'Editar Entidad' : 'Nueva Entidad'"
      [description]="editingEntity() ? 'Modifica los datos de la entidad' : 'Crea una nueva entidad'"
      size="md"
      (closed)="closeForm()"
    >
      <app-entities-form
        [entity]="editingEntity()"
        (saved)="onFormSaved($event)"
        (cancelled)="closeForm()"
      ></app-entities-form>
    </app-drawer-panel>
  `,
  styles: [`
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 2rem;
      gap: 1rem;

      h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.5rem;
        color: #333;
      }

      .description {
        margin: 0;
        color: #666;
        font-size: 0.875rem;
      }
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-primary {
      background-color: #4285f4;
      color: white;

      &:hover:not(:disabled) {
        background-color: #3367d6;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntitiesListComponent implements OnInit {
  private readonly entityService = inject(EntityCrudService);
  private readonly officialService = inject(OfficialCrudService);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);

  readonly collection = signal<ApiCollection<Entity> | null>(null);
  readonly isFormOpen = signal(false);
  readonly editingEntity = signal<Entity | null>(null);

  readonly columns: DataTableColumn<Entity>[] = [
    { key: 'name', header: 'Nombre' },
    { key: 'nit', header: 'NIT' },
    { key: 'email', header: 'Correo' },
    { key: 'phone', header: 'Teléfono', emptyValue: '—' },
    { key: 'status', header: 'Estado' }
  ];

  readonly tableActions = [
    { id: 'edit', label: 'Editar', icon: '✎' },
    { id: 'delete', label: 'Eliminar', icon: '🗑', tone: 'danger' as const }
  ];

  ngOnInit(): void {
    this.loadEntities();
  }

  private loadEntities(): void {
    this.entityService
      .listCollection()
      .pipe(take(1))
      .subscribe((collection) => {
        this.collection.set(collection);
      });
  }

  openCreateForm(): void {
    this.editingEntity.set(null);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.editingEntity.set(null);
  }

  onTableAction(event: DataTableActionEvent<Entity>): void {
    const { actionId, row } = event;

    if (actionId === 'edit') {
      this.editingEntity.set(row);
      this.isFormOpen.set(true);
    } else if (actionId === 'delete') {
      this.onDelete(row);
    }
  }

  onFormSaved(entity: Entity): void {
    this.closeForm();
    this.loadEntities();
  }

  private async onDelete(entity: Entity): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: '¿Eliminar entidad?',
      message: `¿Deseas eliminar "${entity.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      // Validar dependencias: funcionarios asociados
      const officials = await this.officialService.search({ id_entity: String(entity.id_entity) }).toPromise() as any;
      const associatedOfficials = Array.isArray(officials) ? officials : officials.items || [];

      if (associatedOfficials.length > 0) {
        this.toastService.warning(
          'No se puede eliminar',
          `Existen ${associatedOfficials.length} funcionario(s) asociado(s) a esta entidad`
        );
        return;
      }

      // Proceder con eliminación
      await this.entityService.delete(entity.id_entity).toPromise();
      this.toastService.success('Entidad eliminada correctamente');
      this.loadEntities();
    } catch (error) {
      this.toastService.danger('Error', 'No se pudo eliminar la entidad');
      console.error(error);
    }
  }
}

