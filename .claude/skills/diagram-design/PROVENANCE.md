# Origen de esta skill

Copia de la skill `diagram-design` de https://github.com/cathrynlavery/diagram-design
(MIT, ver `LICENSE`), version 2.6.12 del plugin, commit vendorizado el 2026-09-04.

Se instalo como skill de proyecto (`.claude/skills/`) en vez de como plugin del
marketplace para que quede versionada junto al repo y disponible sin instalacion previa.
Para actualizarla, volver a copiar `skills/diagram-design/` desde upstream.

Los scripts `verify-*.py` del repo upstream (verificadores de geometria, motion, etc.)
NO viajan con la skill; solo `scripts/self_check.py`, que si esta incluido.
