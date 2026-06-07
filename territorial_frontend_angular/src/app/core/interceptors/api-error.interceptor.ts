import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ApiError } from '../api/api.types';
import { ErrorStateService } from '../services/error-state.service';

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const errorState = inject(ErrorStateService);

  return next(request).pipe(
    catchError((error: unknown) => {
      const normalizedError = normalizeApiError(error, request.url);
      errorState.setError(normalizedError);
      return throwError(() => normalizedError);
    })
  );
};

function normalizeApiError(error: unknown, requestUrl: string): ApiError {
  if (error instanceof HttpErrorResponse) {
    const responseBody = error.error as { message?: string } | null;
    const rawMessage = responseBody?.message || error.message || '';

    return {
      status: error.status,
      message: shouldHideTechnicalDetails(rawMessage, requestUrl)
        ? 'No se pudo completar la solicitud. Verifica los datos e inténtalo de nuevo.'
        : rawMessage || 'No se pudo completar la solicitud.',
      details: error.error
    };
  }

  return {
    status: 0,
    message: 'Ocurrió un error inesperado.',
    details: error
  };
}

function shouldHideTechnicalDetails(message: string, requestUrl: string): boolean {
  const normalizedMessage = message.toLowerCase();
  const normalizedUrl = requestUrl.toLowerCase();

  return [
    'sqlite3.',
    'integrityerror',
    'unique constraint failed',
    'sql:',
    'traceback',
    'background on this error',
    'operationalerror'
  ].some((marker) => normalizedMessage.includes(marker) || normalizedUrl.includes(marker));
}
