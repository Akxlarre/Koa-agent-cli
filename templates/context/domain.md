# Domain Context — {{PROJECT_NAME}}

> **Privado — gitignored.**
> Este archivo es la fuente de verdad del dominio de negocio para el agente.
> Léelo en el paso DESCUBRIR. No hay formato obligatorio — escribe lo que sea útil.
> Actualízalo cuando el negocio cambie, no cuando cambie el código.

**last_updated:** YYYY-MM-DD

---

## ¿Qué hace este producto?

<!-- Descripción funcional en 2-3 oraciones desde la perspectiva del usuario final.
     Ejemplo: "Plataforma de gestión de cosechas para agricultores.
               Permite registrar lotes, hacer seguimiento de rendimiento
               y generar reportes de rentabilidad por temporada." -->

## Usuarios del sistema

<!-- Quién usa el producto y qué necesitan lograr.
     Sé específico: "agricultores con baja experiencia técnica que
     registran desde el campo vía móvil" es mejor que "usuarios finales". -->

| Rol | Descripción | Permisos clave |
|-----|-------------|----------------|
| <!-- Ej: Administrador --> | | |
| <!-- Ej: Operador --> | | |

## Entidades clave del dominio

<!-- Los sustantivos del negocio. El agente necesita saber cómo se llaman
     las cosas en TU dominio, no solo cómo se llaman en el código.
     
     Formato: **NombreDeNegocio** (`NombreEnCódigo`) — descripción breve -->

- **<!-- Cosecha -->** (`<!-- HarvestEvent -->`) — <!-- descripción -->
- **<!-- Lote -->** (`<!-- Parcel -->`) — <!-- descripción -->

## Reglas de negocio críticas

<!-- Restricciones que NO están en el código y que el agente no puede inferir.
     Ejemplos de reglas bien documentadas:
       - "Un cliente solo puede tener UNA suscripción activa simultánea"
       - "El precio siempre incluye IVA — nunca mostrar precio neto al usuario"
       - "Los pedidos no se pueden eliminar, solo cancelar (por auditoría)" -->

1. <!-- Regla 1 -->
2. <!-- Regla 2 -->

## Terminología específica

<!-- Términos que usan tú y tu cliente que difieren del lenguaje técnico estándar.
     Esto evita que el agente use nombres incorrectos en código, comentarios y variables.
     
     Ejemplo:
     | Término del cliente | Término en código | Notas |
     |---------------------|-------------------|-------|
     | "cosecha"           | HarvestEvent      | Nunca usar "harvest" suelto |
     | "lote"              | Parcel            | No confundir con "batch" de procesamiento | -->

| Término del cliente | Término en código | Notas |
|---------------------|-------------------|-------|
| | | |

## Stakeholders / Cliente

<!-- Quién es el cliente, qué espera del producto, su contexto de negocio.
     El agente usa esto para priorizar trade-offs y tomar decisiones de diseño
     alineadas con las expectativas reales.
     
     Ejemplo: "StartupXYZ, equipo de 3 personas, lanzamiento en 60 días.
               Prioridad: velocidad de entrega > perfección técnica.
               El cliente es no-técnico y revisa la UI directamente." -->
