import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
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
      this.previewUrl = entity.logo_url;
    }
  }

  onFileSelected(files: File[]): void {
    if (files.length > 0) {
      this.selectedFile = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.previewUrl = e.target?.result as string;
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
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.duplicateError = '';

    try {
      const formValue = this.form.value;

      // Validación de duplicado solo en creación
      if (!this.entity) {
        const isDuplicate = await this.checkDuplicate(formValue.name);
        if (isDuplicate) {
          this.duplicateError = 'Ya existe una entidad con este nombre';
          this.isSubmitting = false;
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
    } catch (error) {
      this.toastService.danger('Error', 'No se pudo guardar la entidad');
      console.error(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  private checkDuplicate(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.entityService
        .search({ q: name })
        .pipe(take(1))
        .subscribe({
          next: (response) => {
            const items = Array.isArray(response) ? response : response.items || [];
            resolve(items.some((entity: Entity) => entity.name.toLowerCase() === name.toLowerCase()));
          },
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
