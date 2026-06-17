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
 
import { Entity } from '@core/models/territorial.models';
import { EntityCrudService } from '@core/api/territorial-crud.services';
import { ToastService } from '@shared/services/toast.service';
import { FileUploadComponent } from '@shared/components/file-upload/file-upload.component';
 
@Component({
  selector: 'app-entities-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FileUploadComponent],
  templateUrl: './entities-form.component.html',
  styleUrl: './entities-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntitiesFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly entityService = inject(EntityCrudService);
  private readonly toastService = inject(ToastService);
  // ✅ FIX: Necesario para forzar re-render con OnPush cuando cambia estado tras un error async
  private readonly cdr = inject(ChangeDetectorRef);
 
  @Input() entity: Entity | null = null;
  @Output() saved = new EventEmitter<Entity>();
  @Output() cancelled = new EventEmitter<void>();
 
  form!: FormGroup;
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  isSubmitting = false;
  duplicateError = '';
 
  readonly statusOptions = [
    { label: 'Activa', value: 'Activa' },
    { label: 'Inactiva', value: 'Inactiva' }
  ];
 
  ngOnInit(): void {
    this.initForm();
  }
 
  private initForm(): void {
    const entity = this.entity;
    this.form = this.fb.group({
      name: [entity?.name ?? '', [Validators.required, Validators.minLength(3)]],
      nit: [entity?.nit ?? '', Validators.required],
      phone: [entity?.phone ?? ''],
      email: [entity?.email ?? '', [Validators.required, Validators.email]],
      address: [entity?.address ?? ''],
      status: [entity?.status ?? 'Activa', Validators.required]
    });
 
    if (entity?.logo_url) {
      // Si es una URL relativa, pasarla por el proxy del backend
      if (/^(https?:|data:|blob:)/i.test(entity.logo_url)) {
        this.previewUrl = entity.logo_url;
      } else if (/^\//i.test(entity.logo_url)) {
        this.previewUrl = entity.logo_url;
      } else {
        this.previewUrl = `/api/${entity.logo_url}`;
      }
    }

    // Forzar detección de cambios con OnPush cuando el formulario cambia
    this.form.valueChanges.subscribe(() => {
      this.cdr.markForCheck();
    });

    // Marcar controles como touched cuando cambian para mostrar errores de validación
    Object.keys(this.form.controls).forEach(key => {
      this.form.get(key)?.valueChanges.subscribe(() => {
        this.form.get(key)?.markAsTouched();
      });
    });
  }
 
  onFileSelected(files: File[]): void {
    if (files.length > 0) {
      this.selectedFile = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }
 
  onInvalidFiles(fileNames: string[]): void {
    this.toastService.warning(
      'Archivos rechazados',
      `${fileNames.join(', ')} exceden el tamaño máximo de 2 MB`
    );
  }
 
  async onSubmit(): Promise<void> {
 
    this.isSubmitting = true;
    this.duplicateError = '';
    // ✅ FIX: Notificar a OnPush que el estado cambió al inicio del submit
    this.cdr.markForCheck();
 
    try {
      const formValue = this.form.value;
 
      // Validación de duplicado solo en creación
      if (!this.entity) {
        const isDuplicate = await this.checkDuplicate(formValue.name);
        if (isDuplicate) {
          this.duplicateError = 'Ya existe una entidad con este nombre';
          this.isSubmitting = false;
          // ✅ FIX: Forzar re-render para que el banner de error aparezca con OnPush
          this.cdr.markForCheck();
          return;
        }
      }
 
      const formData = this.buildFormData(formValue);
      let result: Entity;
 
      if (this.entity) {
        result = await this.entityService.updateForm(this.entity.id_entity, formData).toPromise() as Entity;
        this.toastService.success('Entidad actualizada correctamente');
      } else {
        result = await this.entityService.createForm(formData).toPromise() as Entity;
        this.toastService.success('Entidad creada correctamente');
      }
 
      this.saved.emit(result);
    } catch (error: any) {
      // ✅ FIX: Leer el mensaje exacto que devuelve el backend (HTTP 400)
      // El interceptor normaliza el error, pero el catch también recibe el ApiError normalizado.
      // El backend devuelve: { "message": "El nombre de la entidad ya está registrado" }
      // El interceptor lo convierte a ApiError: { status: 400, message: "..." }
      const backendMessage: string =
        error?.message ||           // ApiError normalizado por el interceptor
        error?.error?.message ||    // HttpErrorResponse crudo (fallback)
        'No se pudo guardar la entidad';
 
      // ✅ FIX: Si es un error 400 de duplicado, mostrarlo en el banner del formulario
      // (más visible que un toast) además del toast de error.
      const status: number = error?.status ?? 0;
      if (status === 400) {
        this.duplicateError = backendMessage;
      }
 
      this.toastService.danger('Error al guardar', backendMessage);
      console.error('[EntitiesForm] Error al guardar entidad:', error);
    } finally {
      this.isSubmitting = false;
      // ✅ FIX: Forzar re-render para que OnPush actualice el botón y el banner tras el error
      this.cdr.markForCheck();
    }
  }
 
  onCancel(): void {
    this.cancelled.emit();
  }
 
  /**
   * ✅ FIX: Mejora del checkDuplicate.
   *
   * El backend usa ILIKE %q% — búsqueda parcial.
   * Problema original: si buscas "Alcaldía de Manizales" y existe "Alcaldía",
   * el ILIKE encuentra "Alcaldía" (porque "Alcaldía" está contenida en el q).
   * Pero si el nombre exacto es "Alcaldía" y buscas "Alcaldía de Manizales",
   * el ILIKE NO lo encuentra porque "Alcaldía de Manizales" no está en "Alcaldía".
   *
   * La comparación `.toLowerCase() === name.toLowerCase()` al final ya hace
   * coincidencia exacta sobre los resultados devueltos, por lo que la validación
   * previa es correcta. Sin embargo, si el search no devuelve el registro porque
   * el q es más largo que el nombre almacenado, la validación falla.
   *
   * Solución: buscar también con el primer token del nombre para ampliar los resultados,
   * y mantener la comparación exacta final. Si el search falla, dejar pasar
   * (el backend hará la validación definitiva y lanzará el 400).
   */
  private checkDuplicate(name: string): Promise<boolean> {
    // Tomamos la primera palabra del nombre para que el ILIKE tenga más chance de traer
    // registros parciales, y luego comparamos exactamente.
    const searchTerm = name.trim().split(' ')[0] || name.trim();
 
    return new Promise((resolve) => {
      this.entityService
        .search({ q: searchTerm })
        .pipe(take(1))
        .subscribe({
          next: (response) => {
            const items: Entity[] = Array.isArray(response) ? response : (response.items ?? []);
            const exists = items.some(
              (entity: Entity) => entity.name.trim().toLowerCase() === name.trim().toLowerCase()
            );
            resolve(exists);
          },
          // Si el search falla, no bloqueamos: el backend validará al hacer POST
          error: () => resolve(false)
        });
    });
  }
 
  private buildFormData(formValue: any): FormData {
    const formData = new FormData();
    formData.append('name', formValue.name);
    formData.append('nit', formValue.nit);
    formData.append('phone', formValue.phone ?? '');
    formData.append('email', formValue.email);
    formData.append('address', formValue.address ?? '');
    formData.append('status', formValue.status);
 
    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }
 
    return formData;
  }
 
  get nameError(): string {
    const control = this.form.get('name');
    if (control?.hasError('required')) return 'El nombre es requerido';
    if (control?.hasError('minlength')) return 'Mínimo 3 caracteres';
    return '';
  }
 
  get nitError(): string {
    const control = this.form.get('nit');
    if (control?.hasError('required')) return 'El NIT es requerido';
    return '';
  }
 
  get emailError(): string {
    const control = this.form.get('email');
    if (control?.hasError('required')) return 'El correo es requerido';
    if (control?.hasError('email')) return 'Correo inválido';
    return '';
  }
 
  get statusError(): string {
    const control = this.form.get('status');
    if (control?.hasError('required')) return 'El estado es requerido';
    return '';
  }
}