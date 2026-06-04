import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit, inject, signal } from '@angular/core';
import { take } from 'rxjs';

import { CrudResourceService, ApiCollection } from '@core/api/crud-resource.service';
import { DataTableColumn, DataTableComponent, DataTableActionEvent } from '@shared/components/data-table/data-table.component';
import { PaginatorComponent } from '@shared/components/paginator/paginator.component';
import { DrawerPanelComponent } from '@shared/components/drawer-panel/drawer-panel.component';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { ToastService } from '@shared/services/toast.service';
import { GenericCrudFormComponent } from '@shared/components/generic-crud-form/generic-crud-form.component';
import { DependencyCheck, EntityConfig } from '@core/config/entity-config';

export interface DependencyCheckService {
  search(params: any): any;
}

interface DependencyCheckResult {
  check: DependencyCheck;
  items: any[];
}

@Component({
  selector: 'app-generic-crud-list',
  standalone: true,
  imports: [
    CommonModule,
    DataTableComponent,
    PaginatorComponent,
    DrawerPanelComponent,
    GenericCrudFormComponent
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
      [title]="editingItem() ? 'Editar ' + config.label : 'Nuevo ' + config.label"
      [description]="editingItem() ? 'Modifica los datos del ' + config.label.toLowerCase() : 'Crea un nuevo ' + config.label.toLowerCase()"
      size="md"
      (closed)="closeForm()"
    >
      <app-generic-crud-form
        [config]="config"
        [crudService]="crudService"
        [item]="editingItem()"
        [selectOptions]="formSelectOptions()"
        (saved)="onFormSaved($event)"
        (cancelled)="closeForm()"
      ></app-generic-crud-form>
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
export class GenericCrudListComponent implements OnInit {
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly toastService = inject(ToastService);

  @Input() config!: EntityConfig;
  @Input() crudService!: CrudResourceService<any>;
  @Input() dependencyCheckService?: DependencyCheckService;
  @Input() dependencyCheckServices: Record<string, DependencyCheckService> = {};
  @Input() set selectOptions(options: Record<string, any[]> | null | undefined) {
    this.formSelectOptions.set(options ?? {});
  }

  readonly collection = signal<ApiCollection<any> | null>(null);
  readonly isFormOpen = signal(false);
  readonly editingItem = signal<any | null>(null);
  readonly formSelectOptions = signal<Record<string, any[]>>({});

  readonly tableColumns: DataTableColumn[] = [];
  readonly tableActions = [
    { id: 'edit', label: 'Editar', icon: '✎' },
    { id: 'delete', label: 'Eliminar', icon: '🗑', tone: 'danger' as const }
  ];

  ngOnInit(): void {
    this.tableColumns.length = 0;
    this.tableColumns.push(...this.config.columns);
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

  openCreateForm(): void {
    this.editingItem.set(null);
    this.isFormOpen.set(true);
  }

  closeForm(): void {
    this.isFormOpen.set(false);
    this.editingItem.set(null);
  }

  onTableAction(event: DataTableActionEvent<any>): void {
    const { actionId, row } = event;

    if (actionId === 'edit') {
      this.editingItem.set(row);
      this.isFormOpen.set(true);
    } else if (actionId === 'delete') {
      this.onDelete(row);
    }
  }

  onFormSaved(item: any): void {
    this.closeForm();
    this.loadItems();
  }

  private async onDelete(item: any): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm({
      title: `¿Eliminar ${this.config.label}?`,
      message: `¿Deseas eliminar "${item.name}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
      cancelText: 'Cancelar',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      // Validar dependencias si está configurado
      if (this.hasDependencyChecks()) {
        const dependencies = await this.checkDependencies(item);
        const dependencyCount = dependencies.reduce((total, result) => total + result.items.length, 0);
        if (dependencyCount > 0) {
          await this.showDependencyDetails(dependencies);
          return;
        }
      }

      // Proceder con eliminación
      const idValue = item[this.config.idField];
      await this.crudService.delete(idValue).toPromise();
      this.toastService.success(`${this.config.label} eliminado correctamente`);
      this.loadItems();
    } catch (error) {
      this.toastService.danger('Error', `No se pudo eliminar el ${this.config.label.toLowerCase()}`);
      console.error(error);
    }
  }

  private hasDependencyChecks(): boolean {
    return this.getDependencyChecks().some((check) => this.getDependencyService(check));
  }

  private getDependencyChecks(): DependencyCheck[] {
    if (this.config.dependencyChecks?.length) {
      return this.config.dependencyChecks;
    }

    return this.config.dependencyCheck ? [this.config.dependencyCheck] : [];
  }

  private getDependencyService(check: DependencyCheck): DependencyCheckService | undefined {
    return this.dependencyCheckServices[check.service] ?? this.dependencyCheckService;
  }

  private async checkDependencies(item: any): Promise<DependencyCheckResult[]> {
    const checks = this.getDependencyChecks();
    const results = await Promise.all(checks.map((check) => this.runDependencyCheck(check, item)));

    return results.filter((result) => result.items.length > 0);
  }

  private runDependencyCheck(check: DependencyCheck, item: any): Promise<DependencyCheckResult> {
    return new Promise((resolve) => {
      const service = this.getDependencyService(check);
      if (!service) {
        resolve({ check, items: [] });
        return;
      }

      const params = {
        [check.paramField]: String(item[this.config.idField])
      };

      service
        .search(params)
        .pipe(take(1))
        .subscribe({
          next: (response: any) => {
            const items = Array.isArray(response) ? response : response.items || [];
            resolve({ check, items });
          },
          error: () => resolve({ check, items: [] })
        });
    });
  }

  private async showDependencyDetails(results: DependencyCheckResult[]): Promise<void> {
    const message = [
      `No es posible eliminar este ${this.config.label.toLowerCase()}.`,
      '',
      ...results.flatMap((result) => [
        `${this.getDependencyTitle(result.check)}:`,
        ...result.items.map((dependency) => `  - ${this.getDependencyItemLabel(dependency)}`),
        ''
      ]),
      'Resuelve estas dependencias antes de continuar.'
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

  private getDependencyTitle(check: DependencyCheck): string {
    const title = check.warningMessage
      .replace(/^Existen\s+/i, '')
      .replace(/\s+a\s+esta\s+entidad$/i, '');

    return title.charAt(0).toUpperCase() + title.slice(1);
  }

  private getDependencyItemLabel(item: any): string {
    if (item.name) return item.name;
    if (item.full_name) return item.full_name;
    if (item.email) return item.email;
    if (item.id_interested_party) {
      const annotation = item.id_annotation ? ` (anotacion #${item.id_annotation})` : '';
      return `Interesado #${item.id_interested_party}${annotation}`;
    }
    if (item.id_official) return `Funcionario #${item.id_official}`;
    if (item.id) return `Registro #${item.id}`;

    return 'Registro dependiente';
  }
}
