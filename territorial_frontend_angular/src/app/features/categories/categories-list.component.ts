import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CategoryCrudService } from '../../core/api/territorial-crud.services';
import { DataTableColumn } from '../../shared/components/data-table/data-table.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [CommonModule, DataTableComponent, PaginatorComponent],
  template: `
    <section class="app-card">
      <ng-container *ngIf="collection$ | async as collection">
        <app-data-table [title]="'Categorías'" [rows]="collection.items" [columns]="columns"></app-data-table>

        <app-paginator [page]="collection.page" [pageSize]="collection.pageSize" [totalItems]="collection.totalItems"></app-paginator>
      </ng-container>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesListComponent {
  private readonly service = inject(CategoryCrudService);

  readonly collection$: Observable<any> = this.service.listCollection();

  readonly columns: DataTableColumn[] = [
    { key: 'id_category', header: 'ID' },
    { key: 'name', header: 'Nombre' },
    { key: 'status', header: 'Estado' }
  ];
}
