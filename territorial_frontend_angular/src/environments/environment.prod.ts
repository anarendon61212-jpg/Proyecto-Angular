export const environment = {
  production: true,
  appConfig: {
    appName: 'Valoración Territorial',
    apiBaseUrl: 'http://127.0.0.1:5000',
    backendHealthUrl: 'http://127.0.0.1:5000/health',
    tokenStorageKey: 'territorial.auth.session',
    oauthStateStorageKey: 'territorial.oauth.state',
    oauthRedirectStorageKey: 'territorial.oauth.redirect',
    oauthProfileStorageKey: 'territorial.oauth.github.profile',
    oauthLocalFallbackEnabled: false,
    githubOAuth: {
      clientId: 'Ov23liAomk3Fm3g5yozs',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      callbackPath: '/auth/oauth/github/callback',
      scope: 'read:user user:email'
    },
    defaultPageSize: 10
  }
};
