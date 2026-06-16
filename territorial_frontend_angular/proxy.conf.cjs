const { spawn } = require('node:child_process');
const path = require('node:path');

let oauthServer = null;

if (process.env.GITHUB_OAUTH_PROXY_SKIP_START !== '1') {
  oauthServer = spawn(process.execPath, [path.join(__dirname, 'tools', 'github-oauth-dev-server.mjs')], {
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit'
  });

  oauthServer.on('error', (error) => {
    console.error(`No se pudo iniciar el servidor OAuth local: ${error.message}`);
  });
}

process.once('exit', () => {
  if (oauthServer && !oauthServer.killed) {
    oauthServer.kill();
  }
});

module.exports = {
  '/socket.io': {
    target: 'http://127.0.0.1:5000',
    ws: true,
    secure: false,
    changeOrigin: true,
    logLevel: 'debug'
  },
  '/api/auth/oauth': {
    target: 'http://127.0.0.1:5002',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug'
  },
  '/api/reports': {
    target: 'http://127.0.0.1:5000',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: {
      '^/api/reports': '/reports'
    }
  },
  '/api': {
    target: 'http://127.0.0.1:5000',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    pathRewrite: {
      '^/api': '/api'
    }
  },
  '/health': {
    target: 'http://127.0.0.1:5000',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug'
  }
};
