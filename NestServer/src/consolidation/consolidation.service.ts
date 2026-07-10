/**
 * consolidation.service.ts
 *
 * Servicio NestJS del módulo de Consolidation Geometry Analyzer.
 *
 * Responsabilidades:
 * 1. Escuchar snapshots del motor principal (igual que FullRevertionService)
 * 2. Detectar y clasificar consolidaciones en M5 Y M15 en tiempo real
 * 3. Fusionar señales M5+M15 → super señal
 * 4. Enviar alertas por Telegram para super señales
 * 5. Emitir snapshot de consolidación via MarketService.events para el frontend
 * 6. Orquestar descargas de historial y backtests
 *
 * NUNCA modifica ni llama a nada del motor de elasticidad estándar.
 */

import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { MarketService } from '../market/market.service';
import { HistoricalDataService } from '../historical/historical-data.service';
import type { BackendMessage } from '../market/types';
import type {
  ConsolidationAnalysis,
  ConsolidationBacktestResult,
  ConsolidationConfig,
} from './consolidation.types';
import { DEFAULT_CONSOLIDATION_CONFIG } from './consolidation.types';
import { calculateATR, detectConsolidationWithContext } from './consolidationDetector';
import { classifyAndAlign } from './geometryClassifier';
import { runConsolidationBacktest } from './consolidationBacktest';
import type { DownloadResult } from '../historical/historical.types';

// Rate-limit de cálculo por símbolo (no recalcular en cada tick)
const MIN_CALC_INTERVAL_MS = 5_000;
const TELEGRAM_COOLDOWN_MS = 300_000; // 5 minutos entre alertas

// ═══════════════════════════════════════════════════════════════════════════════
// Tipos del snapshot de consolidación (emitido por WS al frontend)
// ═══════════════════════════════════════════════════════════════════════════════

export type ConsolidationTimeframeSignal = {
  detected:    boolean;
  pattern:     string | null;
  alignment:   'aligned' | 'opposed' | 'neutral';
  confidence:  number;
  duration:    number;
  rangeATR:    number;
  explanation: string;
};

export type SuperSignalType = 'SUPER_STOP' | 'SUPER_REVERSAL' | 'CONFLICT' | 'INACTIVE';

export type SuperSignal = {
  active:         boolean;
  type:           SuperSignalType;
  recommendation: string;
};

export type ConsolidationSnapshot = {
  type:        'consolidation';
  symbol:      string;
  priceVsEma:  'above' | 'below';
  elasticityM5:  number;
  elasticityM15: number;
  m5:          ConsolidationTimeframeSignal;
  m15:         ConsolidationTimeframeSignal;
  superSignal: SuperSignal;
  backtest:    ConsolidationBacktestResult | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Servicio
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class ConsolidationService implements OnModuleInit {

  // Último análisis por símbolo+timeframe
  private readonly lastAnalysisM5  = new Map<string, ConsolidationAnalysis>();
  private readonly lastAnalysisM15 = new Map<string, ConsolidationAnalysis>();
  // Último backtest por símbolo
  private readonly lastBacktest  = new Map<string, ConsolidationBacktestResult>();
  // Rate-limit
  private readonly lastCalcTime  = new Map<string, number>();
  // Telegram cooldown
  private readonly lastTelegramTime = new Map<string, number>();
  // Flag para evitar doble inicialización
  private initializing = false;

  constructor(
    @Inject(forwardRef(() => MarketService))
    private readonly marketService: MarketService,
    private readonly historicalData: HistoricalDataService,
  ) {}

  onModuleInit(): void {
    // Escuchar snapshots del motor principal (patrón de FullRevertionService)
    this.marketService.events.on('broadcast', (msg: BackendMessage) => {
      if (msg.type !== 'snapshot') return;
      setImmediate(() => this.onSnapshot(msg));
    });

    console.log('[ConsolidationService] ✅ Inicializado — escuchando snapshots M5+M15 para detección de consolidación.');

    // Disparar descarga de historial en background (no bloquea el arranque)
    this.initHistoricalDownload().catch(err => {
      console.error('[ConsolidationService] Error en descarga inicial de historial:', err.message);
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // API Pública (para el controller)
  // ═══════════════════════════════════════════════════════════════════════════

  getLastAnalysis(symbol: string): ConsolidationAnalysis | null {
    return this.lastAnalysisM5.get(symbol) ?? null;
  }

  getLastBacktest(symbol: string): ConsolidationBacktestResult | null {
    return this.lastBacktest.get(symbol) ?? null;
  }

  getAllAnalyses(): Record<string, { m5: ConsolidationAnalysis | null; m15: ConsolidationAnalysis | null }> {
    const result: Record<string, { m5: ConsolidationAnalysis | null; m15: ConsolidationAnalysis | null }> = {};
    const symbols = new Set([...this.lastAnalysisM5.keys(), ...this.lastAnalysisM15.keys()]);
    for (const symbol of symbols) {
      result[symbol] = {
        m5: this.lastAnalysisM5.get(symbol) ?? null,
        m15: this.lastAnalysisM15.get(symbol) ?? null,
      };
    }
    return result;
  }

  getAllBacktests(): Record<string, ConsolidationBacktestResult> {
    const result: Record<string, ConsolidationBacktestResult> = {};
    for (const [symbol, bt] of this.lastBacktest) {
      result[symbol] = bt;
    }
    return result;
  }

  /**
   * Retorna el snapshot de consolidación completo para un símbolo.
   * Incluye M5, M15 y super señal. Usado por el controller y
   * emitido via WS al frontend.
   */
  getConsolidationSnapshot(symbol: string): ConsolidationSnapshot | null {
    const m5Analysis  = this.lastAnalysisM5.get(symbol);
    const m15Analysis = this.lastAnalysisM15.get(symbol);

    if (!m5Analysis && !m15Analysis) return null;

    const m5Signal  = this.analysisToSignal(m5Analysis);
    const m15Signal = this.analysisToSignal(m15Analysis);
    const superSignal = this.computeSuperSignal(m5Signal, m15Signal);

    return {
      type: 'consolidation',
      symbol,
      priceVsEma:    m5Analysis?.priceVsEma ?? m15Analysis?.priceVsEma ?? 'above',
      elasticityM5:  m5Analysis?.elasticity ?? 0,
      elasticityM15: m15Analysis?.elasticity ?? 0,
      m5:  m5Signal,
      m15: m15Signal,
      superSignal,
      backtest: this.lastBacktest.get(symbol) ?? null,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Descarga de historial + backtest inicial
  // ═══════════════════════════════════════════════════════════════════════════

  async downloadAndCache(
    symbol: string,
    timeframe: '5min' | '15min',
    totalCandles: number = 10_000,
  ): Promise<DownloadResult> {
    return this.historicalData.downloadHistory(symbol, timeframe, totalCandles);
  }

  async runBacktestForSymbol(
    symbol: string,
    config?: Partial<ConsolidationConfig>,
    timeframe: '5min' | '15min' = '5min',
  ): Promise<ConsolidationBacktestResult> {
    const mergedConfig: ConsolidationConfig = {
      ...DEFAULT_CONSOLIDATION_CONFIG,
      ...config,
    };

    console.log(`[ConsolidationService] [${symbol}] Cargando velas ${timeframe} para backtest...`);
    const candles = await this.historicalData.getCandles(symbol, timeframe, 10_000);

    if (candles.length < 300) {
      console.warn(
        `[ConsolidationService] [${symbol}] Solo ${candles.length} velas disponibles. ` +
        `Descarga historial primero con POST /consolidation/download/${encodeURIComponent(symbol)}`,
      );
      return emptyBacktestResult();
    }

    console.log(
      `[ConsolidationService] [${symbol}] Ejecutando backtest con ${candles.length} velas ${timeframe}...`,
    );

    const result = runConsolidationBacktest(candles, mergedConfig);
    this.lastBacktest.set(symbol, result);

    console.log(
      `[ConsolidationService] [${symbol}] Backtest completado:`,
      `${result.totalConsolidations} consolidaciones detectadas,`,
      `accuracy: ${result.accuracy}%,`,
      `avg bars to resolution: ${result.avgBarsToResolution}`,
    );

    for (const [pattern, stats] of Object.entries(result.byPattern)) {
      if (stats && stats.count > 0) {
        console.log(`  → ${pattern}: ${stats.count} eventos, accuracy: ${stats.accuracy}%`);
      }
    }

    for (const [alignment, stats] of Object.entries(result.byAlignment)) {
      if (stats.count > 0) {
        console.log(`  → ${alignment}: ${stats.count} eventos, accuracy: ${stats.accuracy}%`);
      }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Análisis en tiempo real (escucha snapshots) — M5 + M15
  // ═══════════════════════════════════════════════════════════════════════════

  private onSnapshot(msg: any): void {
    const { symbol, m5, m15 } = msg;
    if (!m5 || !m15) return;

    // Rate-limit: no recalcular más de una vez cada 5 segundos por símbolo
    const now = Date.now();
    const last = this.lastCalcTime.get(symbol) ?? 0;
    if (now - last < MIN_CALC_INTERVAL_MS) return;
    this.lastCalcTime.set(symbol, now);

    // ─── Analizar M5 ───────────────────────────────────────────────────────
    this.analyzeTimeframe(symbol, m5, '5min', this.lastAnalysisM5);

    // ─── Analizar M15 ──────────────────────────────────────────────────────
    this.analyzeTimeframe(symbol, m15, '15min', this.lastAnalysisM15);

    // ─── Construir snapshot combinado y emitir ─────────────────────────────
    const snapshot = this.getConsolidationSnapshot(symbol);
    if (snapshot) {
      // Emitir via MarketService.events para que el Gateway lo envíe a clientes
      this.marketService.events.emit('broadcast', snapshot);

      // Telegram para super señales
      if (snapshot.superSignal.active &&
          (snapshot.superSignal.type === 'SUPER_STOP' || snapshot.superSignal.type === 'SUPER_REVERSAL')) {
        this.sendTelegramAlert(snapshot).catch(() => {});
      }

      // Log ocasional
      if (snapshot.m5.detected || snapshot.m15.detected) {
        if (Math.random() < 0.03) {
          console.log(
            `[ConsolidationService] [${symbol}]`,
            `M5: ${snapshot.m5.detected ? snapshot.m5.pattern + '(' + snapshot.m5.alignment + ')' : 'none'}`,
            `| M15: ${snapshot.m15.detected ? snapshot.m15.pattern + '(' + snapshot.m15.alignment + ')' : 'none'}`,
            `| Super: ${snapshot.superSignal.type}`,
          );
        }
      }
    }
  }

  /**
   * Analiza una temporalidad específica y guarda el resultado.
   */
  private analyzeTimeframe(
    symbol: string,
    snapshot: any,
    timeframe: '5min' | '15min',
    store: Map<string, ConsolidationAnalysis>,
  ): void {
    // Solo analizar cuando hay sobreextensión (YELLOW o GREEN, inercia hasta percentil 50)
    if (snapshot.state === 'RED' && snapshot.percentile < 50) {
      store.set(symbol, {
        detected: false,
        zone: null,
        geometry: null,
        reversalAlignment: 'neutral',
        priceVsEma: snapshot.price > snapshot.ema100 ? 'above' : 'below',
        elasticity: snapshot.elasticity,
        explanation: `Mercado en rango normal (RED) en ${timeframe}. Sin análisis de consolidación.`,
      });
      return;
    }

    // Obtener velas del historial en memoria
    const candles = this.marketService.getHistory(symbol, timeframe);
    if (candles.length < 130) return;

    const currentIndex = candles.length - 1;
    const atr = calculateATR(candles, currentIndex);
    if (atr <= 0) return;

    const config = { ...DEFAULT_CONSOLIDATION_CONFIG };
    if (timeframe === '15min') {
      config.minDuration = 3;
      config.lookback = 12;
    } else {
      config.minDuration = 6;
      config.lookback = 40;
    }
    const priceVsEma: 'above' | 'below' = snapshot.price > snapshot.ema100 ? 'above' : 'below';

    // Detectar consolidación
    const zone = detectConsolidationWithContext(
      candles, currentIndex, atr,
      snapshot.elasticity, snapshot.percentile,
      config,
    );

    if (!zone) {
      store.set(symbol, {
        detected: false,
        zone: null,
        geometry: null,
        reversalAlignment: 'neutral',
        priceVsEma,
        elasticity: snapshot.elasticity,
        explanation:
          `Elasticidad en ${snapshot.state} (${snapshot.elasticity.toFixed(2)}, P${snapshot.percentile}%) ` +
          `pero sin zona de consolidación detectada en ${timeframe}.`,
      });
      return;
    }

    // Clasificar geometría y alineación
    const { geometry, alignment } = classifyAndAlign(
      candles, zone, atr, snapshot.price, snapshot.ema100, config,
    );

    // Construir explicación
    const explanation = buildExplanation(
      zone, geometry, alignment, priceVsEma, snapshot.elasticity, snapshot.percentile, timeframe,
    );

    store.set(symbol, {
      detected: true,
      zone,
      geometry,
      reversalAlignment: alignment,
      priceVsEma,
      elasticity: snapshot.elasticity,
      explanation,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Conversión y Fusión de Señales
  // ═══════════════════════════════════════════════════════════════════════════

  private analysisToSignal(analysis: ConsolidationAnalysis | undefined): ConsolidationTimeframeSignal {
    if (!analysis || !analysis.detected) {
      return {
        detected:    false,
        pattern:     null,
        alignment:   'neutral',
        confidence:  0,
        duration:    0,
        rangeATR:    0,
        explanation: analysis?.explanation ?? 'Sin datos.',
      };
    }

    return {
      detected:    true,
      pattern:     analysis.geometry?.pattern ?? null,
      alignment:   analysis.reversalAlignment,
      confidence:  analysis.geometry?.confidence ?? 0,
      duration:    analysis.zone?.duration ?? 0,
      rangeATR:    analysis.zone?.rangeATR ?? 0,
      explanation: analysis.explanation,
    };
  }

  /**
   * Fusiona señales M5 y M15 en una super señal.
   *
   * Basado en los resultados del backtest:
   * - M5 OPPOSED tiene 68% accuracy → fuerte como detector de pullbacks
   * - M15 ALIGNED tiene 63% accuracy → fuerte como confirmador de reversión
   */
  private computeSuperSignal(
    m5: ConsolidationTimeframeSignal,
    m15: ConsolidationTimeframeSignal,
  ): SuperSignal {
    // Si ninguno detecta consolidación, inactivo
    if (!m5.detected && !m15.detected) {
      return { active: false, type: 'INACTIVE', recommendation: 'Sin consolidación detectada en ninguna temporalidad.' };
    }

    // Si solo uno detecta, mostrar info parcial
    if (!m5.detected || !m15.detected) {
      const active = m5.detected ? m5 : m15;
      const tf = m5.detected ? 'M5' : 'M15';
      return {
        active: false,
        type: 'INACTIVE',
        recommendation: `Solo ${tf} detecta consolidación (${active.pattern}, ${active.alignment}). Esperando confirmación de la otra temporalidad.`,
      };
    }

    // Ambos detectan consolidación — fusionar
    const m5Opposed  = m5.alignment === 'opposed';
    const m5Aligned  = m5.alignment === 'aligned';
    const m15Opposed = m15.alignment === 'opposed';
    const m15Aligned = m15.alignment === 'aligned';

    // SUPER_STOP: ambas ven pullback
    if (m5Opposed && m15Opposed) {
      return {
        active: true,
        type: 'SUPER_STOP',
        recommendation:
          '🔴 SUPER STOP — Ambas temporalidades detectan pullback. ' +
          'M5 ve ' + m5.pattern + ' y M15 ve ' + m15.pattern + '. ' +
          'NO entrar — alta probabilidad de que el precio siga estirándose.',
      };
    }

    // SUPER_REVERSAL: ambas confirman reversión
    if (m5Aligned && m15Aligned) {
      return {
        active: true,
        type: 'SUPER_REVERSAL',
        recommendation:
          '🟢 SUPER REVERSIÓN — Ambas temporalidades confirman reversión a la media. ' +
          'M5 ve ' + m5.pattern + ' y M15 ve ' + m15.pattern + '. ' +
          'Mejor momento para entrar — la geometría confirma en ambas escalas.',
      };
    }

    // CONFLICT: señales cruzadas
    if (m5Opposed && m15Aligned) {
      return {
        active: true,
        type: 'CONFLICT',
        recommendation:
          '⚠️ CONFLICTO — M5 detecta pullback (' + m5.pattern + ') pero M15 favorece reversión (' + m15.pattern + '). ' +
          'La temporalidad mayor confirma, pero M5 aún ve pausa. Esperar resolución del pullback en M5.',
      };
    }

    if (m5Aligned && m15Opposed) {
      return {
        active: true,
        type: 'CONFLICT',
        recommendation:
          '⚠️ CONFLICTO — M5 favorece reversión (' + m5.pattern + ') pero M15 detecta pullback (' + m15.pattern + '). ' +
          'La temporalidad mayor no confirma. Precaución — esperar que M15 cambie a ALIGNED.',
      };
    }

    // Neutral en alguno
    return {
      active: false,
      type: 'INACTIVE',
      recommendation:
        'Consolidación detectada en ambas temporalidades pero sin sesgo claro en alguna. ' +
        `M5: ${m5.pattern} (${m5.alignment}), M15: ${m15.pattern} (${m15.alignment}).`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Telegram Alerts
  // ═══════════════════════════════════════════════════════════════════════════

  private async sendTelegramAlert(snapshot: ConsolidationSnapshot): Promise<void> {
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    // Cooldown: no enviar más de una alerta cada 5 minutos por símbolo
    const now = Date.now();
    const last = this.lastTelegramTime.get(snapshot.symbol) ?? 0;
    if (now - last < TELEGRAM_COOLDOWN_MS) return;
    this.lastTelegramTime.set(snapshot.symbol, now);

    const emoji = snapshot.superSignal.type === 'SUPER_STOP' ? '🔴' : '🟢';
    const side  = snapshot.priceVsEma === 'above' ? 'SELL' : 'BUY';

    let messageText = '';
    messageText += `${emoji} *CONSOLIDATION ANALYZER* ${emoji}\n`;
    messageText += `Símbolo: *${snapshot.symbol}*\n`;
    messageText += `Dirección reversión: *${side}*\n\n`;

    messageText += `📊 *M5*: ${snapshot.m5.pattern ?? 'N/A'} (${snapshot.m5.alignment.toUpperCase()})\n`;
    messageText += `  → Confianza: ${snapshot.m5.confidence}%\n`;
    messageText += `  → Duración: ${snapshot.m5.duration} velas\n\n`;

    messageText += `📊 *M15*: ${snapshot.m15.pattern ?? 'N/A'} (${snapshot.m15.alignment.toUpperCase()})\n`;
    messageText += `  → Confianza: ${snapshot.m15.confidence}%\n`;
    messageText += `  → Duración: ${snapshot.m15.duration} velas\n\n`;

    messageText += `⚡ *${snapshot.superSignal.type.replace('_', ' ')}*\n`;
    messageText += snapshot.superSignal.recommendation;

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'Markdown',
        }),
      });

      console.log(
        `[ConsolidationService] [${snapshot.symbol}] 📨 Alerta Telegram enviada: ${snapshot.superSignal.type}`,
      );
    } catch (err: any) {
      console.error(`[ConsolidationService] Error enviando Telegram:`, err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Descarga inicial de historial (background)
  // ═══════════════════════════════════════════════════════════════════════════

  private async initHistoricalDownload(): Promise<void> {
    if (this.initializing) return;
    this.initializing = true;

    await new Promise(r => setTimeout(r, 15_000));

    const symbolsRaw = process.env.TWELVE_DATA_SYMBOL ?? '';
    const symbols = symbolsRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (symbols.length === 0) {
      console.log('[ConsolidationService] No hay símbolos configurados. Saltando descarga.');
      this.initializing = false;
      return;
    }

    console.log(
      `[ConsolidationService] Iniciando descarga de historial para ${symbols.length} símbolos...`,
    );

    for (const sym of symbols) {
      try {
        // M5
        const cacheCountM5 = await this.historicalData.getCacheCount(sym, '5min');
        if (cacheCountM5 < 5000) {
          await this.historicalData.downloadHistory(sym, '5min', 10_000);
        } else {
          console.log(`[ConsolidationService] [${sym}] M5: ${cacheCountM5} velas en caché. OK.`);
        }

        // M15
        const cacheCountM15 = await this.historicalData.getCacheCount(sym, '15min');
        if (cacheCountM15 < 5000) {
          await this.historicalData.downloadHistory(sym, '15min', 10_000);
        } else {
          console.log(`[ConsolidationService] [${sym}] M15: ${cacheCountM15} velas en caché. OK.`);
        }

        // Backtests
        await this.runBacktestForSymbol(sym, undefined, '5min');
        await this.runBacktestForSymbol(sym, undefined, '15min');
      } catch (err: any) {
        console.error(
          `[ConsolidationService] [${sym}] Error en descarga/backtest: ${err.message}`,
        );
      }
    }

    this.initializing = false;
    console.log('[ConsolidationService] ✅ Descarga y backtest inicial completados (M5+M15).');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function emptyBacktestResult(): ConsolidationBacktestResult {
  return {
    totalConsolidations: 0,
    classifiedCorrectly: 0,
    accuracy: 0,
    avgBarsToResolution: 0,
    byPattern: {},
    byAlignment: {
      aligned:  { count: 0, correct: 0, accuracy: 0 },
      opposed:  { count: 0, correct: 0, accuracy: 0 },
      neutral:  { count: 0, correct: 0, accuracy: 0 },
    },
    events: [],
  };
}

function buildExplanation(
  zone: { duration: number; rangeATR: number },
  geometry: { pattern: string; breakoutBias: string; confidence: number },
  alignment: string,
  priceVsEma: 'above' | 'below',
  elasticity: number,
  percentile: number,
  timeframe: string,
): string {
  const patternNames: Record<string, string> = {
    ascending_triangle:   'Triángulo Ascendente',
    descending_triangle:  'Triángulo Descendente',
    rectangle:            'Rectángulo',
    bull_flag:            'Bandera Alcista',
    bear_flag:            'Bandera Bajista',
    contracting_wedge:    'Cuña Contractiva',
    expanding_wedge:      'Cuña Expansiva',
    falling_channel:      'Canal Descendente',
    rising_channel:       'Canal Ascendente',
    unclassified:         'No clasificado',
  };

  const alignmentNames: Record<string, string> = {
    aligned:  '✅ ALINEADO con reversión',
    opposed:  '⚠️ OPUESTO (pullback probable)',
    neutral:  '⏸️ NEUTRAL',
  };

  const side = priceVsEma === 'above' ? 'encima' : 'debajo';

  return (
    `[${timeframe.toUpperCase()}] Consolidación de ${zone.duration} velas (${zone.rangeATR.toFixed(2)} ATR). ` +
    `${patternNames[geometry.pattern] ?? geometry.pattern}. ` +
    `Precio ${side} de EMA100 (E: ${elasticity.toFixed(2)}, P${percentile}%). ` +
    `${alignmentNames[alignment] ?? alignment}. Confianza: ${geometry.confidence}%.`
  );
}
