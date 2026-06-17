import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom, take } from 'rxjs';

import { GenericCrudListComponent } from '@shared/components/generic-crud-list/generic-crud-list.component';
import { CategoryCrudService, AnnotationCategoryCrudService } from '@core/api/territorial-crud.services';
import { getEntityConfig } from '@core/config/entity-config';
import { CATEGORY_SEED_DEFINITIONS } from '@core/config/category-style.config';
import { Category, CategoryPayload } from '@core/models/territorial.models';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-categories-list-generic',
  standalone: true,
  imports: [CommonModule, GenericCrudListComponent],
  template: `
    <section class="app-card catalog-tools">
      <div>
        <h3>Catalogo base de anotaciones</h3>
        <p>Sincroniza categorias y subcategorias alineadas con la paleta oficial del mapa.</p>
      </div>
      <button
        type="button"
        class="app-button app-button--secondary"
        (click)="syncCategoryCatalog()"
        [disabled]="isSyncingCatalog()"
      >
        {{ isSyncingCatalog() ? 'Sincronizando...' : 'Sincronizar catalogo base' }}
      </button>
    </section>

    <app-generic-crud-list
      [config]="config"
      [crudService]="crudService"
      [selectOptions]="selectOptions()"
      [dependencyCheckServices]="dependencyCheckServices"
      (saved)="onCategorySaved()"
    ></app-generic-crud-list>
  `,
  styles: [
    `.catalog-tools { margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }`,
    `.catalog-tools h3 { margin: 0 0 0.25rem; font-size: 1.02rem; }`,
    `.catalog-tools p { margin: 0; color: var(--color-ink-muted, #6b7280); font-size: 0.9rem; }`,
    `@media (max-width: 900px) { .catalog-tools { flex-direction: column; align-items: flex-start; } }`
  ]
})
export class CategoriesListGenericComponent implements OnInit {
  readonly crudService = inject(CategoryCrudService);
  private readonly annotationCategoryService = inject(AnnotationCategoryCrudService);
  private readonly toastService = inject(ToastService);
  readonly config = getEntityConfig('categories');
  readonly selectOptions = signal<Record<string, any[]>>({});
  readonly isSyncingCatalog = signal(false);
  readonly dependencyCheckServices = {
    CategoryCrudService: this.crudService,
    AnnotationCategoryCrudService: this.annotationCategoryService
  };

  ngOnInit(): void {
    this.loadParentCategoryOptions();
  }

  onCategorySaved(): void {
    this.loadParentCategoryOptions();
  }

  async syncCategoryCatalog(): Promise<void> {
    if (this.isSyncingCatalog()) return;
    this.isSyncingCatalog.set(true);

    try {
      const collection = await firstValueFrom(this.crudService.listCollection().pipe(take(1)));
      const categories = collection.items as Category[];
      const byParentAndName = new Map<string, Category>();
      for (const category of categories) {
        byParentAndName.set(this.getCategoryKey(category.id_parent_category ?? null, category.name), category);
      }

      let createdParents = 0;
      let createdSubcategories = 0;
      const createCategory = async (payload: CategoryPayload): Promise<Category | null> => {
        try {
          const created = await firstValueFrom(this.crudService.create(payload).pipe(take(1)));
          byParentAndName.set(this.getCategoryKey(created.id_parent_category ?? null, created.name), created);
          return created;
        } catch {
          return null;
        }
      };

      for (const seedParent of CATEGORY_SEED_DEFINITIONS) {
        const parentKey = this.getCategoryKey(null, seedParent.name);
        let parent = byParentAndName.get(parentKey) ?? null;
        if (!parent) {
          parent = await createCategory({
            id_parent_category: null,
            name: seedParent.name,
            description: seedParent.description,
            status: 'active'
          });
          if (parent) {
            createdParents += 1;
          }
        }
        if (!parent) {
          continue;
        }

        for (const seedSubcategory of seedParent.subcategories) {
          const subKey = this.getCategoryKey(parent.id_category, seedSubcategory.name);
          if (byParentAndName.has(subKey)) {
            continue;
          }
          const createdSubcategory = await createCategory({
            id_parent_category: parent.id_category,
            name: seedSubcategory.name,
            description: seedSubcategory.description,
            status: 'active'
          });
          if (createdSubcategory) {
            createdSubcategories += 1;
          }
        }
      }

      this.toastService.success(
        'Catalogo sincronizado',
        `Creadas ${createdParents} categorias padre y ${createdSubcategories} subcategorias.`
      );
      this.loadParentCategoryOptions();
    } catch {
      this.toastService.danger('No disponible', 'No fue posible sincronizar el catalogo base.');
    } finally {
      this.isSyncingCatalog.set(false);
    }
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

  private getCategoryKey(parentId: number | null, name: string): string {
    return `${parentId ?? 0}|${name.trim().toLowerCase()}`;
  }
}
