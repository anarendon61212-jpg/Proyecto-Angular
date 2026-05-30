import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-paginator',
  standalone: true,
  templateUrl: './paginator.component.html',
  styleUrl: './paginator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginatorComponent {
  @Input() page = 1;
  @Input() pageSize = 10;
  @Input() totalItems = 0;
  @Input() totalPages?: number;

  @Output() pageChange = new EventEmitter<number>();

  get totalPagesResolved(): number {
    return Math.max(1, this.totalPages ?? Math.ceil(this.totalItems / this.pageSize));
  }

  get fromItem(): number {
    if (this.totalItems === 0) {
      return 0;
    }

    return (this.page - 1) * this.pageSize + 1;
  }

  get toItem(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }

  get visiblePages(): number[] {
    const pageWindow = 5;
    const halfWindow = Math.floor(pageWindow / 2);
    const start = Math.max(1, Math.min(this.page - halfWindow, this.totalPagesResolved - pageWindow + 1));
    const end = Math.min(this.totalPagesResolved, start + pageWindow - 1);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  changePage(nextPage: number): void {
    const safePage = Math.min(Math.max(1, nextPage), this.totalPagesResolved);

    if (safePage !== this.page) {
      this.pageChange.emit(safePage);
    }
  }
}
