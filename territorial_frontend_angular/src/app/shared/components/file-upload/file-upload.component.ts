import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileUploadComponent {
  @Input() accept = 'image/png,image/jpeg,image/jpg,image/webp';
  @Input() multiple = false;
  @Input() maxSizeMb = 2;
  @Input() label = 'Arrastra y suelta archivos aquí';
  @Input() hint = 'o haz clic para seleccionar';

  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() invalidFiles = new EventEmitter<string[]>();

  isDragging = false;
  selectedFileNames: string[] = [];

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.handleFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    this.handleFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  private handleFiles(files: File[]): void {
    const acceptedFiles = this.multiple ? files : files.slice(0, 1);
    const maxBytes = this.maxSizeMb * 1024 * 1024;
    const invalidFileNames = acceptedFiles.filter((file) => file.size > maxBytes).map((file) => file.name);
    const validFiles = acceptedFiles.filter((file) => file.size <= maxBytes);

    if (invalidFileNames.length > 0) {
      this.invalidFiles.emit(invalidFileNames);
    }

    this.selectedFileNames = validFiles.map((file) => file.name);
    this.filesSelected.emit(validFiles);
  }
}
