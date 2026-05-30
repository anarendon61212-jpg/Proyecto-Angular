import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type DrawerPanelSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-drawer-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './drawer-panel.component.html',
  styleUrl: './drawer-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawerPanelComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() description = '';
  @Input() size: DrawerPanelSize = 'md';
  @Input() showCloseButton = true;
  @Input() showFooter = true;

  @Output() closed = new EventEmitter<void>();

  closePanel(): void {
    this.closed.emit();
  }
}
