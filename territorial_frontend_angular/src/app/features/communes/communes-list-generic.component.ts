import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';

import { CommuneCrudService, NeighborhoodCrudService, DepartmentCrudService, CityCrudService } from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';
import { Department, City, Commune } from '@core/models/territorial.models';
import { DataTableColumn, DataTableComponent, DataTableActionEvent } from '@shared/components/data-table/data-table.component';
import { PaginatorComponent } from '@shared/components/paginator/paginator.component';
import { DrawerPanelComponent } from '@shared/components/drawer-panel/drawer-panel.component';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { ToastService } from '@shared/services/toast.service';
import { CommunesFormComponent } from './communes-form.component';

@Component({
  selector: 'app-communes-list-generic',
  standalone: true,
  imports: [
    CommonModule,
    DataTableComponent,
    PaginatorComponent,
    DrawerPanelComponent,
    CommunesFormComponent
  ],
  template: `
    <section class="app-card">
      <div class="section-header">
        <div>
          <h2>{{ config.labelPlural }}</h2>
          <p class="description">Gestiona los {{ config.labelPlural.toLowerCase() }} del sistema</p>
        </div>
        <button (click)="openCreateForm()" class="btn btn-primary">
          + Nuevo {{ config.label }}
        </button>
      </div>

      <ng-container *ngIf="collection() as collection">
        <app-data-table
          [title]="'Listado de ' + config.labelPlural"
          [rows]="collection.items"
          [columns]="tableColumns"
          [actions]="tableActions"
          (actionClick)="onTableAction($event)"
          [trackByKey]="config.idField"
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
      [title]="editingCommune() ? 'Editar ' + config.label : 'Nuevo ' + config.label"
      [description]="editingCommune() ? 'Modifica los datos del ' + config.label.toLowerCase() : 'Crea un nuevo ' + config.label.toLowerCase()"
      size="md"
      (closed)="closeForm()"
    >
      <app-communes-form
        [config]="config"
        [commune]="editingCommune()"
        [selectOptions]="selectOptions()"
        (saved)="onFormSaved($event)"
        (cancelled)="closeForm()"
        (valueChanges)="onFormValueChanged($event)"
      ></app-communes-form>
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
export class CommunesListGenericComponent implements OnInit {
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  readonly crudService = inject(CommuneCrudService);
  readonly dependencyCheckService = inject(NeighborhoodCrudService);
  readonly departmentService = inject(DepartmentCrudService);
  readonly cityService = inject(CityCrudService);
  
  readonly config = getEntityConfig('communes');

  readonly collection = signal<any>(null);
  readonly isFormOpen = signal(false);
  readonly editingCommune = signal<Commune | null>(null);
  readonly selectOptions = signal<Record<string, any[]>>({});

  readonly tableColumns: DataTableColumn[] = [];
  readonly tableActions = [
    { id: 'edit', label: 'Editar', icon: '✎' },
    { id: 'delete', label: 'Eliminar', icon: '🗑', tone: 'danger' as const }
  ];

  departments: Department[] = [];
  cities: City[] = [];
  allCities: City[] = [];

  ngOnInit(): void {
    this.tableColumns.length = 0;
    this.tableColumns.push(...this.config.columns);
    this.loadDepartments();
    this.loadCities();
    this.loadItems();
  }

  private loadItems(): void {
    this.crudService
      .listCollection()
      .pipe(take(1))
      .subscribe((collection) => {
        this.collection.set(collection);
      });
  }

  private loadDepartments(): void {
    this.departmentService
      .listCollection()
      .pipe(take(1))
      .subscribe((collection) => {
        this.departments = collection.items;
        const currentOptions = this.selectOptions();
        this.selectOptions.set({
          ...currentOptions,
          id_department: this.departments.map(dept => ({
            label: dept.name,
            value: dept.id_department
          }))
        });
      });
  }

  private loadCities(): void {
    this.cityService
      .listCollection()
      .pipe(take(1))
      .subscribe((collection) => {
        this.allCities = collection.items;
        this.cities = this.allCities;
        const currentOptions = this.selectOptions();
        this.selectOptions.set({
          ...currentOptions,
          id_city: this.cities.map(city => ({
            label: city.name,
            value: city.id_city,
            id_department: city.id_department
          }))
        });
      });
  }

  openCreateForm(): void {
    this.editingCommune.set(null);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.editingCommune.set(null);
  }

  onTableAction(event: DataTableActionEvent<any>): void {
    const { actionId, row } = event;

    if (actionId === 'edit') {
      this.editingCommune.set(row);
      this.isFormOpen.set(true);
    } else if (actionId === 'delete') {
      this.onDelete(row);
    }
  }

  onFormSaved(commune: Commune): void {
    this.closeForm();
    this.loadItems();
  }

  onFormValueChanged(formValues: Record<string, any>): void {
    // Handle cascading select: filter cities based on selected department
    if (formValues['id_department'] !== undefined) {
      const selectedDepartmentId = formValues['id_department'];
      if (selectedDepartmentId) {
        this.cities = this.allCities.filter(city => city.id_department === selectedDepartmentId);
      } else {
        this.cities = this.allCities;
      }
      const currentOptions = this.selectOptions();
      this.selectOptions.set({
        ...currentOptions,
        id_city: this.cities.map(city => ({
          label: city.name,
          value: city.id_city,
          id_department: city.id_department
        }))
      });
    }
  }

  private async onDelete(commune: Commune): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: `¿Eliminar ${this.config.label}?`,
      message: `¿Deseas eliminar "${commune.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      // Validar dependencias de barrios
      const dependencies = await this.checkNeighborhoodDependencies(commune);
      if (dependencies.length > 0) {
        await this.showDependencyDetails(dependencies);
        return;
      }

      // Proceder con eliminación
      await this.crudService.delete(commune.id_commune).toPromise();
      this.toastService.success(`${this.config.label} eliminado correctamente`);
      this.loadItems();
    } catch (error) {
      this.toastService.danger('Error', `No se pudo eliminar el ${this.config.label.toLowerCase()}`);
      console.error(error);
    }
  }

  private async checkNeighborhoodDependencies(commune: Commune): Promise<any[]> {
    return new Promise((resolve) => {
      this.dependencyCheckService
        .search({ id_commune: String(commune.id_commune) })
        .pipe(take(1))
        .subscribe({
          next: (response) => {
            const items = Array.isArray(response) ? response : response.items || [];
            resolve(items);
          },
          error: () => resolve([])
        });
    });
  }

  private async showDependencyDetails(neighborhoods: any[]): Promise<void> {
    const message = [
      `No es posible eliminar esta comuna.`,
      '',
      'Barrios asociados:',
      ...neighborhoods.map(n => `  - ${n.name}`),
      '',
      'Elimina o reasigna los barrios antes de continuar.'
    ].join('\n');

    await this.confirmDialogService.confirm({
      title: 'No se puede eliminar',
      message,
      confirmText: 'Entendido',
      cancelText: 'Cancelar',
      tone: 'danger',
      showCancel: false
    });
  }
}
