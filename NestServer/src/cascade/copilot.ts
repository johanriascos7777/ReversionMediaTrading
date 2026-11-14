import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export type CopilotVerdict = {
  decision: 'tomar' | 'no_tomar' | 'dudosa';
  confianza: number;
  razones: string[];
  riesgo: string;
};

export type CopilotResult = {
  model: string;
  verdict: CopilotVerdict;
  ms: number;
  inputTokens: number;
  outputTokens: number;
};

const SCHEMA = {
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['tomar', 'no_tomar', 'dudosa'] },
    confianza: { type: 'number' },
    razones: { type: 'array', items: { type: 'string' } },
    riesgo: { type: 'string' },
  },
  required: ['decision', 'confianza', 'razones', 'riesgo'],
  additionalProperties: false,
};

const SYSTEM = `Eres el copiloto de un trader de forex que opera reversión a la media (contratendencia) con la EMA 100.

El sistema acaba de emitir una alerta "Cascada": el precio estuvo estirado lejos de la EMA 100 en 1m, 5m y 15m (abanico ordenado), y una vela de 1 minuto acaba de cerrar al otro lado de su EMA 100. La operación nace con un contrato: stop pasado el extremo del estirón, objetivo en la mitad de la distancia a la EMA 100 de 5m (o antes si la toca) y salida forzada a los 175 minutos.

Lo que ya se midió con 10 meses de EUR/USD en 1 minuto (2026):
- La regla mecánica gana el 65 % de las veces, con una mediana de 8 pips de stop y unos 4 de objetivo; neto ≈ −0,5 pips por operación tras 0,8 de spread. No tiene ventaja probada.
- Ningún filtro simple (sesión, tendencia de 4 o 12 horas, tamaño de la vela, número de intento, velas de noticia) mejoró de forma estable.
- Los fallos típicos: días de tendencia fuerte, donde el mismo patrón se repite varias veces y cada intento termina en stop, y estirones causados por datos económicos.

Tu trabajo: mirar los números de este caso y decir si lo tomarías, sin inventar ventaja que no ves. Fíjate en lo que una regla fija no ve: si el estirón parece una tendencia que sigue (varias velas de 15m en la misma dirección sin retrocesos, intentos previos fallidos, la EMA de 15m muy inclinada) o un exceso que se agota (aceleración final, mechas largas, primer intento). "dudosa" es una respuesta válida y honesta. La confianza va de 0 a 100. Máximo 3 razones, cada una de una línea en español, con números del caso. "riesgo" es una línea con lo que haría fallar esta operación. Responde solo con el JSON pedido.`;

function findClaude(env: NodeJS.ProcessEnv): string | null {
  const candidates = [
    env.COPILOT_CLAUDE_BIN,
    path.join(os.homedir(), '.local/bin/claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ].filter((p): p is string => !!p);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function isVerdict(v: unknown): v is CopilotVerdict {
  const o = v as CopilotVerdict;
  return (
    !!o &&
    ['tomar', 'no_tomar', 'dudosa'].includes(o.decision) &&
    typeof o.confianza === 'number' &&
    Array.isArray(o.razones) &&
    o.razones.every((r) => typeof r === 'string') &&
    typeof o.riesgo === 'string'
  );
}

export class Copilot {
  private readonly bin: string | null;
  private readonly cwd: string;
  private readonly env: NodeJS.ProcessEnv;
  readonly model: string;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const personal = path.join(os.homedir(), '.claude-personal');
    const configDir =
      env.COPILOT_CLAUDE_CONFIG_DIR ||
      env.CLAUDE_CONFIG_DIR ||
      (fs.existsSync(personal) ? personal : undefined);
    this.env = configDir ? { ...env, CLAUDE_CONFIG_DIR: configDir } : env;
    this.model = env.COPILOT_MODEL || 'opus';
    this.bin = env.COPILOT_ENABLED === 'false' ? null : findClaude(env);
    this.cwd = path.join(os.tmpdir(), 'reversion-copiloto');
  }

  get enabled(): boolean {
    return this.bin !== null;
  }

  review(context: Record<string, unknown>): Promise<CopilotResult | null> {
    if (!this.bin) return Promise.resolve(null);
    fs.mkdirSync(this.cwd, { recursive: true });
    const started = Date.now();
    const args = [
      '-p',
      '--model', this.model,
      '--tools', '',
      '--setting-sources', 'local',
      '--disable-slash-commands',
      '--strict-mcp-config',
      '--no-session-persistence',
      '--output-format', 'json',
      '--system-prompt', SYSTEM,
      '--json-schema', JSON.stringify(SCHEMA),
      `Caso (JSON, precios del proveedor de datos, pips del par):\n${JSON.stringify(context)}`,
    ];
    return new Promise((resolve) => {
      execFile(
        this.bin!,
        args,
        { cwd: this.cwd, env: this.env, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 },
        (err, stdout) => {
          if (err) {
            console.error('[Copiloto] claude -p falló:', err.message.slice(0, 300));
            return resolve(null);
          }
          try {
            const out = JSON.parse(stdout);
            const verdict = out.structured_output;
            if (out.is_error || !isVerdict(verdict)) {
              console.warn(`[Copiloto] Sin veredicto válido (${out.subtype ?? 'sin subtipo'}).`);
              return resolve(null);
            }
            const usage = Object.entries(out.modelUsage ?? {})[0] as
              | [string, { inputTokens?: number; cacheCreationInputTokens?: number; cacheReadInputTokens?: number; outputTokens?: number }]
              | undefined;
            resolve({
              model: usage?.[0] ?? this.model,
              verdict,
              ms: Date.now() - started,
              inputTokens:
                (usage?.[1].inputTokens ?? 0) +
                (usage?.[1].cacheCreationInputTokens ?? 0) +
                (usage?.[1].cacheReadInputTokens ?? 0),
              outputTokens: usage?.[1].outputTokens ?? 0,
            });
          } catch (e) {
            console.error('[Copiloto] Respuesta de claude -p ilegible:', e);
            resolve(null);
          }
        },
      );
    });
  }
}
