/**
 * CHECKLIST AZURE PORTAL — completar antes de probar:
 *
 * 1. Ir a portal.azure.com → Azure Active Directory → App registrations
 * 2. Seleccionar la app registrada para este proyecto
 * 3. En "Authentication" → Add a platform → Single Page Application
 *    Redirect URI: http://localhost:4200
 * 4. En "Authentication" habilitar:
 *    ✓ Access tokens
 *    ✓ ID tokens
 * 5. En "API permissions" agregar (Microsoft Graph → Delegated):
 *    ✓ openid
 *    ✓ profile
 *    ✓ email
 * 6. Reemplazar en este archivo:
 *    clientId  → App Registration → "Id. de aplicación (cliente)"
 *    authority → reemplazar TU_TENANT_ID_AQUI con "Id. del directorio (inquilino)"
 *
 * Para verificar sesión activa en el navegador:
 *   F12 → Console → JSON.parse(localStorage.getItem('territorial_session'))
 *
 * Debe retornar: { accessToken: "eyJ...", user: { role, name, email, initials } }
 */

import { MsalGuardConfiguration, MsalInterceptorConfiguration } from '@azure/msal-angular';
import { InteractionType, PublicClientApplication } from '@azure/msal-browser';

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId: '09a0c600-3044-4beb-ad48-a65a1591cac5',
    authority: 'https://login.microsoftonline.com/c8e18ab4-5e48-485c-9dc7-f86fe001558d',
    redirectUri: 'http://localhost:4200'
  },
  cache: {
    cacheLocation: 'localStorage'
  }
});

export const msalGuardConfig: MsalGuardConfiguration = {
  interactionType: InteractionType.Redirect
};

export const msalInterceptorConfig: MsalInterceptorConfiguration = {
  interactionType: InteractionType.Redirect,
  protectedResourceMap: new Map()
};
