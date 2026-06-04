import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';

import { CrudResourceService, ApiCollection } from '@core/api/crud-resource.service';
import { ToastService } from '@shared/services/toast.service';
import { FileUploadComponent } from '@shared/components/file-upload/file-upload.component';
import { EntityConfig, EntityFieldConfig, buildValidators } from '@core/config/entity-config';

@Component({
  selector: 'app-generic-crud-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FileUploadComponent],
  templateUrl: './generic-crud-form.component.html',
  styleUrl: './generic-crud-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GenericCrudFormComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly toastService = inject(ToastService);

  @Input() config!: EntityConfig;
  @Input() crudService!: CrudResourceService<any>;
  @Input() item: any = null;
  @Input() selectOptions: Record<string, any[]> = {};

  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  selectedFiles: Map<string, File> = new Map();
  previewUrls: Map<string, string> = new Map();
  isSubmitting = false;
  duplicateError = '';

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.form && changes['selectOptions']) {
      this.normalizeSelectControls();
    }
  }

  private initForm(): void {
    const group: Record<string, any> = {};

    this.config.fields.forEach((field) => {
      const validators = buildValidators(field);
      const value = this.normalizeSelectValue(field, this.item?.[field.key] ?? '');
      group[field.key] = [value, validators];
    });

    this.form = this.fb.group(group);

    if (this.item && this.config.hasFile && this.config.fileField) {
      const fileField = this.config.fields.find((f) => f.key === this.config.fileField);
      if (fileField && this.item[`${this.config.fileField}_url`]) {
        this.previewUrls.set(this.config.fileField, this.item[`${this.config.fileField}_url`]);
      }
    }
  }

  onFileSelected(files: File[], fieldKey: string): void {
    if (files.length > 0) {
      this.selectedFiles.set(fieldKey, files[0]);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrls.set(fieldKey, e.target?.result as string);
      };
      reader.readAsDataURL(files[0]);
    }
  }

  onInvalidFiles(fileNames: string[]): void {
    this.toastService.warning(
      'Archivos rechazados',
      `${fileNames.join(', ')} exceden el tamaño máximo de 2 MB`
    );
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.duplicateError = '';
    let payload: Record<string, any> | FormData | null = null;

    try {
      const formValue = this.form.value;

      // Validación de duplicado solo en creación
      if (!this.item && this.config.searchEndpoint) {
        const nameField = this.config.fields.find((f) => f.key === 'name');
        if (nameField) {
          const isDuplicate = await this.checkDuplicate(formValue.name, this.config.searchEndpoint);
          if (isDuplicate) {
            this.duplicateError = `Ya existe un ${this.config.label.toLowerCase()} con este nombre`;
            this.isSubmitting = false;
            return;
          }
        }
      }

      payload = this.config.hasFile ? this.buildFormData(formValue) : this.buildPayload(formValue);
      const result = await this.savePayload(payload);
      this.toastService.success(`${this.config.label} ${this.item ? 'actualizado' : 'creado'} correctamente`);

      this.saved.emit(result);
    } catch (error) {
      const fallbackPayload = this.buildUnsupportedFieldFallbackPayload(error, payload);
      if (fallbackPayload) {
        try {
          const result = await this.savePayload(fallbackPayload);
          this.toastService.warning('Guardado parcial', this.config.unsupportedFieldFallback?.warningMessage ?? '');
          this.saved.emit(result);
          return;
        } catch (fallbackError) {
          this.toastService.danger('Error', this.getSaveErrorMessage(fallbackError));
          console.error(fallbackError);
          return;
        }
      }

      this.toastService.danger('Error', this.getSaveErrorMessage(error));
      console.error(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  private checkDuplicate(name: string, endpoint: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.crudService
        .search({ q: name })
        .pipe(take(1))
        .subscribe({
          next: (response) => {
            const items = Array.isArray(response) ? response : (response as any).items || [];
            resolve(items.some((item: any) => item.name?.toLowerCase() === name.toLowerCase()));
          },
          error: () => resolve(false)
        });
    });
  }

  private buildFormData(formValue: any): FormData {
    const formData = new FormData();

    this.config.fields.forEach((field) => {
      if (field.type === 'file') {
        const file = this.selectedFiles.get(field.key);
        if (file) {
          formData.append(field.key, file);
        }
      } else {
        const value = formValue[field.key];
        if (value !== null && value !== undefined && value !== '') {
          formData.append(field.key, String(value));
        }
      }
    });

    return formData;
  }

  private buildPayload(formValue: any): Record<string, any> {
    const payload: Record<string, any> = {};

    this.config.fields.forEach((field) => {
      if (field.type === 'file') {
        return;
      }

      const value = formValue[field.key];
      if (value !== null && value !== undefined && value !== '') {
        payload[field.key] = value;
      }
    });

    return payload;
  }

  private savePayload(payload: Record<string, any> | FormData): Promise<any> {
    if (this.item) {
      const idValue = this.item[this.config.idField];
      return this.config.hasFile
        ? this.crudService.updateForm(idValue, payload as FormData).toPromise()
        : this.crudService.update(idValue, payload).toPromise();
    }

    return this.config.hasFile
      ? this.crudService.createForm(payload as FormData).toPromise()
      : this.crudService.create(payload).toPromise();
  }

  private buildUnsupportedFieldFallbackPayload(
    error: unknown,
    payload: Record<string, any> | FormData | null
  ): Record<string, any> | FormData | null {
    const fallback = this.config.unsupportedFieldFallback;
    if (!fallback || !payload || !this.isUnsupportedFieldError(error, fallback.fields)) {
      return null;
    }

    if (payload instanceof FormData) {
      const sanitized = new FormData();
      payload.forEach((value, key) => {
        if (!fallback.fields.includes(key)) {
          sanitized.append(key, value);
        }
      });
      return sanitized;
    }

    return Object.entries(payload).reduce<Record<string, any>>((sanitized, [key, value]) => {
      if (!fallback.fields.includes(key)) {
        sanitized[key] = value;
      }
      return sanitized;
    }, {});
  }

  private isUnsupportedFieldError(error: unknown, fields: string[]): boolean {
    const message = this.extractBackendMessage(error).toLowerCase();
    return message.includes('invalid keyword argument') && fields.some((field) => message.includes(field.toLowerCase()));
  }

  private normalizeSelectControls(): void {
    this.config.fields
      .filter((field) => field.type === 'select')
      .forEach((field) => {
        const control = this.form.get(field.key);
        if (!control) {
          return;
        }

        const normalizedValue = this.normalizeSelectValue(field, control.value);
        if (normalizedValue !== control.value) {
          control.setValue(normalizedValue);
        }
      });
  }

  private normalizeSelectValue(field: EntityFieldConfig, value: any): any {
    if (field.type !== 'select' || value === null || value === undefined || value === '') {
      return value;
    }

    const matchingOption = this.getSelectOptions(field).find((option) => String(option.value) === String(value));
    return matchingOption ? matchingOption.value : value;
  }

  getFieldError(fieldKey: string): string {
    const control = this.form.get(fieldKey);
    const field = this.config.fields.find((f) => f.key === fieldKey);

    if (!field || !control?.invalid || !control.touched) {
      return '';
    }

    if (control.hasError('required')) return `${field.label} es requerido`;
    if (control.hasError('minlength')) return `Mínimo ${field.minLength} caracteres`;
    if (control.hasError('email')) return 'Correo inválido';
    if (control.hasError('pattern')) return `${field.label} tiene un formato inválido`;

    return '';
  }

  isFieldRequired(field: EntityFieldConfig): boolean {
    return field.required;
  }

  getSelectOptions(field: EntityFieldConfig): any[] {
    return this.selectOptions[field.key] || field.options || [];
  }

  private getSaveErrorMessage(error: unknown): string {
    const backendMessage = this.extractBackendMessage(error);
    const baseMessage = `No se pudo guardar el ${this.config.label.toLowerCase()}`;

    return backendMessage ? `${baseMessage}: ${backendMessage}` : baseMessage;
  }

  private extractBackendMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const httpError = error as { error?: unknown; message?: unknown };
    const body = httpError.error;

    if (body && typeof body === 'object') {
      const responseMessage = (body as { message?: unknown; error?: unknown }).message
        ?? (body as { error?: unknown }).error;
      return typeof responseMessage === 'string' ? responseMessage : '';
    }

    if (typeof body === 'string') {
      return body;
    }

    return typeof httpError.message === 'string' ? httpError.message : '';
  }
}
