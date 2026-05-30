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
