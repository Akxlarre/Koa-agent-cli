<div align="center">
  <h1>🧠 KOA Agent CLI</h1>
  <p><h3>El orquestador definitivo para el Arquitecto de Sistemas Agénticos (AI Workflow Engineer)</h3></p>
  
  <p>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20.0.0-success.svg?style=flat-square&logo=nodedotjs" alt="Node Version" /></a>
    <a href="https://github.com/angular/angular"><img src="https://img.shields.io/badge/Angular-%5E18.0.0-dd0031.svg?style=flat-square&logo=angular" alt="Angular" /></a>
    <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-DB-3ecf8e.svg?style=flat-square&logo=supabase" alt="Supabase" /></a>
    <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License: MIT"></a>
    <a href="#"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome"></a>
  </p>
</div>

---

**`koa-agent-cli`** es un motor de scaffolding construido en Node.js diseñado para generar ecosistemas de trabajo (Angular + Supabase) optimizados específicamente para ser operados por **Agentes Inteligentes** (ej. Claude 3.7 Sonnet, Claude Code).

## 💡 El Problema (La Gran Fricción)

En la era del software *AI-Native*, el cuello de botella ya no es la generación de código, sino la **orquestación**. Cuando lanzas una IA avanzada hacia un repositorio tradicional, el resultado suele ser código espagueti y deuda técnica acelerada.

Este CLI inyecta una **Arquitectura Estricta "Harness"** que domina la ventana de contexto de la IA. Transformamos a Claude de un asistente que "improvisa" a un teclado ultra-rápido operando bajo un *Shadow CI* que previene la deriva arquitectónica y garantiza resultados de grado enterprise.

---

## 🚀 Arquitectura v5.0 (Los 6 Pilares)

Nuestro andamiaje inyecta los "6 Superpoderes del Arquitecto Agéntico":

1. 🔍 **Context Engineering (LSP vía MCP):** El proyecto se genera con conectividad nativa a `ts-lsp-mcp`. La IA ya no es ciega; consulta el AST completo para inferir tipos y referencias cruzadas como lo hace tu IDE.
2. 🛠️ **Orquestación Atomizada (MCP):** Configuración lista para *Model Context Protocol* (`.mcp.json`). La IA delega código estructural disparando herramientas oficiales (`@angular/cli`, `supabase`) en vez de comandos bash impredecibles.
3. 🪝 **Sistema de Hooks Activos:** Constraints automáticos en tiempo real (ej. `pre-write-guard`, `bash-guard`) que operan en cada request, bloqueando a la IA al instante si intenta violar una regla de diseño, inyectando contexto dinámico de forma inteligente.
4. 🚧 **Guardrails Programáticos (Shadow CI):** Un validador AST (`architect.js`) que funciona como auditoría completa post-hoc (defensa en profundidad), rompiendo el proceso de compilación si se detecta deriva estructural.
5. 🤖 **Agentic TDD (Testing Autónomo):** Prohibición sistémica de entregar Features de lógica de negocio (Core) sin su correspondiente test unitario (`.spec.ts`), validado estáticamente.
6. 🎨 **Diseño Agnóstico y AI-Readability:** Bloqueo explícito del "Vibe Coding", forzando a la IA a usar *Design Tokens* predefinidos e inyectar el estándar *Shadow Semantic Overlay* (`data-llm-*`) para que el HTML renderizado siga siendo nativamente legible por otras IAs.

---

## ⚙️ Requisitos Previos

Antes de instalar `koa-agent-cli`, asegúrate de tener:
- **Node.js** v20.0.0 o superior ([Descargar](https://nodejs.org/)).
- **npm** (viene con Node) o tu gestor de paquetes favorito (`yarn`, `pnpm`).
- (Recomendado) Entorno preparado para Angular v18+ y un proyecto local de Supabase.

---

## 📦 Instalación

Puedes clonar el repositorio y enlazarlo globalmente en tu máquina para usar el comando en cualquier directorio:

```bash
git clone https://github.com/tu-usuario/koa-agent-cli.git
cd koa-agent-cli
npm install
npm link
```

---

## 🛠️ Uso y Scaffolding

Abre una consola en el directorio donde desees inicializar tu nuevo proyecto AI-Native y ejecuta:

```bash
create-koa-agent
```

*(Si no realizaste la instalación global, puedes usar: `node /ruta/a/koa-agent-cli/bin/index.js`)*

### El Asistente Interactivo

El CLI te ofrecerá opciones de inyección dependiendo de tus necesidades:

```text
? ¿Qué deseas hacer?
❯ Full Scaffold (Angular + PrimeNG + Supabase + Boilerplate AI)
  Inyectar "Memoria Claude" (Docs & Reglas) en carpeta actual
```

---

## 🏛️ Estructura Inyectada (El "Blueprint")

Al ejecutar el motor, este es el esqueleto de memoria y reglas inyectado para someter a tu IA:

```text
tu-nuevo-proyecto/
├── .claude/
│   ├── CLAUDE.md                   # Directiva maestra de estilo de programación (OnPush, Signals)
│   ├── hooks/                      # Guardrails en tiempo real (Pre-Write, Bash, Discovery)
│   └── rules/
│       ├── architecture.md         # Validaciones del Functional Core y Facades
│       ├── testing-tdd.md          # Flujos de validación Agentic TDD
│       ├── visual-system.md        # Tokens estandarizados (Tailwind/PrimeNG)
│       └── ai-readability.md       # Reglas obligatorias para usar atributos data-llm-*
├── docs/
│   ├── CLAUDE-USER-GUIDE.md        # Prompts recomendados para el usuario humano
│   ├── PRODUCT-VISION.md           # Visión fundacional para anclar a la IA
│   └── TECH-STACK-RULES.md         # Filosofía Smart vs Dumb components.
├── indices/                        # (Smart Memory) Índices dinámicos de componentes iterados por la IA
├── .mcp.json                       # Manifiesto para el Model Context Protocol
└── scripts/
    └── architect.js                # Linter semántico (TypeScript AST validator)
```

---

## 🤝 Filosofía Central

> *"Eres el Arquitecto Agéntico. Claude es tu Maestro de Obra y tu Teclado Ultra-rápido."*

Este motor existe porque el código autogenerado a mano alzada no escala. Tu trabajo humano ahora es pensar profundo; el de la IA es implementar rápido; y el de **koa-agent-cli** es garantizar que nadie rompa la base.

---

## 📜 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo `LICENSE` para más información.
