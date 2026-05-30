import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { NeighborhoodCrudService } from '../../core/api/territorial-crud.services';
import { DataTableColumn } from '../../shared/components/data-table/data-table.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';

@Component({
  selector: 'app-neighborhoods-list',
  standalone: true,
  imports: [CommonModule, DataTableComponent, PaginatorComponent],
  template: `
    <section class="app-card">
      <ng-container *ngIf="collection$ | async as collection">
        <app-data-table [title]="'Barrios'" [rows]="collection.items" [columns]="columns"></app-data-table>

        <app-paginator [page]="collection.page" [pageSize]="collection.pageSize" [totalItems]="collection.totalItems"></app-paginator>
      </ng-container>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NeighborhoodsListComponent {
  private readonly service = inject(NeighborhoodCrudService);

  readonly collection$: Observable<any> = this.service.listCollection();

  readonly columns: DataTableColumn[] = [
    { key: 'id_neighborhood', header: 'ID' },
    { key: 'name', header: 'Nombre' },
    { key: 'status', header: 'Estado' }
  ];
}
