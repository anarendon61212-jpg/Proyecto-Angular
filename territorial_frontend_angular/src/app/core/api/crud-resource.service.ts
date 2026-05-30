import { inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClient } from './api-client.service';
import { ApiDeleteResponse, ApiQueryParams, EntityId, PaginatedResponse } from './api.types';

export type ApiListResponse<TItem> = TItem[] | PaginatedResponse<TItem>;

export interface ApiCollection<TItem> {
  items: TItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  paginated: boolean;
}

export abstract class CrudResourceService<
  TItem,
  TCreatePayload = Partial<TItem>,
  TUpdatePayload = Partial<TCreatePayload>
> {
  protected readonly api = inject(ApiClient);
  protected abstract readonly resourcePath: string;

  list(query?: ApiQueryParams): Observable<ApiListResponse<TItem>> {
    return this.api.list<TItem>(this.resourcePath, query);
  }

  listCollection(query?: ApiQueryParams): Observable<ApiCollection<TItem>> {
    return this.list(query).pipe(map((response) => this.toCollection(response, query)));
  }

  search(query: ApiQueryParams): Observable<ApiListResponse<TItem>> {
    return this.api.search<TItem>(this.resourcePath, query);
  }

  searchCollection(query: ApiQueryParams): Observable<ApiCollection<TItem>> {
    return this.search(query).pipe(map((response) => this.toCollection(response, query)));
  }

  getById(id: EntityId): Observable<TItem> {
    return this.api.get<TItem>(`${this.resourcePath}/${id}`);
  }

  create(payload: TCreatePayload): Observable<TItem> {
    return this.api.create<TItem, TCreatePayload>(this.resourcePath, payload);
  }

  createForm(formData: FormData): Observable<TItem> {
    return this.api.createFormData<TItem>(this.resourcePath, formData);
  }

  update(id: EntityId, payload: TUpdatePayload): Observable<TItem> {
    return this.api.update<TItem, TUpdatePayload>(this.resourcePath, id, payload);
  }

  updateForm(id: EntityId, formData: FormData): Observable<TItem> {
    return this.api.updateFormData<TItem>(this.resourcePath, id, formData);
  }

  delete(id: EntityId): Observable<ApiDeleteResponse> {
    return this.api.remove(this.resourcePath, id);
  }

  protected toCollection(response: ApiListResponse<TItem>, query?: ApiQueryParams): ApiCollection<TItem> {
    if (isPaginatedResponse(response)) {
      return {
        items: response.items,
        page: response.page,
        pageSize: response.pageSize,
        totalItems: response.totalItems,
        totalPages: response.totalPages,
        paginated: true
      };
    }

    const requestedPageSize = Number(query?.['pageSize']) || response.length || 0;

    return {
      items: response,
      page: 1,
      pageSize: requestedPageSize,
      totalItems: response.length,
      totalPages: 1,
      paginated: false
    };
  }
}

export function isPaginatedResponse<TItem>(response: ApiListResponse<TItem>): response is PaginatedResponse<TItem> {
  return !Array.isArray(response) && Array.isArray(response.items);
}
