import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MsalService } from '@azure/msal-angular';
import { AuthenticationResult } from '@azure/msal-browser';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';

import { TERRITORIAL_APP_CONFIG } from '../config/territorial-app-config';
import {
  AuthSession,
  AuthUser,
  CompleteOAuthProfilePayload,
  OAuthCallbackResult,
  OAuthProfile,
  RegistrableUserRole,
  UserRole
} from '../models/auth.models';
import { ErrorStateService } from '../services/error-state.service';

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

interface StoredOAuthProfile {
  provider: OAuthProfile['provider'];
  providerUserId: string;
  name?: string;
  email?: string;
  accessToken?: string;
  role: RegistrableUserRole;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly config = inject(TERRITORIAL_APP_CONFIG);
  private readonly errorState = inject(ErrorStateService);
  private readonly msalService = inject(MsalService);
  private readonly storedSession = this.readStoredSession();

  readonly accessToken = signal<string | null>(this.storedSession?.accessToken ?? null);
  readonly currentUser = signal<AuthUser | null>(this.storedSession?.user ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.accessToken() && this.currentUser()));
  readonly currentRole = computed(() => this.currentUser()?.role ?? null);

  setSession(session: AuthSession): void {
    this.storage?.setItem(this.config.tokenStorageKey, JSON.stringify(session));
    this.storage?.setItem('Nombre', session.user.name);
    this.storage?.setItem('Rol', session.user.role);
    this.storage?.setItem('Token', session.accessToken);
    this.storage?.setItem('Correo', session.user.email || '');
    this.errorState.clear();
    this.accessToken.set(session.accessToken);
    this.currentUser.set(session.user);
  }

  loginWithMockRole(role: UserRole): void {
    this.setSession({
      accessToken: `dev-${role.toLowerCase()}-${Date.now()}`,
      user: MOCK_USERS[role]
    });
  }

  loginWithGitHub(redirectTo = '/dashboard'): void {
    const state = this.createOAuthState();
    this.storage?.setItem(this.config.oauthStateStorageKey, state);
    this.storage?.setItem(this.config.oauthRedirectStorageKey, redirectTo);

    window.location.href = this.buildGitHubAuthorizeUrl(state);
  }

  completeGitHubLogin(code: string, state: string): Observable<OAuthCallbackResult> {
    const expectedState = this.storage?.getItem(this.config.oauthStateStorageKey);

    if (!expectedState || expectedState !== state) {
      throw new Error('No se pudo validar el estado de la autenticacion OAuth.');
    }

    return this.http.post<OAuthCallbackResult | AuthSession>(this.apiUrl('/auth/oauth/github/callback'), {
      code,
      state,
      redirectUri: this.oauthRedirectUri
    }).pipe(
      catchError((error: unknown) => throwError(() => error)),
      map((response) => this.normalizeOAuthResponse(response)),
      tap((result) => {
        this.clearOAuthState();

        if (result.session) {
          this.setSession(result.session);
        }
      })
    );
  }

  getOAuthRedirectTo(): string {
    return this.storage?.getItem(this.config.oauthRedirectStorageKey) || '/dashboard';
  }

  completeOAuthProfile(payload: CompleteOAuthProfilePayload): Observable<AuthSession> {
    if (this.config.oauthLocalFallbackEnabled) {
      return of(payload).pipe(
        map((profilePayload) => this.createLocalProfileSession(profilePayload)),
        tap((session) => this.setSession(session))
      );
    }

    return this.http.post<AuthSession>(this.apiUrl('/auth/oauth/complete-profile'), payload).pipe(
      catchError((error: unknown) => {
        if (this.shouldUseLocalOAuthFallback(error)) {
          return of(this.createLocalProfileSession(payload));
        }

        return throwError(() => error);
      }),
      tap((session) => this.setSession(session))
    );
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
        if (!result) {
          return;
        }

        const pendingRole = sessionStorage.getItem('pendingRole') as 'Ciudadano' | 'Funcionario' | null;
        if (!pendingRole) {
          return;
        }

        sessionStorage.removeItem('pendingRole');

        const name = result.account?.name ?? result.account?.username ?? 'Usuario';
        const email = result.account?.username ?? '';

        this.setSession({
          accessToken: result.accessToken,
          user: {
            id: 0,
            name,
            email,
            role: pendingRole,
            initials: this.initialsFromName(name)
          }
        });

        void this.router.navigateByUrl('/dashboard');
      },
      error: (err) => console.error('Microsoft login error:', err)
    });
  }

  logout(): void {
    this.storage?.removeItem(this.config.tokenStorageKey);
    this.storage?.removeItem('Nombre');
    this.storage?.removeItem('Rol');
    this.storage?.removeItem('Token');
    this.storage?.removeItem('Correo');
    this.accessToken.set(null);
    this.currentUser.set(null);
    void this.router.navigateByUrl('/auth/login');
  }

  logoutMicrosoft(): void {
    this.logout();
    this.msalService.logoutRedirect();
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

  private normalizeOAuthResponse(response: OAuthCallbackResult | AuthSession): OAuthCallbackResult {
    if ('accessToken' in response && 'user' in response) {
      return { session: response };
    }

    if (response.profile?.providerUserId && response.profile.accessToken) {
      const storedProfile = this.readStoredOAuthProfile(response.profile.providerUserId);

      if (storedProfile) {
        const profile = {
          ...storedProfile,
          name: response.profile.name || storedProfile.name,
          email: response.profile.email || storedProfile.email,
          accessToken: response.profile.accessToken
        };
        this.storeOAuthProfile(profile);

        return {
          session: this.createSessionFromStoredOAuthProfile(profile)
        };
      }

      this.storePendingOAuthProfile(response.profile);
      return {
        ...response,
        requiresProfile: true
      };
    }

    return response;
  }

  private buildGitHubAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.githubOAuth.clientId,
      redirect_uri: this.oauthRedirectUri,
      scope: this.config.githubOAuth.scope,
      state,
      allow_signup: 'true'
    });

    return `${this.config.githubOAuth.authorizeUrl}?${params.toString()}`;
  }

  private get oauthRedirectUri(): string {
    return `${window.location.origin}${this.config.githubOAuth.callbackPath}`;
  }

  private apiUrl(path: string): string {
    const baseUrl = this.config.apiBaseUrl.replace(/\/$/, '');
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private shouldUseLocalOAuthFallback(error: unknown): boolean {
    if (!this.config.oauthLocalFallbackEnabled) {
      return false;
    }

    if (error instanceof HttpErrorResponse) {
      return error.status === 404;
    }

    return Boolean(
      error &&
      typeof error === 'object' &&
      'status' in error &&
      error.status === 404
    );
  }

  private createLocalProfileSession(payload: CompleteOAuthProfilePayload): AuthSession {
    const pendingProfile = this.readPendingOAuthProfile();
    const providerUserId = payload.providerUserId || pendingProfile?.providerUserId;
    const name = payload.name || pendingProfile?.name;

    if (!providerUserId || !name) {
      throw new Error('No hay datos reales de GitHub pendientes para completar el registro.');
    }

    const profile: StoredOAuthProfile = {
      provider: payload.provider,
      providerUserId,
      name,
      email: payload.email || pendingProfile?.email,
      accessToken: pendingProfile?.accessToken,
      role: payload.role
    };

    this.storeOAuthProfile(profile);
    this.clearPendingOAuthProfile();
    return this.createSessionFromStoredOAuthProfile(profile);
  }

  private createSessionFromStoredOAuthProfile(profile: StoredOAuthProfile): AuthSession {
    if (!profile.accessToken) {
      throw new Error('No hay token real de GitHub para crear la sesion.');
    }

    return {
      accessToken: profile.accessToken,
      user: this.authUserFromOAuthProfile(profile),
      expiresAt: this.oneHourFromNow()
    };
  }

  private readStoredOAuthProfile(providerUserId?: string): StoredOAuthProfile | null {
    const rawProfile = this.storage?.getItem(this.config.oauthProfileStorageKey);

    if (!rawProfile) {
      return null;
    }

    try {
      const profiles = JSON.parse(rawProfile) as Record<string, StoredOAuthProfile>;
      const profile = providerUserId
        ? profiles[providerUserId]
        : Object.values(profiles)[0];

      return profile?.role === 'Ciudadano' || profile?.role === 'Funcionario' ? profile : null;
    } catch {
      this.storage?.removeItem(this.config.oauthProfileStorageKey);
      return null;
    }
  }

  private storeOAuthProfile(profile: StoredOAuthProfile): void {
    let profiles: Record<string, StoredOAuthProfile> = {};
    const rawProfile = this.storage?.getItem(this.config.oauthProfileStorageKey);

    if (rawProfile) {
      try {
        profiles = JSON.parse(rawProfile) as Record<string, StoredOAuthProfile>;
      } catch {
        profiles = {};
      }
    }

    profiles[profile.providerUserId] = profile;
    this.storage?.setItem(this.config.oauthProfileStorageKey, JSON.stringify(profiles));
  }

  private storePendingOAuthProfile(profile: OAuthProfile): void {
    this.storage?.setItem(`${this.config.oauthProfileStorageKey}.pending`, JSON.stringify(profile));
  }

  private readPendingOAuthProfile(): OAuthProfile | null {
    const rawProfile = this.storage?.getItem(`${this.config.oauthProfileStorageKey}.pending`);

    if (!rawProfile) {
      return null;
    }

    try {
      return JSON.parse(rawProfile) as OAuthProfile;
    } catch {
      this.clearPendingOAuthProfile();
      return null;
    }
  }

  private clearPendingOAuthProfile(): void {
    this.storage?.removeItem(`${this.config.oauthProfileStorageKey}.pending`);
  }

  private authUserFromOAuthProfile(profile: StoredOAuthProfile): AuthUser {
    const name = profile.name || 'Cuenta GitHub';

    return {
      id: this.localProfileId(profile.providerUserId),
      name,
      email: profile.email,
      role: profile.role,
      initials: this.initialsFromName(name)
    };
  }

  private initialsFromName(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'GH';
  }

  private localProfileId(providerUserId: string): number {
    return Array.from(providerUserId).reduce((hash, character) => {
      return ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    }, 0);
  }

  private oneHourFromNow(): string {
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
  }

  private clearOAuthState(): void {
    this.storage?.removeItem(this.config.oauthStateStorageKey);
  }

  private createOAuthState(): string {
    const bytes = new Uint8Array(24);

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private get storage(): Storage | null {
    return typeof localStorage === 'undefined' ? null : localStorage;
  }
}
