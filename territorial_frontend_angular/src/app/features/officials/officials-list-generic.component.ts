import { Component, inject, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';

import { GenericCrudListComponent } from '@shared/components/generic-crud-list/generic-crud-list.component';
import { OfficialCrudService, EntityCrudService } from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';

@Component({
  selector: 'app-officials-list-generic',
  standalone: true,
  imports: [GenericCrudListComponent],
  template: `
    <app-generic-crud-list
      [config]="config"
      [crudService]="crudService"
      [selectOptions]="selectOptions()"
    ></app-generic-crud-list>
  `
})
export class OfficialsListGenericComponent implements OnInit {
  readonly crudService = inject(OfficialCrudService);
  readonly entityService = inject(EntityCrudService);
  readonly config = getEntityConfig('officials');
  readonly selectOptions = signal<Record<string, any[]>>({});

  ngOnInit(): void {
    this.loadEntityOptions();
  }

  private loadEntityOptions(): void {
    this.entityService
      .list()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const entities = Array.isArray(response) ? response : response.items || [];
          this.selectOptions.set({
            id_entity: entities.map((e: any) => ({
              label: e.name,
              value: e.id_entity
            }))
          });
        },
        error: (err) => console.error('Error loading entities for officials:', err)
      });
  }
}
