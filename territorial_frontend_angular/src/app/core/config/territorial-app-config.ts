import { InjectionToken } from '@angular/core';

import { environment } from '@env/environment';

export interface TerritorialAppConfig {
  appName: string;
  apiBaseUrl: string;
  backendHealthUrl: string;
  tokenStorageKey: string;
  oauthStateStorageKey: string;
  oauthRedirectStorageKey: string;
  oauthProfileStorageKey: string;
  oauthLocalFallbackEnabled: boolean;
  githubOAuth: {
    clientId: string;
    authorizeUrl: string;
    callbackPath: string;
    scope: string;
  };
  defaultPageSize: number;
}

export const TERRITORIAL_APP_CONFIG = new InjectionToken<TerritorialAppConfig>('TERRITORIAL_APP_CONFIG', {
  providedIn: 'root',
  factory: () => environment.appConfig
});
