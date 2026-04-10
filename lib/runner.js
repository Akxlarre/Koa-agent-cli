/**
 * lib/runner.js — Async spawn wrapper
 *
 * Responsabilidad única: ejecutar comandos externos (npm, npx, git)
 * de forma asíncrona con soporte Windows.
 *
 * Importar NPM/NPX de aquí en cualquier módulo que los necesite.
 */

import { spawn } from 'child_process';

export const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
export const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

/**
 * Ejecuta un comando y rechaza si el exit code es distinto de 0.
 * Captura stderr para el mensaje de error.
 */
export function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, { ...opts, stdio: 'pipe', shell: process.platform === 'win32' });
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d.toString(); });
        proc.on('close', code => {
            if (code !== 0) reject(new Error(stderr.trim() || `Exit code ${code}`));
            else resolve();
        });
        proc.on('error', reject);
    });
}
