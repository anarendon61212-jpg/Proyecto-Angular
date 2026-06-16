import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { TERRITORIAL_APP_CONFIG } from '../config/territorial-app-config';
import {
  ApiDeleteResponse,
  ApiQueryParams,
  EntityId,
  PaginatedResponse
} from './api.types';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(TERRITORIAL_APP_CONFIG);

  get<TResponse>(path: string, query?: ApiQueryParams): Observable<TResponse> {
    return this.http.get<TResponse>(this.url(path), {
      params: this.toHttpParams(query)
    });
  }

  list<TItem>(resource: string, query?: ApiQueryParams): Observable<TItem[] | PaginatedResponse<TItem>> {
    return this.get<TItem[] | PaginatedResponse<TItem>>(resource, query);
  }

  search<TItem>(resource: string, query: ApiQueryParams): Observable<TItem[] | PaginatedResponse<TItem>> {
    return this.get<TItem[] | PaginatedResponse<TItem>>(`${resource}/search`, query);
  }

  create<TResponse, TBody = unknown>(resource: string, body: TBody): Observable<TResponse> {
    return this.http.post<TResponse>(this.url(resource), body);
  }

  createFormData<TResponse>(resource: string, formData: FormData): Observable<TResponse> {
    return this.http.post<TResponse>(this.url(resource), formData);
  }

  update<TResponse, TBody = unknown>(resource: string, id: EntityId, body: TBody): Observable<TResponse> {
    console.group('[HTTP PUT] Request');
    console.log('Resource:', resource);
    console.log('ID:', id);
    console.log('URL:', this.url(`${resource}/${id}`));
    console.log('Body:', body);
    console.groupEnd();
    return this.http.put<TResponse>(this.url(`${resource}/${id}`), body);
  }

  updateFormData<TResponse>(resource: string, id: EntityId, formData: FormData): Observable<TResponse> {
    return this.http.put<TResponse>(this.url(`${resource}/${id}`), formData);
  }

  remove<TResponse = ApiDeleteResponse>(resource: string, id: EntityId): Observable<TResponse> {
    return this.http.delete<TResponse>(this.url(`${resource}/${id}`));
  }

  imageUrl(relativePath?: string | null): string {
    if (!relativePath) {
      return '';
    }

    if (/^https?:\/\//i.test(relativePath) || relativePath.startsWith('/api/')) {
      return relativePath;
    }

    const normalizedPath = relativePath.replace(/^\/+/, '');

    if (normalizedPath.startsWith('images/')) {
      return this.url(normalizedPath);
    }

    return this.url(`images/${normalizedPath}`);
  }

  private url(path: string): string {
    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const baseUrl = this.config.apiBaseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }

  private toHttpParams(query?: ApiQueryParams): HttpParams {
    let params = new HttpParams();

    if (!query) {
      return params;
    }

    Object.entries(query).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => {
          params = params.append(key, String(entry));
        });
        return;
      }

      params = params.set(key, String(value));
    });

    return params;
  }
}
