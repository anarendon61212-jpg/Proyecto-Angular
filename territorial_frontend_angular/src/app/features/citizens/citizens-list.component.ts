import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { CitizenCrudService } from '../../core/api/territorial-crud.services';
import { DataTableColumn } from '../../shared/components/data-table/data-table.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';

@Component({
  selector: 'app-citizens-list',
  standalone: true,
  imports: [CommonModule, DataTableComponent, PaginatorComponent],
  template: `
    <section class="app-card">
      <ng-container *ngIf="collection$ | async as collection">
        <app-data-table [title]="'Ciudadanos'" [rows]="collection.items" [columns]="columns"></app-data-table>

        <app-paginator [page]="collection.page" [pageSize]="collection.pageSize" [totalItems]="collection.totalItems"></app-paginator>
      </ng-container>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CitizensListComponent {
  private readonly service = inject(CitizenCrudService);

  readonly collection$: Observable<any> = this.service.listCollection();

  readonly columns: DataTableColumn[] = [
    { key: 'id_citizen', header: 'ID' },
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Email' }
  ];
}
