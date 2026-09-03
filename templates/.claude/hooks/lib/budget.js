/**
 * lib/budget.js — Lo que un hook puede permitirse decir
 *
 * Cada inyeccion paga renta en la ventana de contexto. Tres hooks la pagaban sin
 * ningun control:
 *
 *   CAR-001 (S1)  plan-injector inyecta ~24.600 chars en CADA Edit, sin dedup ni
 *                 techo. Diez ediciones = ~61.000 tokens del mismo contrato.
 *   HUE-017       compact-recovery no tiene tope: los cuatro context/*.md enteros.
 *   DEC-006       su filtro de 80 chars mide el archivo sin comentarios HTML, y las
 *                 plantillas de context/ pasan igual porque el andamiaje markdown
 *                 —encabezados, blockquotes de instrucciones— ya suma mas de 80.
 *                 Medido: brief 456, domain 760, constraints 327, learnings 457.
 *                 Se inyectan enteras en un proyecto que nunca las lleno.
 *
 * Una sola primitiva: «esto ya lo dije, y esto es lo maximo que puedo decir».
 *
 * La dedup vive en AMBITO DE HILO, no de sesion (ADR-003 §1): «ya lo dije» es una
 * afirmacion sobre un contexto, y el subagente tiene el suyo. Si fuera de sesion,
 * el primer subagente que editara algo se llevaria la unica emision y el hilo
 * principal —el que le habla a la persona— no veria nada.
 *
 * Ver docs/diseno/ADR-001 §4.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const session = require('./session.js');

/** Marcador que los indices ya usan para separar referencia de ejemplos. */
const DETAIL_MARKER = '<!-- DETAIL:BEGIN -->';

/** Por debajo de esto, un archivo de context/ es plantilla sin llenar. */
const MIN_CONTENIDO_REAL = 80;

/**
 * Contenido real de un markdown: lo que escribio la persona, sin el andamiaje
 * de la plantilla.
 *
 * DEC-006 fallaba por quitar solo los comentarios HTML. Se quitan ademas los
 * encabezados, los blockquotes —que en estas plantillas son instrucciones al
 * humano— y los bullets y filas vacios. Medido sobre templates/context/: las
 * cuatro plantillas caen a 0-66 chars, y un brief realmente llenado da 96.
 */
function contenidoReal(texto) {
  return String(texto || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^\s*>.*$/gm, '')
    .replace(/^\s*#{1,6}\s.*$/gm, '')
    .replace(/^\s*[-*+]\s*$/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Es una plantilla que nadie lleno? Entonces no vale ni un token. */
function isPlaceholder(texto, { minChars = MIN_CONTENIDO_REAL } = {}) {
  return contenidoReal(texto).length < minChars;
}

/**
 * Marcador que los indices traen mientras `indices:sync` no encontro nada.
 * Lo escribe el propio blueprint en 8 de los 15 indices.
 */
const SIN_ENTRADAS = 'Sin entradas auto-detectadas';

/**
 * Filas de DATOS de una tabla markdown: sin encabezado ni separador.
 *
 * `contenidoReal` quita las filas de tabla a proposito —en las plantillas de
 * `context/` una tabla vacia es andamiaje— pero en un INDICE la tabla ES el
 * contenido. Esta funcion existe para esa asimetria, no para deshacerla.
 */
function filasDeTabla(texto) {
  const filas = String(texto || '').split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));

  let datos = 0;
  let despuesDelSeparador = false;
  for (const f of filas) {
    if (/^\|[\s|:-]+\|$/.test(f)) { despuesDelSeparador = true; continue; }
    if (despuesDelSeparador) datos++;
  }
  return datos;
}

/**
 * Esta superficie sigue sin llenar?
 *
 * DEC-008 / DEC-006 — tres formas de estar vacio, y los detectores que habia
 * atrapaban una sola:
 *
 *   prosa que es solo andamiaje         → isPlaceholder
 *   una tabla sin ninguna fila de datos → filasDeTabla
 *   el marcador que deja indices:sync   → SIN_ENTRADAS
 *
 * Las tres tienen que fallar para que la superficie cuente como llena. Un
 * `indices/DATABASE.md` recien generado tiene una fila (`profiles`, que el
 * blueprint siembra) y aun asi trae el marcador: sigue vacio de dominio, y eso
 * es lo que el Day 0 Guard pregunta.
 */
function sinLlenar(texto, { minChars = MIN_CONTENIDO_REAL } = {}) {
  const s = String(texto || '');
  if (s.includes(SIN_ENTRADAS)) return true;
  if (filasDeTabla(s) > 0) return false;
  return isPlaceholder(s, { minChars });
}

/** Corta en DETAIL:BEGIN y aplica el techo, con marca explicita de recorte. */
function recortar(texto, { maxChars = 0, cutAt = DETAIL_MARKER } = {}) {
  let out = String(texto || '');
  if (cutAt) {
    const i = out.indexOf(cutAt);
    if (i > -1) out = out.slice(0, i).trimEnd();
  }
  if (maxChars && out.length > maxChars) {
    out = out.slice(0, maxChars).trimEnd() + '\n… (recortado — lee el archivo para el resto)';
  }
  return out;
}

/**
 * Decide si este contenido se inyecta, y en que tamano.
 *
 * @returns {string|null} el texto a emitir, o `null` si no corresponde decir nada.
 *
 * Opciones:
 *   maxChars         techo duro; por encima recorta y lo dice
 *   cutAt            marcador donde cortar (por defecto DETAIL:BEGIN)
 *   repeatEvery      cada cuantas emisiones se permite repetir. 0 = nunca repetir
 *   skipPlaceholder  si el contenido es plantilla sin llenar, no se emite
 *   scope            'hilo' (default) o 'sesion'
 */
function inject(payload, key, content, {
  maxChars = 0,
  cutAt = DETAIL_MARKER,
  repeatEvery = 0,
  skipPlaceholder = false,
  scope = 'hilo',
} = {}) {
  if (skipPlaceholder && isPlaceholder(content)) return null;

  const texto = recortar(content, { maxChars, cutAt });
  if (!texto.trim()) return null;

  const clave = `budget-${key}.json`;
  const estado = session.readState(payload, clave, { scope }) || { n: 0, hash: null };
  const hash = huella(texto);

  // La dedup es por lo que se dijo, no por la clave: si el contenido cambio es
  // informacion nueva y se emite aunque la cuota no se haya cumplido.
  if (estado.hash === hash) {
    if (repeatEvery <= 0) return null;
    if (estado.n + 1 < repeatEvery) {
      session.writeState(payload, clave, { n: estado.n + 1, hash }, { scope });
      return null;
    }
  }

  session.writeState(payload, clave, { n: 0, hash }, { scope });
  return texto;
}

/**
 * Avisar una sola vez.
 *
 * ADR-002 §2 pedia un `lib/notify.js` para esto. Al implementarlo resulto que
 * la maquinaria es la misma que `inject`: «esto ya lo dije, no lo repito». Un
 * modulo aparte seria la misma logica escrita dos veces — el error que la ficha
 * H-03 nos hizo cometer con las rutas.
 *
 * Asi que es una funcion con NOMBRE PROPIO en el mismo modulo, no un modulo
 * nuevo. La diferencia con `inject` es de intencion y de destino: `inject`
 * enriquece el contexto por stdout; `avisar` le habla a la persona por stderr.
 * Que compartan el mecanismo es correcto; que se llamen igual, no.
 *
 * El default es NO repetir. Un hook que quiera insistir tiene que pedirlo, que
 * es la direccion correcta: hoy el default es insistir y hay que acordarse de
 * evitarlo (CAR-002).
 *
 * @returns {string|null} el mensaje a emitir, o null si ya se dijo.
 */
function avisar(payload, key, mensaje, { repeatEvery = 0, scope = 'hilo' } = {}) {
  return inject(payload, `aviso-${key}`, mensaje, { repeatEvery, scope, cutAt: null });
}

/**
 * Olvida lo dicho: la proxima vez se vuelve a emitir.
 *
 * La dedup significa «ya lo dije Y vos todavia lo tenes». Tras una compactacion
 * la segunda mitad es falsa: el agente perdio el contexto. Sin esto, un hook que
 * dedupica por sesion callaria para siempre sobre algo que el agente ya no ve.
 * Lo llama compact-recovery.
 */
function olvidar(payload, { scope = 'hilo' } = {}) {
  const dir = scope === 'hilo' ? session.threadScope(payload) : session.sessionScope(payload);
  let borradas = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.startsWith('budget-') || !f.endsWith('.json')) continue;
      fs.rmSync(path.join(dir, f), { force: true });
      borradas++;
    }
  } catch { /* fail-open */ }
  return borradas;
}

/** Ya se emitio algo bajo esta clave en este ambito? Sin efectos secundarios. */
function yaEmitido(payload, key, { scope = 'hilo' } = {}) {
  return session.readState(payload, `budget-${key}.json`, { scope }) !== null;
}

function huella(s) {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
}

module.exports = {
  inject,
  avisar,
  olvidar,
  yaEmitido,
  isPlaceholder,
  sinLlenar,
  filasDeTabla,
  SIN_ENTRADAS,
  contenidoReal,
  recortar,
  DETAIL_MARKER,
  MIN_CONTENIDO_REAL,
};
