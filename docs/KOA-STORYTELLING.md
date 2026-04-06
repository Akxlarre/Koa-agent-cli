# KOA -- Cómo contar qué es

> Guía de comunicación con técnicas de enseñanza modernas.
> Versión 1.0 | Marzo 2026

---

## 1. La Analogía Ancla (Scaffolding Cognitivo)

Toda explicación efectiva arranca con una **analogía que el oyente ya entiende**.

### La Analogía del Maestro de Obra

> Imagina que contratas a un albañil con superpoderes: puede levantar muros a la velocidad de la luz. El problema es que si no le das planos, normativas y un capataz que lo supervise, construye una casa que se cae sola.
>
> **KOA es los planos + las normativas + el capataz.**
> El albañil con superpoderes es la IA (Claude).
> La casa es tu aplicación web.

Esta analogía funciona porque:
- Todo el mundo entiende "construir una casa"
- Introduce la tensión correcta: **velocidad sin control = desastre**
- Posiciona a KOA como infraestructura, no como otro chatbot

---

## 2. Explicación Progresiva (Técnica de la Muñeca Rusa)

Adapta el nivel de detalle a quién te escucha. Cada capa contiene a la anterior.

### Capa 1 -- Para cualquier persona (10 segundos)

> KOA es una herramienta que le pone reglas a la inteligencia artificial para que escriba software profesional sin romper nada.

### Capa 2 -- Para alguien que sabe de tecnología (30 segundos)

> Cuando usas un agente de IA como Claude para programar, el resultado suele ser código desordenado y difícil de mantener. KOA genera un proyecto con guardrails automáticos: reglas, validadores y memoria que el agente no puede ignorar. Es como pasar de "pídele al agente que programe" a "el agente programa bajo un sistema de calidad enterprise".

### Capa 3 -- Para un desarrollador (60 segundos)

> KOA es un CLI en Node.js que genera proyectos Angular pre-configurados con un sistema de "harness" para agentes IA. Incluye:
>
> - **Hooks en tiempo real** que bloquean al agente si viola reglas arquitectónicas (OnPush, Facade pattern, design tokens)
> - **Inyección de contexto dinámico** que alimenta al agente con información relevante según el archivo que está editando
> - **Memoria viva** en índices Markdown que previenen duplicación y drift
> - **Un linter AST** que audita la arquitectura completa como safety net
>
> El agente pasa de "asistente que improvisa" a "teclado ultra-rápido que opera bajo tu arquitectura".

### Capa 4 -- Para un CTO o inversor (90 segundos)

> El cuello de botella del desarrollo con IA no es generar código; es que el código generado mantenga calidad enterprise. Hoy, los equipos gastan más tiempo corrigiendo al agente que programando ellos mismos.
>
> KOA convierte las reglas arquitectónicas de un **contrato social** (que la IA puede ignorar) a **constraints del sistema** (que la IA no puede violar). Un solo desarrollador con KOA produce software con la consistencia de un equipo de 10 personas con code reviews.
>
> El modelo de negocio es: vender el scaffolding como producto + ofrecer consultoría de arquitectura agéntica para equipos que quieran personalizar sus propios blueprints.

---

## 3. El Framework "Problema-Tensión-Resolución"

La estructura narrativa más efectiva para presentaciones, pitches y README.

### El Problema (lo que todos sienten)

Todo desarrollador que ha usado IA para programar ha vivido esto:

1. Le pides a Claude que cree un dashboard
2. El resultado "funciona", pero usa colores hardcodeados, inyecta servicios directamente, no sigue tu arquitectura
3. Le corriges. Vuelve a hacer lo mismo en otro archivo
4. Al cabo de 3 horas, tienes un Frankenstein: mitad tu estilo, mitad improvisación del agente
5. Terminas pensando: **"hubiera sido más rápido hacerlo yo"**

### La Tensión (por qué es un problema real)

Este problema **escala exponencialmente**. Cuanto más grande es el proyecto:
- Más contexto pierde el agente entre conversaciones
- Más reglas tiene que "recordar" (y no recuerda)
- Más deuda técnica se acumula en silencio
- Más caro es corregir el drift arquitectónico

El patrón actual es: **humano corrige a la IA en un loop infinito**. El agente no aprende entre sesiones. Las reglas no se ejecutan; se sugieren.

### La Resolución (lo que KOA cambia)

KOA invierte la ecuación:

| Sin KOA | Con KOA |
|---------|---------|
| Las reglas están en tu cabeza | Las reglas están en hooks que se ejecutan automáticamente |
| El agente "olvida" entre sesiones | Índices de memoria viva que persisten |
| Corriges después de que rompe | Se bloquea antes de que rompa |
| Cada proyecto empieza de cero | Un Blueprint replicable con tu arquitectura |
| El humano es QA del agente | El sistema es QA del agente |

**El resultado**: el humano piensa la arquitectura una vez. KOA la ejecuta siempre. El agente implementa rápido. Nadie corrige al agente manualmente.

---

## 4. Las 3 Frases que definen KOA

Memoriza estas. Sirven para cualquier contexto.

### La frase técnica
> "KOA inyecta guardrails automáticos en el contexto del agente para que el código generado por IA mantenga calidad enterprise."

### La frase de negocio
> "Con KOA, un solo desarrollador produce software con la consistencia de un equipo completo, porque la IA trabaja bajo las mismas reglas que tus mejores ingenieros."

### La frase emocional
> "KOA es la diferencia entre pedirle a alguien que programe y tener un sistema que garantiza que programe bien."

---

## 5. Storytelling: El Caso de Uso en Primera Persona

Para charlas, posts o demos. Cuenta la historia así:

> Yo era un desarrollador Angular que usaba Claude para acelerar mi trabajo. Al principio era mágico: le pedía componentes y aparecían en segundos. Pero pronto empecé a notar que el agente tomaba atajos. Hardcodeaba colores. Inyectaba servicios donde no debía. Creaba componentes duplicados porque no sabía qué ya existía.
>
> Pasaba más tiempo corrigiendo al agente que programando yo.
>
> Entonces me pregunté: si en el mundo real ponemos normas de construcción, inspectores y planos... ¿por qué no hacemos lo mismo con la IA?
>
> Así nació KOA. Un sistema que le pone al agente: planos (la arquitectura), inspectores (los hooks) y memoria (los índices). Ahora, cuando Claude intenta romper una regla, el sistema lo bloquea antes de que escriba una sola línea. Cuando abre un archivo, recibe automáticamente el contexto que necesita. Cuando empieza una nueva sesión, sabe exactamente qué componentes existen.
>
> Ya no corrijo al agente. Diseño la arquitectura y el agente la ejecuta.

---

## 6. Mapa Conceptual (Visual Thinking)

Para presentaciones o diagramas mentales.

```
                    ┌─────────────┐
                    │   HUMANO    │
                    │ (Arquitecto)│
                    └──────┬──────┘
                           │
                    Piensa la arquitectura
                    una sola vez
                           │
                           v
                    ┌─────────────┐
                    │     KOA     │
                    │ (El Sistema)│
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              v            v            v
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  REGLAS   │ │  HOOKS   │ │ MEMORIA  │
        │ (Qué)    │ │ (Cuándo) │ │ (Qué ya  │
        │          │ │          │ │ existe)   │
        └──────┬───┘ └────┬─────┘ └────┬─────┘
               │          │            │
               └──────────┼────────────┘
                          │
                          v
                   ┌─────────────┐
                   │   AGENTE    │
                   │  (Claude)   │
                   │             │
                   │ Implementa  │
                   │ rápido y    │
                   │ correcto    │
                   └─────────────┘
```

---

## 7. El Glosario Anti-Jerga

Cuando expliques KOA, traduce los términos técnicos:

| Término técnico | Traducción humana |
|----------------|-------------------|
| Scaffolding | Generar la estructura inicial de un proyecto |
| Blueprint | La plantilla con todas las reglas pre-configuradas |
| Guardrails | Barreras automáticas que impiden errores |
| Hooks | Código que se ejecuta automáticamente cuando el agente intenta hacer algo |
| Drift arquitectónico | Cuando el código se va alejando poco a poco del diseño original |
| Context injection | Darle al agente la información correcta en el momento correcto |
| Memoria viva | Archivos que registran qué componentes ya existen para que el agente no los duplique |
| Facade pattern | Una capa intermedia que simplifica cómo se accede a los datos |
| Design tokens | Variables de diseño (colores, tamaños) centralizadas en un solo lugar |
| AST linting | Revisar la estructura del código como un inspector de obra revisa los planos |
| Harness | El conjunto completo de controles que envuelven al agente |

---

## 8. Preguntas Frecuentes (Método Socrático)

Anticipa las preguntas y úsalas como estructura de conversación.

**"¿O sea que KOA programa por mí?"**
No. KOA no programa. KOA le pone reglas al agente que programa. Tú sigues siendo el arquitecto; KOA es el sistema de calidad.

**"¿Por qué no simplemente escribir un buen prompt?"**
Porque un prompt es una sugerencia. Un hook es una ley. El agente puede ignorar "usa OnPush en todos los componentes" si está en un prompt. No puede ignorarlo si hay un hook que bloquea el archivo cuando no lo detecta.

**"¿Solo funciona con Angular?"**
Hoy genera proyectos Angular + PrimeNG + Supabase. Pero el concepto de Blueprint (reglas + hooks + memoria) es agnóstico. La arquitectura de KOA está pensada para soportar otros stacks en el futuro.

**"¿En qué se diferencia de un linter o un CI/CD?"**
Un linter revisa después. KOA previene antes. El linter te dice "tienes un error en la línea 42". KOA bloquea al agente antes de que escriba esa línea 42. Es la diferencia entre un detector de incendios y una pared cortafuegos.

**"¿Quién necesita esto?"**
Cualquier desarrollador que use agentes IA para programar y quiera que el resultado sea mantenible. Especialmente: solo-founders, equipos pequeños sin QA dedicado, y consultoras que quieren replicar su arquitectura en múltiples proyectos.

---

## 9. El Elevator Pitch Final (15 segundos)

> Los agentes de IA ya saben programar. Lo que no saben es programar bien. KOA les enseña tu arquitectura y los obliga a seguirla. Resultado: software enterprise generado por IA, sin el caos.

---

## 10. Principios Pedagógicos Aplicados

Para referencia, estas son las técnicas usadas en este documento:

| Técnica | Dónde se aplica |
|---------|----------------|
| **Scaffolding cognitivo** (Vygotsky) | Analogía del Maestro de Obra como punto de partida |
| **Progresión concéntrica** (Bruner) | Muñeca Rusa: 4 niveles de profundidad |
| **Storytelling narrativo** (Campbell) | Historia en primera persona con arco problema-resolución |
| **Visual thinking** (Buzan) | Mapa conceptual Humano-KOA-Agente |
| **Método socrático** | FAQ como diálogo de preguntas anticipadas |
| **Traducción de jerga** (Feynman) | Glosario anti-jerga para eliminar barreras |
| **Framework PTR** (Problema-Tensión-Resolución) | Estructura narrativa central del pitch |
| **Regla del 3** (Retórica clásica) | 3 frases definitivas para memorizar |
| **Primacy effect** | Elevator pitch al final para que sea lo último que recuerdes |

---
---

# KOA v2 -- La esencia es el contexto

> Guía de comunicación reescrita con el eje correcto.
> Versión 2.0 | Marzo 2026

---

## El error de la v1

La v1 contaba KOA como un sistema de **control**: reglas, bloqueos, guardrails. Eso es cierto pero superficial. Es como describir un hospital diciendo "tiene paredes". Las paredes son necesarias, pero la esencia del hospital es la medicina.

La esencia de KOA no es controlar a la IA. Es **darle la información correcta, en el momento correcto, de forma que no pueda ignorar**.

Eso tiene un nombre: **Context Engineering**.

---

## 1. La Analogía Ancla (reescrita)

### v1: El Capataz
> KOA es el capataz que controla al albañil con superpoderes.

### v2: El Arquitecto que está en la obra
> Imagina un arquitecto que no solo dibuja los planos y se va. Este arquitecto está presente en cada momento de la construcción. Cuando el albañil va a levantar un muro, el arquitecto le muestra exactamente qué materiales usar, qué muros ya existen, y por qué este muro debe ir aquí y no allá.
>
> El albañil no necesita que lo "controlen". Necesita que lo **informen**.
>
> **KOA es ese arquitecto omnipresente.** No le dice "no" al agente. Le dice "esto es lo que necesitas saber ahora mismo para hacer esto bien".

El cambio de tono es importante:
- v1 posiciona al agente como un **problema que controlar** (restrictivo)
- v2 posiciona al agente como un **talento que potenciar** (empoderador)

---

## 2. La Tesis Central

> Un agente de IA no falla porque sea tonto. Falla porque le falta contexto.

Cuando Claude genera código malo no es por incapacidad. Es porque:
- No sabe qué componentes ya existen (duplica)
- No sabe qué patrones usa tu proyecto (improvisa)
- No sabe qué tokens de diseño tienes (hardcodea)
- No sabe qué regla acaba de violar (repite el error)

Cada uno de estos fallos es un **problema de contexto**, no de inteligencia.

KOA resuelve los cuatro:

| Fallo del agente | Causa real | Cómo KOA lo resuelve |
|-----------------|-----------|---------------------|
| Duplica componentes | No sabe qué ya existe | **Memoria viva**: índices que listan todo lo creado |
| Improvisa patrones | No conoce tu arquitectura | **Reglas inyectadas**: se cargan en su contexto automáticamente |
| Hardcodea valores | No conoce tus tokens | **Context injection**: al editar SCSS/HTML, recibe los tokens disponibles |
| Repite errores | No sabe qué hizo mal | **Hooks con feedback**: el bloqueo incluye el *por qué* y el *qué hacer* |

---

## 3. Explicación Progresiva (reescrita con eje en contexto)

### Capa 1 -- Para cualquier persona (10 segundos)

> KOA es un sistema que le da a la inteligencia artificial toda la información que necesita para programar bien, justo cuando la necesita.

### Capa 2 -- Para alguien que sabe de tecnología (30 segundos)

> Los agentes de IA generan código malo no porque sean tontos, sino porque les falta contexto. No saben qué ya existe en tu proyecto, qué reglas sigues, ni qué tokens de diseño usas. KOA resuelve esto: genera un proyecto donde el agente recibe automáticamente la información correcta según lo que está haciendo. Si edita un componente, recibe la arquitectura. Si toca estilos, recibe los tokens. Si intenta crear algo que ya existe, recibe el índice. El resultado: código enterprise sin correcciones manuales.

### Capa 3 -- Para un desarrollador (60 segundos)

> KOA es un CLI de Node.js que genera proyectos Angular con un sistema de **context engineering** para agentes IA. La premisa: el agente ya sabe programar; lo que no tiene es tu contexto.
>
> KOA opera en 4 capas de contexto:
>
> 1. **Contexto persistente** -- Reglas arquitectónicas (`.claude/rules/`) y la directiva maestra (`CLAUDE.md`) se cargan en cada sesión del agente. Siempre sabe *cómo* debe programar.
> 2. **Contexto situacional** -- Hooks de context injection que detectan *qué tipo de archivo* está editando el agente y le inyectan información específica: tokens si toca SCSS, facades si toca features, componentes existentes si toca shared.
> 3. **Contexto acumulativo** -- Índices de memoria viva (`indices/*.md`) que registran qué componentes, servicios y modelos existen. El agente siempre sabe *qué hay* antes de crear algo nuevo.
> 4. **Contexto correctivo** -- Cuando un hook bloquea una acción, no solo dice "no". Incluye la regla violada, la solución sugerida y un enlace a la documentación. El agente aprende *por qué* falló y *qué hacer*.
>
> Todo esto es automático. El humano diseña la arquitectura una vez. KOA la convierte en contexto que el agente no puede ignorar.

### Capa 4 -- Para un CTO o inversor (90 segundos)

> El problema del desarrollo con IA no es que el agente no sepa programar. Es que no tiene el contexto de tu empresa: tu arquitectura, tus estándares, lo que ya existe. Sin ese contexto, cada sesión con el agente es una lotería.
>
> KOA es un sistema de **context engineering** que inyecta automáticamente el conocimiento arquitectónico de tu organización en el flujo de trabajo del agente. Reglas, patrones, inventario de componentes, tokens de diseño -- todo llega al agente en el momento exacto que lo necesita.
>
> El resultado: un solo desarrollador con KOA produce software con la consistencia de un equipo senior completo. No porque la IA sea "más lista", sino porque tiene la información correcta para tomar buenas decisiones.
>
> Y lo clave: este contexto se diseña una vez y se replica en cada proyecto. Es la arquitectura de tu empresa convertida en infraestructura de IA.

---

## 4. Las 3 Frases (reescritas)

### La frase técnica
> "KOA es context engineering para agentes de IA: inyecta la información correcta, en el momento correcto, de forma que no se puede ignorar."

### La frase de negocio
> "KOA convierte la arquitectura de tu empresa en contexto automático para la IA. Un desarrollador produce como un equipo completo porque el agente siempre tiene la información que necesita."

### La frase emocional
> "La IA no necesita que la controlen. Necesita que la informen. KOA es esa información."

---

## 5. El Framework Problema-Tensión-Resolución (reescrito)

### El Problema

Todo desarrollador que ha usado IA para programar ha vivido esto:

1. Le pides a Claude que cree un componente
2. Lo crea bien... pero con colores hardcodeados porque no sabía que tienes design tokens
3. Le pides otro componente. Crea uno casi idéntico a uno que ya existía
4. Le dices "usa el patrón Facade". Lo usa. En el siguiente archivo, se le olvida

El patrón es siempre el mismo: **el agente no falla por incapacidad. Falla por amnesia.**

### La Tensión

Esto genera un loop destructivo:

```
Humano pide → Agente hace (sin contexto) → Humano corrige → Agente rehace
     ↑                                                           │
     └───────────────────────────────────────────────────────────┘
```

Cada vuelta del loop cuesta tiempo. Y lo peor: **el agente no acumula aprendizaje entre sesiones**. Mañana vas a tener que corregirle exactamente lo mismo.

El humano se convierte en QA del agente. El agente es rápido pero ciego. La velocidad no sirve si vas en la dirección equivocada.

### La Resolución

KOA rompe el loop inyectando contexto en cada punto de fallo:

```
Humano diseña arquitectura (1 vez)
            │
            v
    KOA convierte arquitectura en contexto
            │
            v
Agente recibe contexto → Agente hace (con contexto) → Resultado correcto
```

No hay loop de corrección porque **el agente tiene la información antes de actuar**:
- Antes de crear un componente, sabe cuáles ya existen
- Antes de escribir estilos, sabe qué tokens usar
- Antes de tocar un servicio, sabe qué patrón seguir
- Si viola algo, sabe por qué y cómo corregirlo

**El humano deja de ser QA del agente y vuelve a ser arquitecto.**

---

## 6. Storytelling (reescrito)

> Yo usaba Claude para programar. Era rápido, pero me di cuenta de algo: cada vez que le pedía algo, tenía que re-explicarle mi arquitectura. Mis reglas. Mis tokens de diseño. Qué componentes ya existían. Era como trabajar con alguien brillante que tiene amnesia total.
>
> Un día lo entendí: el problema no era Claude. El problema era que Claude no tenía mi contexto. Y sin contexto, la inteligencia no alcanza.
>
> Entonces construí KOA. No un sistema que le diga "no" al agente. Un sistema que le diga "esto es lo que necesitas saber". Automáticamente. En cada archivo que toca. En cada sesión que empieza.
>
> Ahora cuando Claude abre un archivo de estilos, ya sabe mis tokens. Cuando crea un componente, ya sabe cuáles existen. Cuando toca un servicio, ya sabe que debe usar Facade.
>
> No cambié al agente. Le cambié el contexto. Y todo cambió.

---

## 7. Mapa Conceptual (reescrito)

```
                         ┌──────────────┐
                         │    HUMANO    │
                         │  (Arquitecto)│
                         └──────┬───────┘
                                │
                     Diseña la arquitectura
                         (1 sola vez)
                                │
                                v
         ┌──────────────────────────────────────────┐
         │              KOA                          │
         │      (Context Engineering)                │
         │                                           │
         │  Transforma arquitectura → contexto       │
         │                                           │
         │  ┌────────────┐  ┌────────────────────┐  │
         │  │ Persistente│  │    Situacional      │  │
         │  │ (reglas,   │  │ (injection por tipo │  │
         │  │  CLAUDE.md)│  │  de archivo)        │  │
         │  └────────────┘  └────────────────────┘  │
         │  ┌────────────┐  ┌────────────────────┐  │
         │  │ Acumulativo│  │    Correctivo       │  │
         │  │ (indices/  │  │ (hooks con feedback │  │
         │  │  memoria)  │  │  + solución)        │  │
         │  └────────────┘  └────────────────────┘  │
         └──────────────────────┬───────────────────┘
                                │
                    Contexto correcto,
                    momento correcto,
                    imposible de ignorar
                                │
                                v
                      ┌──────────────┐
                      │    AGENTE    │
                      │   (Claude)   │
                      │              │
                      │  Informado   │
                      │  = Efectivo  │
                      └──────────────┘
```

---

## 8. Elevator Pitch Final (15 segundos)

> Los agentes de IA ya saben programar. Lo que no tienen es tu contexto. KOA se lo da: automáticamente, en cada archivo, en cada sesión. Resultado: código enterprise sin correcciones humanas.

---

## 9. La diferencia filosófica entre v1 y v2

| | v1 (Control) | v2 (Contexto) |
|---|---|---|
| Metáfora | Capataz | Arquitecto omnipresente |
| Tono | "Le ponemos reglas" | "Le damos información" |
| Posición del agente | Problema a controlar | Talento a potenciar |
| Verbo clave | Bloquear | Informar |
| Emoción | Seguridad | Inteligencia |
| Lo que vende | "No rompe nada" | "Hace todo bien" |
| Frase ancla | "Constraints que no puede violar" | "Contexto que no puede ignorar" |

La v2 es más potente porque:
- **Escala mejor**: "control" tiene un techo; "contexto" no
- **Atrae más**: nadie quiere comprar "control de IA"; todos quieren "IA que funciona bien"
- **Es más precisa**: técnicamente, KOA no "controla" a Claude; le da información y Claude toma mejores decisiones
- **Abre el futuro**: cuando KOA evolucione a RAG, MCP Server, y AI UI (v7), el frame de contexto sigue siendo válido; el de control se queda corto
