import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
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
  // FIX 1: Necesario para forzar re-render con OnPush después de operaciones async
  // (el bloque catch y el finally corren fuera del ciclo de detección de Angular,
  // por eso isSubmitting = false no se reflejaba en el template y el botón
  // se quedaba en "Guardando..." indefinidamente)
  private readonly cdr = inject(ChangeDetectorRef);
 
  @Input() config!: EntityConfig;
  @Input() crudService!: CrudResourceService<any>;
  @Input() item: any = null;
  @Input() selectOptions: Record<string, any[]> = {};
  @Input() fixedValues: Record<string, any> = {};
  @Input() hiddenFields: string[] = [];
 
  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() valueChanges = new EventEmitter<Record<string, any>>();
 
  form!: FormGroup;
  selectedFiles: Map<string, File> = new Map();
  previewUrls: Map<string, string> = new Map();
  isSubmitting = false;
  duplicateError = '';
 
  ngOnInit(): void {
    this.initForm();
    
    // Emit value changes for cascading select logic
    this.form.valueChanges.subscribe((value) => {
      this.valueChanges.emit(value);
    });
  }
 
  ngOnChanges(changes: SimpleChanges): void {
    if (this.form && changes['item']) {
      this.syncFormWithItem();
    }

    if (this.form && changes['selectOptions']) {
      this.normalizeSelectControls();
    }

    if (this.form && (changes['fixedValues'] || changes['hiddenFields'])) {
      this.syncFixedControls();
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
    this.syncFormWithItem();
    this.syncFixedControls();
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
    // FIX 1: Notificar a OnPush al inicio para que el botón muestre "Guardando..." correctamente
    this.cdr.markForCheck();
 
    let payload: Record<string, any> | FormData | null = null;
 
    try {
      const formValue = this.form.value;
 
      // Validación de duplicado solo en creación y solo si el config no la omite.
      // CU-02 FIX 1: Cuando skipDuplicateCheck=true (ej: Officials, donde la
      // unicidad es por email y no por name), se salta esta comprobación previa.
      // El backend siempre valida y, si falla, el catch de abajo muestra el
      // mensaje en duplicateError gracias al interceptor (FIX 2 del form).
      if (!this.item && this.config.searchEndpoint && !this.config.skipDuplicateCheck) {
        const nameField = this.config.fields.find((f) => f.key === 'name');
        if (nameField) {
          const isDuplicate = await this.checkDuplicate(formValue.name, this.config.searchEndpoint);
          if (isDuplicate) {
            this.duplicateError = `Ya existe un ${this.config.label.toLowerCase()} con este nombre`;
            this.isSubmitting = false;
            // FIX 1: Forzar re-render para que el banner de error aparezca con OnPush
            this.cdr.markForCheck();
            return;
          }
        }
      }
 
      const valueWithFixedFields = this.applyFixedValues(formValue);
      payload = this.config.hasFile ? this.buildFormData(valueWithFixedFields) : this.buildPayload(valueWithFixedFields);
      const result = await this.savePayload(payload);
      this.toastService.success(`${this.config.label} ${this.item ? 'actualizado' : 'creado'} correctamente`);
 
      this.saved.emit(result);
    } catch (error: any) {
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
 
      // FIX 2: Extraer el mensaje del backend correctamente.
      // El interceptor (api-error.interceptor.ts) normaliza el HttpErrorResponse a ApiError:
      // { status: number, message: string, details: unknown }
      // y lo relanza con throwError(), así que el catch recibe el ApiError normalizado.
      // El backend devuelve HTTP 400 con { "message": "El nombre de la entidad ya está registrado" }
      // que el interceptor mapea a ApiError.message.
      // extractBackendMessage() solo miraba error.error.message (estructura HttpErrorResponse cruda),
      // pero aquí ya llega el ApiError, donde el mensaje está en error.message directamente.
      const backendMessage = this.extractBackendMessage(error);
      const errorMessage = this.getSaveErrorMessage(error);
 
      // FIX 2: Si el backend responde con un 400, mostrar el mensaje en el banner del formulario
      // además del toast, para que sea visible sin cerrar el formulario.
      const status: number = (error as any)?.status ?? 0;
      if (status === 400 && backendMessage) {
        this.duplicateError = backendMessage;
      }
 
      this.toastService.danger('Error al guardar', errorMessage);
      console.error('[GenericCrudForm] Error al guardar:', error);
    } finally {
      this.isSubmitting = false;
      // FIX 1: Forzar re-render para que OnPush actualice el botón ("Guardando..." → "Crear")
      // y muestre el banner de error después de cualquier respuesta async
      this.cdr.markForCheck();
    }
  }
 
  onCancel(): void {
    this.cancelled.emit();
  }
 
  /**
   * FIX 2: checkDuplicate mejorado.
   *
   * El backend usa ILIKE %q% (búsqueda parcial por contenido).
   * Problema: si el nombre almacenado es "Alcaldía" y el usuario escribe
   * "Alcaldía de Manizales", el ILIKE busca registros cuyo name contenga
   * "Alcaldía de Manizales" — no los encuentra porque "Alcaldía" no contiene
   * esa cadena completa. Resultado: isDuplicate = false, el POST se ejecuta,
   * y el backend responde 400 que antes no se manejaba correctamente.
   *
   * Solución: buscar con la primera palabra del nombre (más probable que el
   * ILIKE devuelva coincidencias parciales), y luego aplicar comparación
   * exacta sobre los resultados. Si el search falla, dejar pasar el POST:
   * el backend tiene la validación definitiva (ahora manejada con FIX 2).
   */
  private checkDuplicate(name: string, endpoint: string): Promise<boolean> {
    // Usar la primera palabra para ampliar el rango del ILIKE
    const searchTerm = name.trim().split(' ')[0] || name.trim();
 
    return new Promise((resolve) => {
      this.crudService
        .search({ q: searchTerm })
        .pipe(take(1))
        .subscribe({
          next: (response) => {
            const items: any[] = Array.isArray(response) ? response : (response as any).items ?? [];
            const exists = items.some(
              (item: any) => item.name?.trim().toLowerCase() === name.trim().toLowerCase()
            );
            resolve(exists);
          },
          // Si el search falla, no bloqueamos: el backend validará al hacer POST
          // y el nuevo manejo de errores en el catch mostrará el mensaje correctamente
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

  private syncFormWithItem(): void {
    const formValues = this.config.fields.reduce<Record<string, any>>((acc, field) => {
      acc[field.key] = this.normalizeSelectValue(field, this.item?.[field.key] ?? '');
      return acc;
    }, {});

    this.form.reset(formValues, { emitEvent: false });
    this.duplicateError = '';
    this.selectedFiles.clear();
    this.previewUrls.clear();

    if (this.item && this.config.hasFile && this.config.fileField) {
      const fileField = this.config.fields.find((f) => f.key === this.config.fileField);
      const previewField = this.config.filePreviewField || `${this.config.fileField}_url`;
      if (fileField && this.item[previewField]) {
        this.previewUrls.set(this.config.fileField, this.item[previewField]);
      }
    }

    this.syncFixedControls();
    this.cdr.markForCheck();
  }

  private syncFixedControls(): void {
    if (this.item) {
      return;
    }

    Object.entries(this.fixedValues).forEach(([fieldKey, value]) => {
      const control = this.form.get(fieldKey);

      if (!control || control.value === value) {
        return;
      }

      control.setValue(value, { emitEvent: false });
      control.updateValueAndValidity({ emitEvent: false });
    });

    this.cdr.markForCheck();
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

  isFieldHidden(field: EntityFieldConfig): boolean {
    return !this.item && this.hiddenFields.includes(field.key);
  }
 
  getSelectOptions(field: EntityFieldConfig): any[] {
    return this.selectOptions[field.key] || field.options || [];
  }

  private applyFixedValues(formValue: Record<string, any>): Record<string, any> {
    return this.item ? formValue : { ...formValue, ...this.fixedValues };
  }
 
  private getSaveErrorMessage(error: unknown): string {
    const backendMessage = this.extractBackendMessage(error);
    const baseMessage = `No se pudo guardar el ${this.config.label.toLowerCase()}`;
 
    return backendMessage ? `${baseMessage}: ${backendMessage}` : baseMessage;
  }
 
  /**
   * FIX 2: extractBackendMessage mejorado.
   *
   * El interceptor api-error.interceptor.ts transforma el HttpErrorResponse en ApiError:
   *   { status: number, message: string, details: unknown }
   * y lo relanza. Por eso el catch recibe un objeto con .message directamente,
   * NO con .error.message (esa es la estructura del HttpErrorResponse crudo).
   *
   * La implementación original solo miraba error.error.message, perdiendo el
   * mensaje ya normalizado que viene en error.message del ApiError.
   *
   * Ahora se busca en ambos lugares con el orden correcto:
   *   1. error.message       → ApiError normalizado por el interceptor (caso más común)
   *   2. error.error.message → HttpErrorResponse crudo (fallback por si el interceptor no actuó)
   *   3. error.error         → body como string plano
   */
  private extractBackendMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return '';
    }
 
    const err = error as Record<string, any>;
 
    // Prioridad 1: mensaje ya normalizado por el interceptor (ApiError.message)
    if (typeof err['message'] === 'string' && err['message'] && err['message'] !== 'Unknown Error') {
      return err['message'];
    }
 
    // Prioridad 2: body del HttpErrorResponse crudo (error.error.message)
    const body = err['error'];
    if (body && typeof body === 'object') {
      const responseMessage = (body as Record<string, unknown>)['message'] ?? (body as Record<string, unknown>)['error'];
      return typeof responseMessage === 'string' ? responseMessage : '';
    }
 
    // Prioridad 3: body como string plano
    if (typeof body === 'string') {
      return body;
    }
 
    return '';
  }
}
