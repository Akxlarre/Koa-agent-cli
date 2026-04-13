/**
 * lib/preflight.js — System requirements check
 *
 * Verifica que el entorno del usuario tenga Node.js, npm, npx, git y docker
 * antes de iniciar el scaffolding. Termina el proceso con exit(1) si falla
 * algún requisito crítico.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { parseMajor, MIN_NODE_MAJOR, validateBlueprintJson } from './config.js';

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

/**
 * Ejecuta un comando y devuelve { ok, label, stdout, stderr, exitCode }.
 * Con fatal=true, ok=false si el exit code es distinto de 0.
 * Soporta timeout opcional en ms.
 */
export function checkCommand(cmd, args = [], { fatal = false, label = cmd, timeoutMs } = {}) {
    return new Promise((resolve) => {
        const proc = spawn(cmd, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
        });
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });

        let timeout;
        if (timeoutMs) {
            timeout = setTimeout(() => {
                proc.kill();
                resolve({ ok: !fatal, label, stdout: stdout.trim(), stderr: (stderr || 'timeout').trim(), timedOut: true });
            }, timeoutMs);
        }

        proc.on('close', (code) => {
            if (timeout) clearTimeout(timeout);
            const ok = code === 0;
            resolve({ ok: ok || !fatal, label, stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code });
        });
        proc.on('error', (err) => {
            if (timeout) clearTimeout(timeout);
            resolve({ ok: !fatal, label, stdout: stdout.trim(), stderr: String(err?.message || err).trim(), error: err });
        });
    });
}

/** Verifica Node.js, npm, npx (fatales) y git, docker (warnings). */
export async function preflight() {
    const major = parseMajor(process.versions.node);
    if (!major || major < MIN_NODE_MAJOR) {
        console.error(chalk.red(`Node.js ${MIN_NODE_MAJOR}+ requerido. Detectado: ${process.versions.node}`));
        process.exit(1);
    }

    const npmRes = await checkCommand(NPM, ['--version'], { fatal: true, label: 'npm --version' });
    if (!npmRes.ok) {
        console.error(chalk.red(`Falta npm o no es ejecutable. Detalle: ${npmRes.stderr || 'desconocido'}`));
        process.exit(1);
    }

    const npxRes = await checkCommand(NPX, ['--version'], { fatal: true, label: 'npx --version' });
    if (!npxRes.ok) {
        console.error(chalk.red(`Falta npx o no es ejecutable. Detalle: ${npxRes.stderr || 'desconocido'}`));
        process.exit(1);
    }

    const gitRes = await checkCommand('git', ['--version'], { fatal: false, label: 'git --version' });
    if (!gitRes.ok) {
        console.warn(chalk.yellow('⚠ git no está disponible. Se recomienda instalarlo para versionar tu proyecto.'));
    }

    const dockerRes = await checkCommand('docker', ['info'], { fatal: false, label: 'docker info', timeoutMs: 3000 });
    if (!dockerRes.ok) {
        console.warn(chalk.yellow('⚠ docker no está disponible o no responde (ok si no usarás contenedores).'));
    }

    // Validar blueprint.json si existe (modo re-run / upgrade)
    const bpPath = path.join(process.cwd(), 'blueprint.json');
    if (fs.existsSync(bpPath)) {
        try {
            const bp = JSON.parse(fs.readFileSync(bpPath, 'utf8'));
            const result = validateBlueprintJson(bp);
            if (!result.ok) {
                console.warn(chalk.yellow('⚠ blueprint.json inválido:'));
                result.errors.forEach(e => console.warn(chalk.yellow(`  · ${e}`)));
            } else {
                console.log(chalk.green(`   ✓ blueprint.json válido (v${bp.version}, mode: ${bp.mode})`));
            }
        } catch {
            console.warn(chalk.yellow('⚠ No se pudo parsear blueprint.json — puede estar corrupto.'));
        }
    }
}
