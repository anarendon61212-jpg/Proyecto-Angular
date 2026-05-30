export type EntityId = number | string;

export type ApiQueryPrimitive = string | number | boolean;

export type ApiQueryValue = ApiQueryPrimitive | ApiQueryPrimitive[] | null | undefined;

export type ApiQueryParams = Record<string, ApiQueryValue>;

export interface PaginatedResponse<TItem> {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  items: TItem[];
}

export interface ApiDeleteResponse {
  message: string;
}

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}
