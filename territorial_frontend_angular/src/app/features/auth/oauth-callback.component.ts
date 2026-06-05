import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, EMPTY } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '@shared/services/toast.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  template: `
    <main class="oauth-callback-page">
      <section class="oauth-callback-card app-card">
        <span class="oauth-callback-card__loader" aria-hidden="true"></span>
        <p class="eyebrow">OAuth GitHub</p>
        <h1>{{ title() }}</h1>
        <p>{{ message() }}</p>
        @if (canRetry()) {
          <button class="app-button app-button--primary" type="button" (click)="retry()">Reintentar</button>
        }
      </section>
    </main>
  `,
  styles: [`
    .oauth-callback-page {
      align-items: center;
      background: var(--color-surface);
      display: grid;
      min-height: 100vh;
      padding: 2rem;
      place-items: center;
    }

    .oauth-callback-card {
      display: grid;
      gap: 1rem;
      max-width: 520px;
      padding: 2rem;
      text-align: center;
      width: min(100%, 520px);
    }

    .oauth-callback-card__loader {
      animation: spin 0.9s linear infinite;
      border: 3px solid var(--color-border);
      border-radius: 50%;
      border-top-color: var(--color-primary);
      display: inline-block;
      height: 42px;
      justify-self: center;
      width: 42px;
    }

    .eyebrow {
      color: var(--color-primary);
      font-size: 0.78rem;
      font-weight: 900;
      letter-spacing: 0.08em;
      margin: 0;
      text-transform: uppercase;
    }

    h1,
    p {
      margin: 0;
    }

    p {
      color: var(--color-muted);
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OAuthCallbackComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly title = signal('Validando autenticacion');
  readonly message = signal('Estamos confirmando tu identidad con GitHub.');
  readonly canRetry = signal(false);

  ngOnInit(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    const providerError = queryParams.get('error');
    const code = queryParams.get('code');
    const state = queryParams.get('state');

    if (providerError) {
      this.showError('GitHub rechazo la autenticacion. Puedes intentarlo nuevamente.');
      return;
    }

    if (!code || !state) {
      this.showError('GitHub no retorno los datos necesarios para iniciar sesion.');
      return;
    }

    try {
      this.authService.completeGitHubLogin(code, state).pipe(
        catchError((error: unknown) => {
          this.showError(this.oauthErrorMessage(error));
          return EMPTY;
        })
      ).subscribe((result) => {
        if (result.session) {
          this.toastService.success('Sesion iniciada', 'Tu cuenta de GitHub fue validada correctamente.');
          void this.router.navigateByUrl(this.authService.getOAuthRedirectTo());
          return;
        }

        if (result.requiresProfile) {
          void this.router.navigate(['/auth/completar-perfil'], {
            queryParams: {
              provider: result.profile?.provider ?? 'github',
              providerUserId: result.profile?.providerUserId,
              name: result.profile?.name,
              email: result.profile?.email
            }
          });
          return;
        }

        this.showError(result.message || 'La respuesta del backend no contiene una sesion valida.');
      });
    } catch {
      this.showError('No se pudo validar la solicitud OAuth. Intenta iniciar sesion otra vez.');
    }
  }

  retry(): void {
    void this.router.navigateByUrl('/auth/login');
  }

  private showError(message: string): void {
    this.title.set('No se pudo iniciar sesion');
    this.message.set(message);
    this.canRetry.set(true);
    this.toastService.danger('Error de autenticacion', message);
  }

  private oauthErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }

    return 'No se pudo validar el token con GitHub.';
  }
}
