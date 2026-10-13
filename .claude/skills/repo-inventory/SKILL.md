---
name: repo-inventory
description: "Recorre todo el proyecto con un script de solo lectura y entrega el inventario: tamaño por carpeta, archivos más grandes, archivos que nadie importa, páginas del frontend, entradas del backend, canales de alerta, variantes y experimentos, y variables de entorno (solo nombres). Usar antes de planear cualquier limpieza o refactor, al elegir qué alerta se queda, y después de cada limpieza para ver qué cambió."
---

# Inventario del repositorio

Sirve para saber qué hay sin abrir archivos uno por uno. Es lo primero que se corre en cada sesión de limpieza.

## Cómo se corre

```bash
cd /private/tmp && python3 -I /Volumes/KINGSTON/7777/gitHub/ReversionMediaTrading/.claude/skills/repo-inventory/inventory.py
```

- Solo lee `NestServer/src` y `Client/src`. No toca `.env`, no usa la red y no escribe nada.
- `--top 30` lista más archivos grandes.
- La salida es Markdown: se puede guardar en `docs/refactor/INVENTORY.md` para comparar antes y después.

## Cómo leerlo

- **Archivos que nadie importa** son candidatos, no veredictos. El script sigue los imports relativos; no ve lo que se
  carga por nombre o por patrón (entidades de MikroORM, scripts de `package.json`, historias de Storybook). Antes de
  proponer quitar uno: buscar su nombre con `grep -rn` en todo el repo y en los `package.json`.
- **Variantes y experimentos** salen por el nombre del archivo (`Exp`, `Experimental`, `reforced`, `v2`…). Una
  variante sin sufijo no aparece: hay que cruzarlo con `AGENTS.md` (producción frente a experimental).
- **Canales de alerta** dicen dónde se nombra Telegram, sonido o notificación, no cuál alerta se dispara. Para eso
  hay que leer el servicio.
- **Variables de entorno**: solo nombres. Los valores no se leen nunca.

## Qué hacer con el resultado

1. Clasificar cada página, motor de señal e indicador en: **en uso** (el usuario lo mira para operar), **en duda** y
   **abandonado**. Solo el usuario sabe qué mira: preguntarle con la lista delante.
2. Lo "abandonado" va a una propuesta de limpieza por pasos pequeños, del más aislado al más enredado.
3. Volver a correr el inventario después de cada paso y anotar la diferencia (archivos y líneas).

## Límites

- No mide qué código se ejecuta de verdad en producción.
- No entiende alias de TypeScript ni imports de paquetes.
- Los umbrales y nombres que busca están en el propio script: si el repo cambia de convenciones, se ajusta ahí.
