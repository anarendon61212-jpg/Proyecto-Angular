import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { GenericCrudListComponent } from '@shared/components/generic-crud-list/generic-crud-list.component';
import { EntityCrudService, InterestedPartyCrudService, OfficialCrudService } from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';
import { DataTableActionEvent } from '@shared/components/data-table/data-table.component';

@Component({
  selector: 'app-entities-list-generic',
  standalone: true,
  imports: [GenericCrudListComponent],
  template: `
    <app-generic-crud-list
      [config]="config"
      [crudService]="crudService"
      [dependencyCheckService]="dependencyCheckService"
      [dependencyCheckServices]="dependencyCheckServices"
      [extraTableActions]="entityActions"
      (tableAction)="onEntityAction($event)"
    ></app-generic-crud-list>
  `
})
export class EntitiesListGenericComponent {
  private readonly router = inject(Router);
  readonly crudService = inject(EntityCrudService);
  readonly dependencyCheckService = inject(OfficialCrudService);
  private readonly interestedPartyService = inject(InterestedPartyCrudService);
  readonly config = getEntityConfig('entities');
  readonly dependencyCheckServices = {
    OfficialCrudService: this.dependencyCheckService,
    InterestedPartyCrudService: this.interestedPartyService
  };
  readonly entityActions = [
    { id: 'add-official', label: 'Agregar funcionario', icon: '+F' }
  ];

  onEntityAction(event: DataTableActionEvent<any>): void {
    if (event.actionId !== 'add-official') {
      return;
    }

    void this.router.navigate(['/admin/funcionarios'], {
      queryParams: {
        entityId: event.row.id_entity,
        entityName: event.row.name,
        create: 'true'
      }
    });
  }
}
