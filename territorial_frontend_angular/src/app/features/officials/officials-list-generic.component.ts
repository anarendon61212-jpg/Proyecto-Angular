import { AfterViewInit, Component, ViewChild, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { take } from 'rxjs';
 
import { GenericCrudListComponent } from '@shared/components/generic-crud-list/generic-crud-list.component';
import {
  OfficialCrudService,
  EntityCrudService
} from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';
import { DataTableAction, DataTableActionEvent } from '@shared/components/data-table/data-table.component';
 
/**
 * CU-02 Gestionar Funcionarios
 *
 * Orquesta la pantalla de funcionarios:
 *   - Carga las entidades disponibles para el select dinámico (id_entity).
 *   - La protección de borrado por dependencias la maneja el propio backend:
 *     si hay FK violation devuelve HTTP 400 y el interceptor lo muestra en el toast.
 *     El modelo Annotation no expone id_official, así que no hay dependencyChecks
 *     para verificar en frontend.
 */
@Component({
  selector: 'app-officials-list-generic',
  standalone: true,
  imports: [GenericCrudListComponent],
  template: `
    @if (selectedEntityName()) {
      <section class="official-context app-card">
        <div>
          <p class="official-context__eyebrow">Nueva asignación</p>
          <h2>Funcionario para {{ selectedEntityName() }}</h2>
          <p>La entidad ya está seleccionada desde el módulo de entidades.</p>
        </div>
      </section>
    }

    <app-generic-crud-list
      #crudList
      [config]="config"
      [crudService]="crudService"
      [selectOptions]="selectOptions()"
      [fixedValues]="fixedValues()"
      [hiddenFields]="hiddenFields()"
      [extraTableActions]="officialActions"
      [autoRefreshMs]="15000"
      (tableAction)="onOfficialAction($event)"
    ></app-generic-crud-list>
  `,
  styles: [`
    .official-context {
      margin-bottom: 1rem;
      padding: 1.25rem;
    }

    .official-context h2,
    .official-context p {
      margin: 0;
    }

    .official-context h2 {
      font-size: 1.2rem;
      margin-bottom: 0.35rem;
    }

    .official-context p {
      color: var(--color-muted);
    }

    .official-context__eyebrow {
      color: var(--color-primary);
      font-size: 0.76rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      margin: 0 0 0.35rem;
      text-transform: uppercase;
    }
  `]
})
export class OfficialsListGenericComponent implements OnInit, AfterViewInit {
  @ViewChild(GenericCrudListComponent) private readonly crudList?: GenericCrudListComponent;

  readonly crudService = inject(OfficialCrudService);
  private readonly entityService = inject(EntityCrudService);
  private readonly route = inject(ActivatedRoute);
 
  readonly config = getEntityConfig('officials');
  readonly selectOptions = signal<Record<string, any[]>>({});
  readonly selectedEntityId = signal<number | null>(null);
  readonly selectedEntityName = signal<string | null>(null);
  readonly fixedValues = computed(() => {
    const entityId = this.selectedEntityId();
    return entityId ? { id_entity: entityId } : {};
  });
  readonly hiddenFields = computed(() => this.selectedEntityId() ? ['id_entity'] : []);
  readonly officialActions: DataTableAction<any>[] = [
    { id: 'view', label: 'Visualizar funcionario', icon: 'eye-outline' }
  ];
 
  ngOnInit(): void {
    const entityId = Number(this.route.snapshot.queryParamMap.get('entityId') || 0);
    const entityName = this.route.snapshot.queryParamMap.get('entityName');
    this.selectedEntityId.set(entityId || null);
    this.selectedEntityName.set(entityName || null);
    this.loadEntityOptions();
  }

  ngAfterViewInit(): void {
    if (this.route.snapshot.queryParamMap.get('create') === 'true' && this.selectedEntityId()) {
      queueMicrotask(() => this.crudList?.openCreateForm());
    }
  }

  onOfficialAction(event: DataTableActionEvent<any>): void {
    if (event.actionId !== 'view') {
      return;
    }
    this.crudList?.openEditForm(event.row);
  }
 
  private loadEntityOptions(): void {
    this.entityService
      .list()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const entities = Array.isArray(response) ? response : (response as any).items || [];
          this.selectOptions.set({
            id_entity: entities.map((e: any) => ({
              label: e.name,
              value: e.id_entity
            }))
          });
        },
        error: (err) => console.error('[OfficialsListGeneric] Error cargando entidades:', err)
      });
  }
}
 
