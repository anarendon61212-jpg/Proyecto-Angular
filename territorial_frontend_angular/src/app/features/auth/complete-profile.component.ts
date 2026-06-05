import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { RegistrableUserRole } from '@core/models/auth.models';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <main class="profile-page">
      <section class="profile-card app-card">
        <div>
          <p class="eyebrow">Registro GitHub</p>
          <h1>Selecciona tu rol</h1>
          <p class="description">Esta eleccion se guardara para tus siguientes inicios de sesion.</p>
        </div>

        <form class="profile-form" [formGroup]="profileForm" (ngSubmit)="submit()">
          <div class="role-options" role="radiogroup" aria-label="Rol de usuario">
            @for (role of roles; track role) {
              <label class="role-option">
                <input type="radio" formControlName="role" [value]="role">
                <span>
                  <strong>{{ role }}</strong>
                  <small>{{ roleDescription(role) }}</small>
                </span>
              </label>
            }
          </div>

          <button class="app-button app-button--primary" type="submit" [disabled]="profileForm.invalid || submitting">
            {{ submitting ? 'Guardando...' : 'Guardar y continuar' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [`
    .profile-page {
      align-items: center;
      background: var(--color-surface);
      display: grid;
      min-height: 100vh;
      padding: 2rem;
      place-items: center;
    }

    .profile-card {
      display: grid;
      gap: 1.5rem;
      max-width: 560px;
      padding: 2rem;
      width: min(100%, 560px);
    }

    .eyebrow {
      color: var(--color-primary);
      font-size: 0.78rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      margin: 0 0 0.35rem;
      text-transform: uppercase;
    }

    h1,
    .description {
      margin: 0;
    }

    .description {
      color: var(--color-muted);
      margin-top: 0.5rem;
    }

    .profile-form,
    .role-options {
      display: grid;
      gap: 1rem;
    }

    .role-option {
      align-items: center;
      background: #ffffff;
      border: 1px solid var(--color-border);
      border-radius: 14px;
      cursor: pointer;
      display: grid;
      gap: 0.85rem;
      grid-template-columns: auto 1fr;
      padding: 1rem;
    }

    .role-option:has(input:checked) {
      border-color: var(--color-primary);
      box-shadow: 0 12px 26px rgba(20, 89, 245, 0.12);
    }

    .role-option input {
      accent-color: var(--color-primary);
      height: 18px;
      width: 18px;
    }

    .role-option strong,
    .role-option small {
      display: block;
    }

    .role-option small {
      color: var(--color-muted);
      margin-top: 0.25rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompleteProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly roles: RegistrableUserRole[] = ['Ciudadano', 'Funcionario'];
  submitting = false;

  readonly profileForm = this.formBuilder.nonNullable.group({
    role: ['Ciudadano' as RegistrableUserRole, [Validators.required]]
  });

  roleDescription(role: RegistrableUserRole): string {
    return role === 'Ciudadano'
      ? 'Participa y consulta informacion territorial.'
      : 'Gestiona informacion segun permisos institucionales.';
  }

  submit(): void {
    if (this.profileForm.invalid || this.submitting) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.authService.completeOAuthProfile({
      provider: 'github',
      providerUserId: this.route.snapshot.queryParamMap.get('providerUserId') || undefined,
      name: this.route.snapshot.queryParamMap.get('name') || undefined,
      email: this.route.snapshot.queryParamMap.get('email') || undefined,
      role: this.profileForm.getRawValue().role
    }).pipe(
      catchError(() => {
        this.submitting = false;
        this.toastService.danger('No se pudo completar el registro', 'Intentalo otra vez.');
        return EMPTY;
      })
    ).subscribe(() => {
      this.toastService.success('Registro completado', 'Tu rol quedo guardado.');
      void this.router.navigateByUrl(this.authService.getOAuthRedirectTo());
    });
  }
}
