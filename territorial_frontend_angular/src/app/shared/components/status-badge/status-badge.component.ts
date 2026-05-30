import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type StatusBadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'neutral';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBadgeComponent {
  @Input() value = '';
  @Input() emptyValue = 'Sin estado';
  @Input() variant?: StatusBadgeVariant;

  get variantClass(): string {
    return `status-badge--${this.variant ?? this.variantFromValue(this.value)}`;
  }

  private variantFromValue(value: string): StatusBadgeVariant {
    const normalizedValue = value.trim().toLowerCase();

    if (['activa', 'activo', 'active', 'en línea', 'online', 'ok'].includes(normalizedValue)) {
      return 'success';
    }

    if (['inactiva', 'inactivo', 'inactive', 'sin conexión', 'offline', 'error'].includes(normalizedValue)) {
      return 'neutral';
    }

    if (['pendiente', 'pending', 'advertencia'].includes(normalizedValue)) {
      return 'warning';
    }

    if (['eliminada', 'eliminado', 'bloqueada', 'bloqueado'].includes(normalizedValue)) {
      return 'danger';
    }

    return 'info';
  }
}
