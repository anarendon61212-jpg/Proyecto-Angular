import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  OnInit
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { take } from 'rxjs';

import { Neighborhood, NeighborhoodPayload } from '@core/models/territorial.models';
import { NeighborhoodCrudService } from '@core/api/territorial-crud.services';
import { ToastService } from '@shared/services/toast.service';
import { EntityConfig, buildValidators } from '@core/config/entity-config';

@Component({
  selector: 'app-neighborhoods-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="generic-form">
      @if (duplicateError) {
        <div class="error-banner">
          {{ duplicateError }}
        </div>
      }

      @for (field of config.fields; track field.key) {
        @if (field.type !== 'file') {
          <div class="form-group">
            <label [for]="field.key">
              {{ field.label }}
              @if (isFieldRequired(field)) {
                <span class="required">*</span>
              }
            </label>

            @switch (field.type) {
              @case ('text') {
                <input
                  [id]="field.key"
                  type="text"
                  [formControlName]="field.key"
                  [placeholder]="field.placeholder || ''"
                  class="form-input"
                  [class.is-invalid]="form.get(field.key)?.invalid && form.get(field.key)?.touched"
                />
              }
              @case ('select') {
                <select
                  [id]="field.key"
                  [formControlName]="field.key"
                  class="form-input"
                  [class.is-invalid]="form.get(field.key)?.invalid && form.get(field.key)?.touched"
                >
                  <option [ngValue]="''">Selecciona una opción</option>
                  @for (option of getSelectOptions(field); track option.value) {
                    <option [ngValue]="option.value">{{ option.label }}</option>
                  }
                </select>
              }
            }

            @if (form.get(field.key)?.invalid && form.get(field.key)?.touched) {
              <span class="error-text">{{ getFieldError(field.key) }}</span>
            }
            @if (field.hint) {
              <span class="hint-text">{{ field.hint }}</span>
            }
          </div>
        }
      }

      <div class="form-actions">
        <button
          type="button"
          (click)="onCancel()"
          class="btn btn-secondary"
          [disabled]="isSubmitting"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="btn btn-primary"
          [disabled]="form.invalid || isSubmitting"
        >
          @if (isSubmitting) {
            Guardando...
          } @else {
            {{ neighborhood ? 'Actualizar' : 'Crear' }}
          }
        </button>
      </div>
    </form>
  `,
  styles: [`
    .generic-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .error-banner {
      background-color: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 4px;
      padding: 0.75rem 1rem;
      color: #991b1b;
      font-size: 0.875rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-group label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .required {
      color: #dc2626;
    }

    .form-input {
      padding: 0.625rem 0.875rem;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 0.875rem;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      outline: none;
      border-color: #4285f4;
      box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
    }

    .form-input.is-invalid {
      border-color: #dc2626;
    }

    .error-text {
      font-size: 0.75rem;
      color: #dc2626;
    }

    .hint-text {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .form-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .btn {
      padding: 0.625rem 1.25rem;
      border: none;
      border-radius: 4px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-secondary {
      background-color: #f3f4f6;
      color: #374151;

      &:hover:not(:disabled) {
        background-color: #e5e7eb;
      }
    }

    .btn-primary {
      background-color: #4285f4;
      color: white;

      &:hover:not(:disabled) {
        background-color: #3367d6;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NeighborhoodsFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly neighborhoodService = inject(NeighborhoodCrudService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() config!: EntityConfig;
  @Input() neighborhood: Neighborhood | null = null;
  @Input() selectOptions: Record<string, any[]> = {};

  @Output() saved = new EventEmitter<Neighborhood>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  isSubmitting = false;
  duplicateError = '';

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    const group: Record<string, any> = {};

    this.config.fields.forEach((field) => {
      const validators = buildValidators(field);
      const value = this.normalizeSelectValue(field, (this.neighborhood as any)?.[field.key] ?? '');
      group[field.key] = [value, validators];
    });

    this.form = this.fb.group(group);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.duplicateError = '';
    this.cdr.markForCheck();

    try {
      const formValue = this.form.value;

      // Validación de duplicado solo en creación (CU-06 Paso 4, 4a)
      if (!this.neighborhood) {
        const isDuplicate = await this.checkDuplicateInCommune(formValue.name, formValue.id_commune);
        if (isDuplicate) {
          this.duplicateError = 'Ya existe un barrio con este nombre en la comuna seleccionada';
          this.isSubmitting = false;
          this.cdr.markForCheck();
          return;
        }
      }

      const payload = this.buildPayload(formValue);
      let result: Neighborhood;

      if (this.neighborhood) {
        result = await this.neighborhoodService.update(this.neighborhood.id_neighborhood, payload).toPromise() as Neighborhood;
        this.toastService.success('Barrio actualizado correctamente');
      } else {
        result = await this.neighborhoodService.create(payload).toPromise() as Neighborhood;
        this.toastService.success('Barrio creado correctamente');
      }

      this.saved.emit(result);
    } catch (error: any) {
      const backendMessage = this.extractBackendMessage(error);
      const errorMessage = this.getSaveErrorMessage(error);

      const status: number = (error as any)?.status ?? 0;
      if (status === 400 && backendMessage) {
        this.duplicateError = backendMessage;
      }

      this.toastService.danger('Error al guardar', errorMessage);
      console.error('[NeighborhoodsForm] Error al guardar barrio:', error);
    } finally {
      this.isSubmitting = false;
      this.cdr.markForCheck();
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  /**
   * CU-06 Step 4: Valida que no exista un barrio con el mismo nombre en esa comuna
   */
  private checkDuplicateInCommune(name: string, communeId: number): Promise<boolean> {
    return new Promise((resolve) => {
      this.neighborhoodService
        .search({ q: name.trim().split(' ')[0] || name.trim() })
        .pipe(take(1))
        .subscribe({
          next: (response) => {
            const items: Neighborhood[] = Array.isArray(response) ? response : (response as any).items ?? [];
            const exists = items.some(
              (neighborhood: Neighborhood) => 
                neighborhood.name?.trim().toLowerCase() === name.trim().toLowerCase() &&
                neighborhood.id_commune === communeId
            );
            resolve(exists);
          },
          error: () => resolve(false)
        });
    });
  }

  private buildPayload(formValue: any): NeighborhoodPayload {
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

    return payload as NeighborhoodPayload;
  }

  private normalizeSelectValue(field: any, value: any): any {
    if (field.type !== 'select' || value === null || value === undefined || value === '') {
      return value;
    }

    const matchingOption = this.getSelectOptions(field).find((option: any) => String(option.value) === String(value));
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

  isFieldRequired(field: any): boolean {
    return field.required;
  }

  getSelectOptions(field: any): any[] {
    return this.selectOptions[field.key] || field.options || [];
  }

  private getSaveErrorMessage(error: unknown): string {
    const backendMessage = this.extractBackendMessage(error);
    const baseMessage = `No se pudo guardar el barrio`;

    return backendMessage ? `${baseMessage}: ${backendMessage}` : baseMessage;
  }

  private extractBackendMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const err = error as Record<string, any>;

    if (typeof err['message'] === 'string' && err['message'] && err['message'] !== 'Unknown Error') {
      return err['message'];
    }

    const body = err['error'];
    if (body && typeof body === 'object') {
      const responseMessage = (body as Record<string, unknown>)['message'] ?? (body as Record<string, unknown>)['error'];
      return typeof responseMessage === 'string' ? responseMessage : '';
    }

    if (typeof body === 'string') {
      return body;
    }

    return '';
  }
}
