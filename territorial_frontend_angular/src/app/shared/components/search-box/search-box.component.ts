import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-search-box',
  standalone: true,
  templateUrl: './search-box.component.html',
  styleUrl: './search-box.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchBoxComponent {
  @Input() value = '';
  @Input() placeholder = 'Buscar...';
  @Input() ariaLabel = 'Buscar';

  @Output() valueChange = new EventEmitter<string>();
  @Output() submitted = new EventEmitter<string>();
  @Output() cleared = new EventEmitter<void>();

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.valueChange.emit(input.value);
  }

  submit(): void {
    this.submitted.emit(this.value);
  }

  clear(): void {
    this.valueChange.emit('');
    this.cleared.emit();
  }
}
