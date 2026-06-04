import { Component, inject } from '@angular/core';

import { GenericCrudListComponent } from '@shared/components/generic-crud-list/generic-crud-list.component';
import { CategoryCrudService } from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';

@Component({
  selector: 'app-categories-list-generic',
  standalone: true,
  imports: [GenericCrudListComponent],
  template: `
    <app-generic-crud-list
      [config]="config"
      [crudService]="crudService"
    ></app-generic-crud-list>
  `
})
export class CategoriesListGenericComponent {
  readonly crudService = inject(CategoryCrudService);
  readonly config = getEntityConfig('categories');
}
