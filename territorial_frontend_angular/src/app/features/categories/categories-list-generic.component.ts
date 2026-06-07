import { Component, inject, OnInit, signal } from '@angular/core';
import { take } from 'rxjs';

import { GenericCrudListComponent } from '@shared/components/generic-crud-list/generic-crud-list.component';
import { CategoryCrudService, AnnotationCategoryCrudService } from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';

@Component({
  selector: 'app-categories-list-generic',
  standalone: true,
  imports: [GenericCrudListComponent],
  template: `
    <app-generic-crud-list
      [config]="config"
      [crudService]="crudService"
      [selectOptions]="selectOptions()"
      [dependencyCheckServices]="dependencyCheckServices"
    ></app-generic-crud-list>
  `
})
export class CategoriesListGenericComponent implements OnInit {
  readonly crudService = inject(CategoryCrudService);
  private readonly annotationCategoryService = inject(AnnotationCategoryCrudService);
  readonly config = getEntityConfig('categories');
  readonly selectOptions = signal<Record<string, any[]>>({});
  readonly dependencyCheckServices = {
    CategoryCrudService: this.crudService,
    AnnotationCategoryCrudService: this.annotationCategoryService
  };

  ngOnInit(): void {
    this.loadParentCategoryOptions();
  }

  private loadParentCategoryOptions(): void {
    this.crudService
      .list()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          const categories = Array.isArray(response) ? response : response.items || [];
          this.selectOptions.set({
            id_parent_category: categories.map((c: any) => ({
              label: c.name,
              value: c.id_category
            }))
          });
        },
        error: (err) => console.error('Error loading parent categories:', err)
      });
  }
}
