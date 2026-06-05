export type UserRole = 'Administrador' | 'Funcionario' | 'Ciudadano';

export interface AuthUser {
  id?: number;
  name: string;
  email?: string;
  role: UserRole;
  entityName?: string;
  initials: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
  expiresAt?: string;
}

export interface OAuthProfile {
  provider: 'github' | 'google' | 'microsoft';
  providerUserId?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  accessToken?: string;
}

export interface OAuthCallbackResult {
  session?: AuthSession;
  requiresProfile?: boolean;
  profile?: OAuthProfile;
  message?: string;
}

export type RegistrableUserRole = Exclude<UserRole, 'Administrador'>;

export interface CompleteOAuthProfilePayload {
  provider: OAuthProfile['provider'];
  providerUserId?: string;
  name?: string;
  email?: string;
  role: RegistrableUserRole;
}
