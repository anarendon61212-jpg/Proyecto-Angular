import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { AuthenticationResult } from '@azure/msal-browser';

import { TERRITORIAL_APP_CONFIG } from '../config/territorial-app-config';
import { AuthSession, AuthUser, UserRole } from '../models/auth.models';

const MOCK_USERS: Record<UserRole, AuthUser> = {
  Administrador: {
    id: 1,
    name: 'Admin Sistema',
    email: 'admin@manizales.gov.co',
    role: 'Administrador',
    entityName: 'Alcaldía de Manizales',
    initials: 'AS'
  },
  Funcionario: {
    id: 2,
    name: 'Funcionario Municipal',
    email: 'funcionario@manizales.gov.co',
    role: 'Funcionario',
    entityName: 'Planeación Municipal',
    initials: 'FM'
  },
  Ciudadano: {
    id: 3,
    name: 'Carolina Martínez',
    email: 'ciudadano@email.com',
    role: 'Ciudadano',
    initials: 'CM'
  }
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly config = inject(TERRITORIAL_APP_CONFIG);
  private readonly msalService = inject(MsalService);
  private readonly storedSession = this.readStoredSession();

  readonly accessToken = signal<string | null>(this.storedSession?.accessToken ?? null);
  readonly currentUser = signal<AuthUser | null>(this.storedSession?.user ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.accessToken() && this.currentUser()));
  readonly currentRole = computed(() => this.currentUser()?.role ?? null);

  setSession(session: AuthSession): void {
    this.storage?.setItem(this.config.tokenStorageKey, JSON.stringify(session));
    this.accessToken.set(session.accessToken);
    this.currentUser.set(session.user);
  }

  loginWithMockRole(role: UserRole): void {
    this.setSession({
      accessToken: `dev-${role.toLowerCase()}-${Date.now()}`,
      user: MOCK_USERS[role]
    });
  }

  logout(): void {
    this.storage?.removeItem(this.config.tokenStorageKey);
    this.accessToken.set(null);
    this.currentUser.set(null);
    void this.router.navigateByUrl('/auth/login');
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const role = this.currentRole();
    return Boolean(role && roles.includes(role));
  }

  private readStoredSession(): AuthSession | null {
    const rawSession = this.storage?.getItem(this.config.tokenStorageKey);

    if (!rawSession) {
      return null;
    }

    try {
      return JSON.parse(rawSession) as AuthSession;
    } catch {
      this.storage?.removeItem(this.config.tokenStorageKey);
      return null;
    }
  }

  private get storage(): Storage | null {
    return typeof localStorage === 'undefined' ? null : localStorage;
  }

  loginWithMicrosoft(role: 'Ciudadano' | 'Funcionario'): void {
    sessionStorage.setItem('pendingRole', role);
    this.msalService.loginRedirect({
      scopes: ['openid', 'profile', 'email']
    });
  }

  handleMicrosoftCallback(): void {
    this.msalService.handleRedirectObservable().subscribe({
      next: (result: AuthenticationResult | null) => {
        if (!result) return;

        const pendingRole = sessionStorage.getItem('pendingRole') as 'Ciudadano' | 'Funcionario' | null;
        if (!pendingRole) return;

        sessionStorage.removeItem('pendingRole');

        const name = result.account?.name ?? result.account?.username ?? 'Usuario';
        const email = result.account?.username ?? '';
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        this.setSession({
          accessToken: result.accessToken,
          user: {
            id: 0,
            name,
            email,
            role: pendingRole,
            initials
          }
        });

        void this.router.navigateByUrl('/dashboard');
      },
      error: (err) => console.error('Microsoft login error:', err)
    });
  }

  logoutMicrosoft(): void {
    this.logout();
    this.msalService.logoutRedirect();
  }
}
