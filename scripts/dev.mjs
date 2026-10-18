import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const RESET = '\x1b[0m';

const targets = [
  {
    name: 'backend',
    color: '\x1b[34m',
    cwd: path.join(root, 'backend'),
    bin: 'node_modules/nodemon/bin/nodemon.js',
    args: ['server.js'],
  },
  {
    name: 'frontend',
    color: '\x1b[32m',
    cwd: path.join(root, 'frontend'),
    bin: 'node_modules/vite/bin/vite.js',
    args: [],
  },
];

const children = [];
let shuttingDown = false;

function makeWriter(name, color, out) {
  const tag = `${color}[${name}]${RESET} `;
  let buffer = '';
  return (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) out.write(`${tag}${line}\n`);
  };
}

function killTree(pid) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* noop */
      }
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.pid) killTree(child.pid);
  }
  setTimeout(() => process.exit(code), 300);
}

for (const target of targets) {
  const bin = path.join(target.cwd, target.bin);
  if (!existsSync(bin)) {
    console.error(`No se encontró "${bin}". Ejecuta "npm run install:all" primero.`);
    process.exit(1);
  }

  const child = spawn(process.execPath, [bin, ...target.args], {
    cwd: target.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  children.push(child);
  child.stdout.on('data', makeWriter(target.name, target.color, process.stdout));
  child.stderr.on('data', makeWriter(target.name, target.color, process.stderr));
  child.on('exit', (code) => {
    if (!shuttingDown) {
      process.stdout.write(
        `${target.color}[${target.name}]${RESET} proceso terminado (código ${code})\n`,
      );
      shutdown(code ?? 0);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
