import { Component, inject } from '@angular/core';

import { GenericCrudListComponent } from '@shared/components/generic-crud-list/generic-crud-list.component';
import { EntityCrudService, InterestedPartyCrudService, OfficialCrudService } from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';

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
    ></app-generic-crud-list>
  `
})
export class EntitiesListGenericComponent {
  readonly crudService = inject(EntityCrudService);
  readonly dependencyCheckService = inject(OfficialCrudService);
  private readonly interestedPartyService = inject(InterestedPartyCrudService);
  readonly config = getEntityConfig('entities');
  readonly dependencyCheckServices = {
    OfficialCrudService: this.dependencyCheckService,
    InterestedPartyCrudService: this.interestedPartyService
  };
}
