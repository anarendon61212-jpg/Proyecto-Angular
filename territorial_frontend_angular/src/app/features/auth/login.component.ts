import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';
import { UserRole } from '@core/models/auth.models';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly roles: UserRole[] = ['Administrador', 'Funcionario', 'Ciudadano'];

  login(role: UserRole): void {
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo') || '/dashboard';

    this.authService.loginWithMockRole(role);
    void this.router.navigateByUrl(redirectTo);
  }

  roleInitial(role: UserRole): string {
    return role.slice(0, 2).toUpperCase();
  }
}
