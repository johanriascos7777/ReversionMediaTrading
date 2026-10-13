# ReversionMediaTrading — instrucciones para Claude Code

@AGENTS.md

## Antes de trabajar aquí

- El usuario opera con **dinero real** mirando las alertas de este sistema. Los cambios se prueban primero en demo.
- Para ordenar, simplificar o corregir el repo, usar el agente `reversion-orchestrator`
  (`.claude/agents/reversion-orchestrator.md`). Ahí están el método, las clases de cambio y las restricciones.
- Para saber qué hay sin abrir archivos, usar la skill `repo-inventory`.
- Las skills de dominio viven en `.agents/skills/` (compartidas con Antigravity) y están enlazadas en
  `.claude/skills/`. Se editan en `.agents/skills/`.

## Reglas que valen para cualquier agente

- Git: ninguna operación que modifique algo; se propone el comando y lo ejecuta el usuario.
- Nunca leer ni imprimir `NestServer/.env` ni `Client/.env`.
- No arrancar, parar ni reiniciar el servidor en uso; no llamar a Twelve Data ni a Telegram sin permiso.
- No afirmar que una señal funciona: las alertas no están validadas estadísticamente.
- `AGENTS.md` está desactualizado en parte (estructura de carpetas y rutas). Ante una contradicción, manda el código.
