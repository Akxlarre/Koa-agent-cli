# FICHA B — <ID> · <nombre de la unidad>

<!--
NIVEL B — piezas de PROSA: reglas, skills, comandos.
No tienen ruta de fallo ejecutable, así que la rúbrica es otra: la pregunta no es
"¿puede fallar?" sino "¿se dispara cuando debe, dice algo verdadero, y vale lo que cuesta?"
Copiar a ../fichas/<ID>-<slug>.md. Más corta que la ficha A a propósito — 6 campos.
-->

| | |
|---|---|
| **Archivo** | `templates/.claude/____/____.md` |
| **Tipo** | regla · skill · comando |
| **Invocación** | path-scoped · model-invocable · user-invocable · disparada por otra pieza |
| **Revisado** | YYYY-MM-DD |
| **Estado** | pendiente · en curso · cerrada |

---

## 1. Qué dice

<!-- El contenido normativo en 1-3 líneas. Si no lo podés resumir, la pieza probablemente
     esté mezclando temas (posible hallazgo de altitud). -->



## 2. Disparo

- **Frontmatter (`paths:` / `description:` / `allowed-tools:`):**

```yaml

```

**¿Se dispara cuando debería?**
<!-- Para path-scoped: ¿los globs cubren los archivos donde la regla realmente importa?
     ¿Cubren de más? Un `paths:` demasiado ancho es un CAR: se inyecta donde no aporta.
     Para model-invocable: ¿la description tiene frases de disparo reales, o es genérica? -->



**¿Hay archivos donde debería aplicar y no aplica?**



## 3. ¿Es verdad hoy?

<!-- La prosa se desactualiza en silencio, que es el INC más común del repo.
     Verificar contra el CÓDIGO REAL, no contra otra prosa. -->

| Afirmación de la pieza | ¿Se sostiene contra el código? | Evidencia |
|---|---|---|
| | | |

**¿Menciona números, nombres de archivo o comandos?**
<!-- Cada número (cantidad de reglas, de hooks, de índices), cada ruta y cada script
     mencionado se verifica. Es donde salen los INC baratos y reales. -->

- [ ] Todos los números verificados contra el código
- [ ] Todas las rutas mencionadas existen
- [ ] Todos los comandos mencionados están en `package.json` y corren

## 4. Colisiones

<!-- Alimenta la Lente 2 del pase general (autoridad duplicada). -->

- **¿Otra pieza dice lo mismo?**

| Pieza | Qué dice de lo mismo | ¿Coinciden? |
|---|---|---|
| | | |

- **¿Otra pieza dice lo contrario?** → `DUP-___` o `INC-___`
- **¿Un hook o script valida esto mismo?**
  <!-- Si un guardrail ya lo bloquea, la prosa puede ser redundante (CAR) — o al revés:
       si la prosa lo pide y nada lo valida, es una guideline disfrazada de regla (HUE). -->

## 5. Mecanismo

- **¿Tiene un guardrail que la respalde?** sí, `____` · **no**
- **Si no lo tiene: ¿debería?**

<!-- El principio del repo es convertir guidelines en guardrails. Una regla sin mecanismo
     es un contrato social. Está bien que algunas lo sean (las de diseño, que solo ve
     code-judge) — lo que no está bien es no saber cuáles. -->

- **Clasificación:** mecanizada · mecanizable pero no mecanizada (`HUE-___`) · irreducible a mecanismo

## 6. Costo / beneficio

- **Cuándo se carga y cuánto pesa:** <siempre · solo al matchear · aprox. N líneas>
- **¿Alguien la lee de verdad?**
  <!-- Indicio útil: ¿aparece citada en fichas de otras piezas, en learnings, en anti-patterns?
       Una regla que nadie referencia y que ningún hook aplica probablemente sea peso muerto. -->
- **Veredicto:** vale la pena · fusionable con `____` · **peso muerto → `CAR-___`**

---

## Hallazgos de esta unidad

| ID | Tipo | Una línea |
|---|---|---|
| | | |

## Notas para el pase general

-
