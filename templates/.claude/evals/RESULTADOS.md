# Resultados de corridas

Historial de `/eval-jueces`. Una linea por corrida del corpus completo.
Sirve para ver **deriva**: si un criterio que acertaba empieza a fallar despues
de tocar el prompt de un juez, aca se ve.

> Una corrida no es una medicion. El juez es estocastico: puede acertar 9 de 10
> veces y fallar justo en la tuya. Para dar por buena una reescritura de rubrica,
> corre el corpus 3 veces y mira la dispersion.

---

## 2026-08-29 — security-judge, corrida 1 (n=1)

Primera corrida del corpus. Contexto: se acababa de corregir el criterio S1, que
afirmaba algo falso sobre `WITH CHECK` (ver CHANGELOG 7.1.0).

| Fixture | Esperado | Obtenido | Resultado |
|---|---|---|---|
| `limpio-with-check-omitido` | APROBADO | APROBADO | ✅ |
| `limpio-catalogo-select-true` | APROBADO | APROBADO | ✅ |
| `limpio-solo-estilos` | APROBADO | APROBADO | ✅ |
| `s1-using-mas-amplio` | RECHAZADO S1 | RECHAZADO S1 (+S3) | ✅ |
| `s2-escalada-por-columna` | RECHAZADO S2 | RECHAZADO S2 (+S5) | ✅ |
| `s4-security-definer-sin-search-path` | RECHAZADO S4 | RECHAZADO S4 | ✅ |
| `s6-fuga-de-esquema-en-error` | RECHAZADO S6 | RECHAZADO S6 | ✅ |

```
Recall .................. 4/4 vulnerables detectados
Falsos positivos ........ 0/3 limpios rechazados
Criterio correcto ....... 4/4
Sin fixture todavia ..... S3, S5, S7, S8
```

### Lo que la corrida cambio

Tres cosas, ninguna prevista al escribir el corpus:

1. **Bug en el fixture `s1`.** Anclaba la policy en `profiles.team`, columna que
   no existe en el blueprint — la migracion habria fallado al crearse. El juez lo
   detecto solo. Corregido a `household_id`, que si existe.
2. **Criterios encadenados.** `s1` y `s2` disparan un segundo criterio legitimo
   (S3 y S5). No es ruido: es el efecto del mismo fallo. De ahi salio el campo
   `tambien_valido` del frontmatter.
3. **La clave de respuesta es legible.** El juez de `s4` aclaro que no abrio el
   fixture *a proposito*. Puede hacerlo: tiene `Read` sobre el repo. La skill
   ahora lo advierte y dice como aislar el patch si hace falta.

### Hallazgos del juez que superaron al fixture

Dos veces encontro mas de lo plantado, y ambos son reales:

- **`s4`** — yo habia plantado `SECURITY DEFINER` sin `search_path`. El juez
  agrego que PostgreSQL otorga `EXECUTE` a `PUBLIC` por defecto, asi que el
  `GRANT ... TO authenticated` no restringe nada y el RPC es alcanzable **sin
  sesion**. Es el agujero mas grave de los dos.
- **`s6`** — yo habia plantado la concatenacion de `details`/`hint`. El juez
  rastreo *por que* el sanitizador no lo atrapa: al cambiar `ErrorDeBd` por
  `Error` se pierde `code`, y `error-sanitizer.service.ts` trata un `Error` plano
  como texto ya redactado para el usuario (`constructor.name === 'Error'`).

### Candidatos a regla determinista

Lo que el juez detecto y podria bajarse a `architect.js`, dejando al juez para lo
que de verdad necesita razonamiento:

- `error.details` / `error.hint` referenciados en `src/app/core/repositories/**`
- `SECURITY DEFINER` sin `SET search_path` en `supabase/migrations/**`
- `CREATE FUNCTION` sin su `REVOKE EXECUTE ... FROM PUBLIC`
