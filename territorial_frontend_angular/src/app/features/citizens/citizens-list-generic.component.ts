import { Component, inject } from '@angular/core';

import { GenericCrudListComponent } from '@shared/components/generic-crud-list/generic-crud-list.component';
import { CitizenCrudService } from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';

@Component({
  selector: 'app-citizens-list-generic',
  standalone: true,
  imports: [GenericCrudListComponent],
  template: `
    <app-generic-crud-list
      [config]="config"
      [crudService]="crudService"
    ></app-generic-crud-list>
  `
})
export class CitizensListGenericComponent {
  readonly crudService = inject(CitizenCrudService);
  readonly config = getEntityConfig('citizens');
}
