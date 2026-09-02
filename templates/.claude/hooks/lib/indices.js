/**
 * lib/indices.js — Qué está registrado en un índice, de verdad
 *
 * HUE-014. `spec-diff-check` bloquea el commit cuando un componente o una facade
 * nuevos no figuran en su índice, y preguntaba así:
 *
 *     if (!componentsIndex.includes(selectorName) && !componentsIndex.includes(nombre))
 *
 * `String.includes` sobre el archivo ENTERO. Medido contra el `COMPONENTS.md`
 * que reparte el blueprint, con componentes inventados que no existen:
 *
 *     card       → "registrado"   (matchea dentro de `app-kpi-card`)
 *     icon       → "registrado"   (dentro de `app-icon`)
 *     block      → "registrado"   (dentro de `skeleton-block`)
 *     skeleton   → "registrado"
 *     tabla      → "registrado"   ← ni siquiera es un componente: está en la prosa
 *     x          → "registrado"   ← una sola letra
 *
 * Seis de siete pasan. Para cualquier nombre corto o común el guardrail es
 * decorativo: no bloquea porque casi nunca puede fallar.
 *
 * Lo que hay que preguntar no es «¿este texto aparece?» sino «¿hay una FILA que
 * declare este artefacto?». Los índices son tablas markdown y su primera celda
 * es el identificador, así que eso es exactamente comprobable.
 *
 * Micro-suite: `node --test .claude/tests/indices.test.js`
 */

/**
 * Una celda, sin su envoltorio.
 *
 * Los índices escriben el identificador de más de una forma legítima:
 * `` `app-kpi-card` ``, `` `<app-kpi-card>` ``, o pelado. Aceptar las tres es
 * deliberado: este dato decide si se BLOQUEA un commit, y el error caro acá es
 * el falso positivo — frenar por un componente que sí está registrado.
 */
function celda(texto) {
  return String(texto || '').trim().replace(/^`|`$/g, '').trim().replace(/^<|>$/g, '').trim();
}

/** Una línea de separación (`|---|---|`) o el encabezado de la tabla. */
const esSeparador = (l) => /^\|[\s|:-]+\|$/.test(l.trim());

/**
 * Los identificadores declarados: la primera celda de cada fila de tabla.
 *
 * Se descartan el separador y el encabezado —cuya primera celda es una etiqueta
 * (`Componente`, `Facade`, `Servicio`), no un artefacto—, que se reconoce porque
 * la fila siguiente es la línea de guiones.
 */
function declarados(contenido) {
  const lineas = String(contenido || '').split('\n');
  const out = new Set();

  for (let i = 0; i < lineas.length; i += 1) {
    const l = lineas[i].trim();
    if (!l.startsWith('|') || esSeparador(l)) continue;
    if (esSeparador((lineas[i + 1] || '').trim())) continue; // es el encabezado

    const primera = celda(l.slice(1).split('|')[0]);

    // Un identificador, no una celda cualquiera. `COMPONENTS.md` tiene además
    // una tabla de rutas cuya primera celda es «`/app/dashboard` —
    // `DashboardComponent`», y un guión largo como placeholder de fila vacía.
    // Nada de eso declara un artefacto, y dejarlo entrar solo agranda la
    // superficie de un falso «ya está registrado».
    if (/^[\w][\w.-]*$/.test(primera)) out.add(primera);
  }
  return out;
}

/**
 * Forma comparable de un nombre.
 *
 * El propio `COMPONENTS.md` del blueprint es inconsistente —tiene `app-icon` y
 * `skeleton-block` en la misma tabla—, así que el prefijo del selector no puede
 * decidir si algo está registrado. Se compara sin él, y sin mayúsculas.
 */
function normalizar(nombre) {
  // Primero a minúsculas y después se quita el prefijo: al revés, un `APP-Icon`
  // conserva su `APP-` y deja de coincidir con `app-icon`. Lo encontró su test.
  return celda(nombre).toLowerCase().replace(/^app-/, '');
}

/**
 * ¿Alguno de estos nombres tiene una fila propia en el índice?
 *
 * Varios nombres porque un mismo artefacto se puede declarar de más de una
 * forma legítima: `kpi-card` o `app-kpi-card`, `AuthFacade` en FACADES.md o en
 * SERVICES.md. Basta que UNO figure.
 */
function registrado(contenido, ...nombres) {
  const enElIndice = new Set([...declarados(contenido)].map(normalizar));
  return nombres.filter(Boolean).some((n) => enElIndice.has(normalizar(n)));
}

module.exports = { declarados, normalizar, registrado };
