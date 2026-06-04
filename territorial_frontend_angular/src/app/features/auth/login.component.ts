import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  adminEmail = signal('');
  adminPassword = signal('');
  adminError = signal('');

  selectedMicrosoftRole = signal<'Ciudadano' | 'Funcionario' | null>(null);

  ngOnInit(): void {
    this.authService.handleMicrosoftCallback();
  }

  loginAdmin(): void {
    if (
      this.adminEmail() === 'admin@manizales.gov.co' &&
      this.adminPassword() === 'admin'
    ) {
      const redirectTo =
        this.route.snapshot.queryParamMap.get('redirectTo') || '/dashboard';
      this.authService.loginWithMockRole('Administrador');
      void this.router.navigateByUrl(redirectTo);
    } else {
      this.adminError.set('Credenciales incorrectas');
    }
  }

  loginWithMicrosoft(): void {
    const role = this.selectedMicrosoftRole();
    if (!role) return;
    this.authService.loginWithMicrosoft(role);
  }

  selectMicrosoftRole(role: 'Ciudadano' | 'Funcionario'): void {
    this.selectedMicrosoftRole.set(role);
  }
}
