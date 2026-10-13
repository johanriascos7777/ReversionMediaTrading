import argparse
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOTS = ("NestServer/src", "Client/src")
EXTENSIONS = (".ts", ".tsx")
SKIP_DIRS = {"node_modules", "dist", "build", ".git", "storybook-static"}
ENTRY_NAMES = {"main.ts", "main.tsx", "vite-env.d.ts"}
IMPORT_RE = re.compile(r"""(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"](\.{1,2}/[^'"]+)['"]""")
ROUTE_RE = re.compile(r"""<Route\s+path=["']([^"']+)["']\s+element=\{<\s*(\w+)""")
CONTROLLER_RE = re.compile(r"""@Controller\(\s*['"]?([^'")]*)['"]?\s*\)""")
VERB_RE = re.compile(r"""@(Get|Post|Put|Patch|Delete)\(\s*['"]?([^'")]*)['"]?\s*\)""")
SUBSCRIBE_RE = re.compile(r"""@SubscribeMessage\(\s*['"]([^'"]+)['"]""")
ENV_RE = re.compile(r"""(?:process\.env\.|import\.meta\.env\.)([A-Z0-9_]+)""")
CHANNELS = {
    "Telegram": re.compile(r"telegram|sendMessage", re.I),
    "Sonido": re.compile(r"new Audio|\.play\(\)"),
    "Notificación del navegador": re.compile(r"new Notification\("),
}
VARIANT_RE = re.compile(r"(Exp\b|Exp\.|Experimental|Reforced|reforced|V2|v2|Old|old|Legacy|legacy|Copy|copy|backup)")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=str(Path(__file__).resolve().parents[3]))
    parser.add_argument("--top", type=int, default=15)
    return parser.parse_args()


def source_files(repo):
    for root in ROOTS:
        base = repo / root
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file() and path.suffix in EXTENSIONS and not SKIP_DIRS.intersection(path.parts):
                yield path


def resolve(importer, target):
    base = (importer.parent / target).resolve()
    candidates = [base] if base.suffix in EXTENSIONS else []
    candidates += [base.with_name(base.name + ext) for ext in EXTENSIONS]
    candidates += [base / f"index{ext}" for ext in EXTENSIONS]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def main():
    args = parse_args()
    repo = Path(args.repo).resolve()
    files = list(source_files(repo))
    texts = {}
    for path in files:
        try:
            texts[path] = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            texts[path] = ""
    lines = {path: text.count("\n") + 1 for path, text in texts.items()}
    rel = lambda path: str(path.relative_to(repo))

    print(f"# Inventario de {repo.name}")
    print(f"\n{len(files)} archivos de código, {sum(lines.values())} líneas.\n")

    print("## Tamaño por carpeta\n")
    print("| Carpeta | Archivos | Líneas |")
    print("|---|---|---|")
    groups = defaultdict(list)
    for path in files:
        parts = path.relative_to(repo).parts
        groups["/".join(parts[:3]) if len(parts) > 3 else "/".join(parts[:2]) + "/(raíz)"].append(path)
    for name, members in sorted(groups.items(), key=lambda item: -sum(lines[p] for p in item[1])):
        print(f"| {name} | {len(members)} | {sum(lines[p] for p in members)} |")

    print(f"\n## Los {args.top} archivos más grandes\n")
    for path in sorted(files, key=lambda p: -lines[p])[: args.top]:
        print(f"- {lines[path]:>5}  {rel(path)}")

    inbound = Counter()
    unresolved = Counter()
    for path, text in texts.items():
        for target in set(IMPORT_RE.findall(text)):
            found = resolve(path, target)
            if found is None:
                unresolved[rel(path)] += 1
            elif found != path:
                inbound[found] += 1
    orphans = [p for p in files if inbound[p] == 0 and p.name not in ENTRY_NAMES and not p.name.endswith(".d.ts")]
    print("\n## Archivos que nadie importa (candidatos a código muerto; revisar uno por uno)\n")
    print("Pueden ser puntos de entrada legítimos: scripts, entidades cargadas por patrón, módulos registrados por nombre.\n")
    for path in sorted(orphans, key=lambda p: -lines[p]):
        print(f"- {lines[path]:>5}  {rel(path)}")
    if not orphans:
        print("- ninguno")

    print("\n## Páginas del frontend (rutas)\n")
    for path, text in texts.items():
        for route, component in ROUTE_RE.findall(text):
            print(f"- `{route}` → {component}  ({rel(path)})")

    print("\n## Entradas del backend\n")
    for path, text in sorted(texts.items()):
        controllers = CONTROLLER_RE.findall(text)
        verbs = VERB_RE.findall(text)
        events = SUBSCRIBE_RE.findall(text)
        gateway = "@WebSocketGateway" in text
        if controllers or events or gateway:
            base = controllers[0] if controllers else ""
            parts = [f"{verb.upper()} /{base}/{sub}".replace("//", "/").rstrip("/") for verb, sub in verbs]
            parts += [f"evento '{event}'" for event in events]
            if gateway:
                parts.append("pasarela websocket")
            print(f"- {rel(path)}: " + "; ".join(parts))

    print("\n## Canales por donde sale una alerta\n")
    for name, pattern in CHANNELS.items():
        hits = [rel(path) for path, text in sorted(texts.items()) if pattern.search(text)]
        print(f"- {name}: " + (", ".join(hits) if hits else "ninguno"))

    print("\n## Variantes y experimentos (por nombre de archivo)\n")
    variants = [path for path in files if VARIANT_RE.search(path.name)]
    for path in sorted(variants):
        print(f"- {lines[path]:>5}  {rel(path)}")
    if not variants:
        print("- ninguno")

    print("\n## Variables de entorno usadas (solo nombres)\n")
    names = defaultdict(set)
    for path, text in texts.items():
        for name in ENV_RE.findall(text):
            names[name].add(path.relative_to(repo).parts[0])
    for name in sorted(names):
        print(f"- {name} ({', '.join(sorted(names[name]))})")

    tests = [p for p in repo.rglob("*") if p.is_file() and not SKIP_DIRS.intersection(p.parts) and re.search(r"\.(spec|test)\.(ts|tsx)$", p.name)]
    todo = sum(len(re.findall(r"TODO|FIXME|HACK", text)) for text in texts.values())
    print("\n## Otros\n")
    print(f"- Tests automáticos: {len(tests)}")
    print(f"- Marcas TODO, FIXME o HACK: {todo}")
    if unresolved:
        print(f"- Imports relativos que no pude resolver: {sum(unresolved.values())} (en {len(unresolved)} archivos)")


if __name__ == "__main__":
    main()
