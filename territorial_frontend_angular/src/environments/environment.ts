export const environment = {
  production: false,
  appConfig: {
    appName: 'Valoración Territorial',
    apiBaseUrl: '/api',
    backendHealthUrl: '/health',
    tokenStorageKey: 'territorial.auth.session',
    oauthStateStorageKey: 'territorial.oauth.state',
    oauthRedirectStorageKey: 'territorial.oauth.redirect',
    oauthProfileStorageKey: 'territorial.oauth.github.profile',
    oauthLocalFallbackEnabled: true,
    githubOAuth: {
      clientId: 'Ov23liAomk3Fm3g5yozs',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      callbackPath: '/auth/oauth/github/callback',
      scope: 'read:user user:email'
    },
    googleOAuth: {
      clientId: '31250362360-i8rv2iaomic46bs9f2j6279vp10988bv.apps.googleusercontent.com',
      callbackPath: '/auth/oauth/google/callback',
      scope: 'openid profile email'
    },
    defaultPageSize: 10
  }
};
