import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';

import { StatusBadgeComponent, StatusBadgeVariant } from '../status-badge/status-badge.component';

export type TableAlignment = 'left' | 'center' | 'right';
export type TableColumnType = 'text' | 'badge' | 'image';
export type TableActionTone = 'default' | 'danger' | 'muted';

export interface DataTableColumn<TItem = unknown> {
  key?: string;
  header: string;
  width?: string;
  align?: TableAlignment;
  type?: TableColumnType;
  emptyValue?: string;
  imageAltKey?: string;
  formatter?: (row: TItem) => string | number | null | undefined;
  badgeVariant?: (row: TItem) => StatusBadgeVariant;
}

export interface DataTableAction<TItem = unknown> {
  id: string;
  label: string;
  icon?: string;
  tone?: TableActionTone;
  hidden?: (row: TItem) => boolean;
  disabled?: (row: TItem) => boolean;
}

export interface DataTableActionEvent<TItem = unknown> {
  actionId: string;
  row: TItem;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<TItem extends object = Record<string, unknown>> {
  @Input() title = '';
  @Input() description = '';
  @Input() rows: TItem[] = [];
  @Input() columns: DataTableColumn<TItem>[] = [];
  @Input() actions: DataTableAction<TItem>[] = [];
  @Input() actionsTemplate: TemplateRef<unknown> | null = null;
  @Input() trackByKey?: string;

  @Output() actionClick = new EventEmitter<DataTableActionEvent<TItem>>();

  columnValue(row: TItem, column: DataTableColumn<TItem>): string {
    const rawValue = column.formatter ? column.formatter(row) : this.valueFromPath(row, column.key);
    return rawValue === null || rawValue === undefined || rawValue === ''
      ? column.emptyValue ?? '—'
      : String(rawValue);
  }

  imageValue(row: TItem, column: DataTableColumn<TItem>): string {
    const value = this.columnValue(row, column);

    if (value === (column.emptyValue ?? 'â€”')) {
      return '';
    }

    if (/^(https?:|data:|blob:|\/)/i.test(value)) {
      return value;
    }

    return `/${value}`;
  }

  imageAlt(row: TItem, column: DataTableColumn<TItem>): string {
    const altValue = this.valueFromPath(row, column.imageAltKey);
    return altValue ? `Logo de ${String(altValue)}` : column.header;
  }

  visibleActions(row: TItem): DataTableAction<TItem>[] {
    return this.actions.filter((action) => !action.hidden?.(row));
  }

  isActionDisabled(row: TItem, action: DataTableAction<TItem>): boolean {
    return Boolean(action.disabled?.(row));
  }

  emitAction(row: TItem, actionId: string): void {
    this.actionClick.emit({ actionId, row });
  }

  alignmentClass(align: TableAlignment = 'left'): string {
    return align === 'left' ? '' : `align-${align}`;
  }

  rowTrack(row: TItem, index: number): unknown {
    return this.trackByKey ? this.valueFromPath(row, this.trackByKey) ?? index : index;
  }

  columnTrack(column: DataTableColumn<TItem>): string {
    return column.key ?? column.header;
  }

  private valueFromPath(row: TItem, path?: string): unknown {
    if (!path) {
      return undefined;
    }

    return path.split('.').reduce<unknown>((currentValue, key) => {
      if (currentValue && typeof currentValue === 'object' && key in currentValue) {
        return (currentValue as Record<string, unknown>)[key];
      }

      return undefined;
    }, row);
  }
}
