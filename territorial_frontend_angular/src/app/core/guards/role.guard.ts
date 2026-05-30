import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { UserRole } from '../models/auth.models';

export const roleGuard = (roles: UserRole[]): CanActivateFn => () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.hasAnyRole(roles) ? true : router.createUrlTree(['/dashboard']);
};
