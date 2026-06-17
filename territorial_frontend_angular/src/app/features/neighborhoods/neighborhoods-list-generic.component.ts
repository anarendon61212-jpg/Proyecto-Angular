import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';

import { Neighborhood, Commune } from '@core/models/territorial.models';
import { NeighborhoodCrudService, CommuneCrudService, PointCrudService, AnnotationCrudService } from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';
import { DataTableColumn, DataTableActionEvent } from '@shared/components/data-table/data-table.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { PaginatorComponent } from '@shared/components/paginator/paginator.component';
import { DrawerPanelComponent } from '@shared/components/drawer-panel/drawer-panel.component';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { ToastService } from '@shared/services/toast.service';
import { NeighborhoodsFormComponent } from './neighborhoods-form.component';

@Component({
  selector: 'app-neighborhoods-list-generic',
  standalone: true,
  imports: [
    CommonModule,
    DataTableComponent,
    PaginatorComponent,
    DrawerPanelComponent,
    NeighborhoodsFormComponent
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
      [title]="editingNeighborhood() ? 'Editar ' + config.label : 'Nuevo ' + config.label"
      [description]="editingNeighborhood() ? 'Modifica los datos del ' + config.label.toLowerCase() : 'Crea un nuevo ' + config.label.toLowerCase()"
      size="md"
      (closed)="closeForm()"
    >
      <app-neighborhoods-form
        [config]="config"
        [neighborhood]="editingNeighborhood()"
        [selectOptions]="selectOptions()"
        (saved)="onFormSaved($event)"
        (cancelled)="closeForm()"
      ></app-neighborhoods-form>
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
export class NeighborhoodsListGenericComponent implements OnInit {
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);
  readonly crudService = inject(NeighborhoodCrudService);
  readonly dependencyCheckServices: Record<string, any> = {
    PointCrudService: inject(PointCrudService),
    AnnotationCrudService: inject(AnnotationCrudService)
  };
  readonly communeService = inject(CommuneCrudService);

  readonly config = getEntityConfig('neighborhoods');

  readonly collection = signal<any>(null);
  readonly isFormOpen = signal(false);
  readonly editingNeighborhood = signal<Neighborhood | null>(null);
  readonly selectOptions = signal<Record<string, any[]>>({});

  readonly tableColumns: DataTableColumn[] = [];
  readonly tableActions = [
    { id: 'edit', label: 'Editar', icon: '✎' },
    { id: 'delete', label: 'Eliminar', icon: '🗑', tone: 'danger' as const }
  ];

  communes: Commune[] = [];

  ngOnInit(): void {
    this.tableColumns.length = 0;
    this.tableColumns.push(...this.config.columns);
    this.loadCommunes();
    this.loadItems();
  }

  private loadCommunes(): void {
    this.communeService.listCollection().pipe(take(1)).subscribe({
      next: (collection: any) => {
        this.communes = collection.items;
        const currentOptions = this.selectOptions();
        this.selectOptions.set({
          ...currentOptions,
          id_commune: this.communes.map((commune: Commune) => ({
            label: commune.name,
            value: commune.id_commune
          }))
        });
      },
      error: (error: any) => {
        console.error('[NeighborhoodsList] Error loading communes:', error);
        this.toastService.danger('Error', 'No se pudieron cargar las comunas');
      }
    });
  }

  private loadItems(): void {
    this.crudService.listCollection().pipe(take(1)).subscribe({
      next: (collection: any) => {
        // Agregar nombre de la comuna a cada barrio
        const itemsWithCommuneName = collection.items.map((neighborhood: Neighborhood) => ({
          ...neighborhood,
          commune_name: this.getCommuneName(neighborhood.id_commune)
        }));
        this.collection.set({ ...collection, items: itemsWithCommuneName });
      },
      error: (error: any) => {
        console.error('[NeighborhoodsList] Error loading items:', error);
        this.toastService.danger('Error', 'No se pudieron cargar los barrios');
      }
    });
  }

  private getCommuneName(idCommune: number): string {
    const commune = this.communes.find(c => c.id_commune === idCommune);
    return commune ? commune.name : '—';
  }

  openCreateForm(): void {
    this.editingNeighborhood.set(null);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.editingNeighborhood.set(null);
  }

  onTableAction(event: DataTableActionEvent<any>): void {
    const { actionId, row } = event;

    if (actionId === 'edit') {
      this.editingNeighborhood.set(row);
      this.isFormOpen.set(true);
    } else if (actionId === 'delete') {
      this.onDelete(row);
    }
  }

  async onDelete(neighborhood: Neighborhood): Promise<void> {
    if (!this.config.dependencyChecks || this.config.dependencyChecks.length === 0) {
      await this.performDelete(neighborhood);
      return;
    }

    // CU-06 E2, E2a: Verificar dependencias antes de eliminar
    const dependencyResults = await this.checkDependencies(neighborhood);
    const hasDependencies = dependencyResults.some(result => result.hasDependencies);

    if (hasDependencies) {
      const messages = dependencyResults
        .filter(result => result.hasDependencies)
        .map(result => result.message)
        .join('\n');

      this.toastService.warning('No se puede eliminar', messages);
      return;
    }

    await this.performDelete(neighborhood);
  }

  private async checkDependencies(neighborhood: Neighborhood): Promise<{ hasDependencies: boolean; message: string }[]> {
    const results: { hasDependencies: boolean; message: string }[] = [];

    if (!this.config.dependencyChecks) {
      return results;
    }

    for (const check of this.config.dependencyChecks) {
      try {
        const service = this.dependencyCheckServices[check.service];
        if (!service) {
          results.push({ hasDependencies: false, message: '' });
          continue;
        }

        const neighborhoodId = neighborhood[this.config.idField as keyof Neighborhood] as number;
        
        // Validar que el ID del barrio sea válido antes de hacer la búsqueda
        if (!neighborhoodId || neighborhoodId <= 0) {
          results.push({ hasDependencies: false, message: '' });
          continue;
        }

        const filterParam = { [check.paramField]: neighborhoodId };

        const hasDependencies = await service
          .listCollection(filterParam)
          .pipe(take(1))
          .toPromise()
          .then((collection: any) => collection.items && collection.items.length > 0);

        if (hasDependencies) {
          const dependentItems = await service
            .listCollection(filterParam)
            .pipe(take(1))
            .toPromise()
            .then((collection: any) => collection.items || []);

          // Filtrar solo items que realmente tienen el ID del barrio correcto
          const trulyDependentItems = dependentItems.filter((item: any) => {
            const itemId = item[check.paramField];
            return itemId === neighborhoodId;
          });

          const itemsList = trulyDependentItems.map((item: any) => item.name || item.description || item.id).join(', ');

          // Solo agregar mensaje si hay items dependientes reales
          if (itemsList && itemsList.trim() !== '') {
            const message = `${check.warningMessage}: ${itemsList}`;
            results.push({ hasDependencies: true, message });
          } else {
            results.push({ hasDependencies: false, message: '' });
          }
        } else {
          results.push({ hasDependencies: false, message: '' });
        }
      } catch (error: any) {
        console.error('[NeighborhoodsList] Error checking dependencies:', error);
        results.push({ hasDependencies: false, message: '' });
      }
    }

    return results;
  }

  private async performDelete(neighborhood: Neighborhood): Promise<void> {
    try {
      await this.crudService.delete(neighborhood.id_neighborhood).toPromise();
      this.toastService.success('Barrio eliminado correctamente');
      this.loadItems();
    } catch (error: any) {
      console.error('[NeighborhoodsList] Error deleting neighborhood:', error);
      this.toastService.danger('Error', 'No se pudo eliminar el barrio');
    }
  }

  onFormSaved(neighborhood: Neighborhood): void {
    this.closeForm();
    this.loadItems();
  }
}
