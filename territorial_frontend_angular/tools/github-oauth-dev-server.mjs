import http from 'node:http';

const HOST = '127.0.0.1';
const PORT = Number(process.env.GITHUB_OAUTH_DEV_PORT || 5002);
const CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23liAomk3Fm3g5yozs';
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'd840d7376cedd8ba91e619477f3210bfcbd0279e';

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      sendJson(response, 204, null);
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && isGitHubCallback(request.url)) {
      const body = await readJsonBody(request);
      const result = await completeGitHubOAuth(body);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, { message: 'Ruta no encontrada.', source: 'github-oauth-dev-server' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo completar OAuth con GitHub.';
    console.error(`[github-oauth-dev-server] ${message}`);
    sendJson(response, 500, { message, source: 'github-oauth-dev-server' });
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.warn(`GitHub OAuth dev server already running on http://${HOST}:${PORT}`);
    return;
  }

  throw error;
});

server.listen(PORT, HOST, () => {
  console.log(`GitHub OAuth dev server listening on http://${HOST}:${PORT}`);
});

async function completeGitHubOAuth(body) {
  if (!body?.code || !body?.redirectUri) {
    throw new Error('Faltan code o redirectUri para completar OAuth.');
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'territorial-frontend-angular'
    },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: body.code,
      redirect_uri: body.redirectUri
    }).toString()
  });

  const tokenBody = await readGitHubJson(tokenResponse);

  if (!tokenResponse.ok || tokenBody.error || !tokenBody.access_token) {
    throw new Error(formatTokenError(tokenBody));
  }

  const accessToken = tokenBody.access_token;
  const [user, emails] = await Promise.all([
    fetchGitHubJson('https://api.github.com/user', accessToken),
    fetchGitHubJson('https://api.github.com/user/emails', accessToken).catch(() => [])
  ]);

  const primaryEmail = Array.isArray(emails)
    ? emails.find((email) => email.primary && email.verified)?.email || emails.find((email) => email.verified)?.email
    : undefined;

  return {
    source: 'github-oauth-dev-server',
    profile: {
      provider: 'github',
      providerUserId: String(user.id),
      name: user.name || user.login,
      email: primaryEmail || user.email || '',
      avatarUrl: user.avatar_url,
      accessToken
    }
  };
}

function isGitHubCallback(url) {
  return url === '/api/auth/oauth/github/callback' || url === '/auth/oauth/github/callback';
}

async function readGitHubJson(response) {
  const rawBody = await response.text();

  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch {
    throw new Error(`GitHub retorno una respuesta no JSON: ${rawBody.slice(0, 160)}`);
  }
}

function formatTokenError(tokenBody) {
  const error = tokenBody.error || 'oauth_error';
  const description = tokenBody.error_description || 'GitHub no retorno access_token.';

  if (error === 'bad_verification_code') {
    return `${description} El codigo OAuth expiro, ya fue usado, o el callback URL no coincide exactamente con el configurado en GitHub. Vuelve a iniciar sesion desde /auth/login.`;
  }

  if (error === 'incorrect_client_credentials') {
    return `${description} Revisa GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET.`;
  }

  return `${description} (${error})`;
}

async function fetchGitHubJson(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'territorial-frontend-angular',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API respondio ${response.status}.`);
  }

  return response.json();
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', (chunk) => {
      rawBody += chunk;
    });

    request.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        reject(new Error('JSON invalido.'));
      }
    });

    request.on('error', reject);
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': 'http://localhost:4200',
    'Content-Type': 'application/json'
  });

  response.end(body === null ? '' : JSON.stringify(body));
}
