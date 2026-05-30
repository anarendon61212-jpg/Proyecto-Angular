import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ApiError } from '../api/api.types';
import { ErrorStateService } from '../services/error-state.service';

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const errorState = inject(ErrorStateService);

  return next(request).pipe(
    catchError((error: unknown) => {
      const normalizedError = normalizeApiError(error);
      errorState.setError(normalizedError);
      return throwError(() => normalizedError);
    })
  );
};

function normalizeApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse) {
    const responseBody = error.error as { message?: string } | null;

    return {
      status: error.status,
      message: responseBody?.message || error.message || 'No se pudo completar la solicitud.',
      details: error.error
    };
  }

  return {
    status: 0,
    message: 'Ocurrió un error inesperado.',
    details: error
  };
}
