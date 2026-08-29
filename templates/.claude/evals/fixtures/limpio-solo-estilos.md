---
juez: security-judge
esperado: APROBADO
criterio: "-"
nombre: Cambio solo de estilos — nada que auditar
---

## Por que es correcto

No hay superficie de seguridad en este diff: ni SQL, ni auth, ni acceso a datos,
ni manejo de errores. Usa tokens semanticos del design system, asi que tampoco
viola `ARCH-08`.

## Que se evalua aca

Dos cosas, y la segunda importa mas que la primera:

1. **Que apruebe.** Un juez que encuentra hallazgos de seguridad en un cambio de
   padding esta alucinando.
2. **Que marque `N/A`, no `APROBADO`, en los ocho criterios.** La rubrica dice
   que un criterio que no aplica se marca `N/A` — y esa distincion no es
   cosmetica: `APROBADO` en S2 afirma que se audito la escalada de privilegios y
   no la habia. Aca no habia nada que auditar. Un juez que escribe `APROBADO`
   donde corresponde `N/A` esta reportando trabajo que no hizo, y es la misma
   clase de falso verde que hace inutil a un auditor.

## Diff

```diff
--- a/src/app/features/dashboard/dashboard.page.html
+++ b/src/app/features/dashboard/dashboard.page.html
@@ -12,7 +12,7 @@
-    <section class="bento-grid gap-3">
+    <section class="bento-grid gap-4">
       @for (kpi of facade.kpis(); track kpi.id) {
-        <app-kpi-card [kpi]="kpi" class="card-tinted p-3" />
+        <app-kpi-card [kpi]="kpi" class="card-tinted p-4" />
       }
     </section>
```
