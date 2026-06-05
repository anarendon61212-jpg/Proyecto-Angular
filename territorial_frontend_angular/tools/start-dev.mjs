import { spawn } from 'node:child_process';
import net from 'node:net';
import './github-oauth-dev-server.mjs';

const ANGULAR_HOST = '127.0.0.1';
const ANGULAR_PORT = 4200;
const angularCommand = process.platform === 'win32'
  ? {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', `npm exec ng serve -- --open --host ${ANGULAR_HOST} --port ${ANGULAR_PORT}`]
    }
  : {
      command: 'npm',
      args: ['exec', 'ng', 'serve', '--', '--open', '--host', ANGULAR_HOST, '--port', String(ANGULAR_PORT)]
    };

if (await isPortInUse(ANGULAR_HOST, ANGULAR_PORT)) {
  console.log(`Angular already running on http://localhost:${ANGULAR_PORT}`);
  console.log('GitHub OAuth dev server is ready. Press Ctrl+C to stop this process.');
} else {
  startAngular();
}

function startAngular() {
  const angular = spawn(angularCommand.command, angularCommand.args, {
    cwd: process.cwd(),
    env: {
      ...normalizedEnv(),
      GITHUB_OAUTH_PROXY_SKIP_START: '1'
    },
    shell: false,
    stdio: 'inherit'
  });

  angular.on('error', (error) => {
    console.error(`No se pudo iniciar Angular: ${error.message}`);
    process.exit(1);
  });

  angular.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

function normalizedEnv() {
  if (process.platform !== 'win32') {
    return process.env;
  }

  const env = {};

  for (const [key, value] of Object.entries(process.env)) {
    const existingKey = Object.keys(env).find((entry) => entry.toLowerCase() === key.toLowerCase());

    if (existingKey) {
      delete env[existingKey];
    }

    env[key] = value;
  }

  return env;
}

function isPortInUse(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.setTimeout(1000);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => {
      resolve(false);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}
