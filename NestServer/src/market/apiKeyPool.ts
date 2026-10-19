import * as fs from 'fs';
import * as path from 'path';
import type { BackendMessage } from './types';

export class ApiKeyPool {
  constructor(
    private readonly apiKeyList: string[],
    private readonly symbolList: string[],
    private readonly emit: (msg: BackendMessage) => void,
    private readonly persistFile = path.join(process.cwd(), 'exhausted_keys.json'),
  ) {
    this.loadDailyExhaustedKeys();
  }

  /**
   * Llaves agotadas: Map<key, timestampAgotamiento>.
   * Las llaves agotadas por límite de MINUTO (rate-limit) se auto-liberan
   * después de 65 segundos. Solo las que alcanzan los 800 créditos totales
   * se consideran permanentemente agotadas, pero dado que TwelveData
   * no distingue en la respuesta, tratamos todo como rate-limit temporal
   * para no consumir innecesariamente todo el pool en un bucle.
   */
  private readonly exhaustedKeys = new Map<string, number>(); // key -> timestamp agotamiento
  private readonly dailyLimitExhaustedKeys = new Set<string>();
  private lastResetDay = new Date().getUTCDate();
  private static readonly KEY_RATE_LIMIT_COOLDOWN_MS = 65_000; // 65s > 1 min de ventana TwelveData

  private checkDailyReset(): void {
    const today = new Date().getUTCDate();
    if (today !== this.lastResetDay) {
      this.dailyLimitExhaustedKeys.clear();
      this.saveDailyExhaustedKeys(); // Limpiar el archivo de persistencia
      this.lastResetDay = today;
      console.log('[MarketService] ☀️ Nuevo día UTC detectado. Restableciendo límites de créditos diarios de todas las llaves API.');
    }
  }

  private loadDailyExhaustedKeys(): void {
    const filePath = this.persistFile;
    try {
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.date === new Date().getUTCDate() && Array.isArray(data.keys)) {
          for (const key of data.keys) {
            this.dailyLimitExhaustedKeys.add(key);
          }
          console.log(`[MarketService] 💾 Cargadas ${this.dailyLimitExhaustedKeys.size} llaves agotadas diarias desde persistencia.`);
        } else {
          // Si es otro día, borrar el archivo
          fs.unlinkSync(filePath);
        }
      }
    } catch (e) {
      console.error('[MarketService] Error cargando llaves agotadas persistidas:', e);
    }
  }

  private saveDailyExhaustedKeys(): void {
    const filePath = this.persistFile;
    try {
      const data = {
        date: new Date().getUTCDate(),
        keys: Array.from(this.dailyLimitExhaustedKeys)
      };
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[MarketService] Error guardando llaves agotadas persistidas:', e);
    }
  }

  private readonly activeAssignments = new Map<string, string>();
  private readonly keyStats = new Map<string, {
    totalRequests: number;
    requestTimestamps: number[];
    minutelyMax: number;
  }>();

  // Ya no usamos bloqueo global de créditos diarios, rotamos la llave por símbolo.

  // ─── Gestión Dinámica de API Keys (Pool de 32 llaves) ────────────────────────

  /**
   * Verifica si una llave está agotada (considerando el cooldown por minuto).
   * Las llaves se auto-liberan después de KEY_RATE_LIMIT_COOLDOWN_MS.
   */
  private isKeyExhausted(key: string): boolean {
    const exhaustedAt = this.exhaustedKeys.get(key);
    if (exhaustedAt === undefined) return false;
    const elapsed = Date.now() - exhaustedAt;
    if (elapsed >= ApiKeyPool.KEY_RATE_LIMIT_COOLDOWN_MS) {
      // Auto-liberar la llave: el minuto ya pasó
      this.exhaustedKeys.delete(key);
      console.log(`[MarketService] ✅ Llave ...${key.slice(-6)} liberada del cooldown (${(elapsed / 1000).toFixed(0)}s transcurridos). Disponible nuevamente.`);
      return false;
    }
    return true;
  }

  public getAvailableApiKey(symbol: string, currentExhaustedKey?: string): string {
    if (currentExhaustedKey) {
      if (!this.dailyLimitExhaustedKeys.has(currentExhaustedKey)) {
        this.exhaustedKeys.set(currentExhaustedKey, Date.now());
        console.log(`[MarketService] Llave ...${currentExhaustedKey.slice(-6)} marcada como agotada temporal (cooldown ${ApiKeyPool.KEY_RATE_LIMIT_COOLDOWN_MS / 1000}s).`);
      }
      this.broadcastKeysStatus();
    }

    // Llaves ya asignadas a otros símbolos (excluir la del símbolo actual)
    const assignedToOthers = new Set(this.activeAssignments.values());
    const myCurrentKey = this.activeAssignments.get(symbol);
    if (myCurrentKey) assignedToOthers.delete(myCurrentKey);

    // Priorizar llaves ordenándolas según uso de créditos y métricas por minuto (de menor a mayor uso)
    const sortedKeys = [...this.apiKeyList].sort((a, b) => {
      const statsA = this.keyStats.get(a) || { totalRequests: 0, minutelyMax: 0 };
      const statsB = this.keyStats.get(b) || { totalRequests: 0, minutelyMax: 0 };
      if (statsA.minutelyMax !== statsB.minutelyMax) {
        return statsA.minutelyMax - statsB.minutelyMax;
      }
      return statsA.totalRequests - statsB.totalRequests;
    });

    // 1. Buscar primera llave libre (no rate-limit agotada, no daily agotada, no asignada a otro símbolo)
    for (const key of sortedKeys) {
      if (!this.isKeyExhausted(key) && !this.dailyLimitExhaustedKeys.has(key) && !assignedToOthers.has(key)) {
        this.activeAssignments.set(symbol, key);
        console.log(`[MarketService] [${symbol}] Llave activa asignada: ...${key.slice(-6)}`);
        this.broadcastKeysStatus();
        return key;
      }
    }

    // 2. Fallback: llave no agotada (ni rate, ni daily) aunque compartida temporalmente
    for (const key of sortedKeys) {
      if (!this.isKeyExhausted(key) && !this.dailyLimitExhaustedKeys.has(key)) {
        this.activeAssignments.set(symbol, key);
        console.warn(`[MarketService] [${symbol}] ⚠️ Llave compartida ...${key.slice(-6)} (escasez temporal)`);
        this.broadcastKeysStatus();
        return key;
      }
    }

    // 3. Fallback: usar una llave en cooldown temporal (no daily agotada)
    for (const key of sortedKeys) {
      if (!this.dailyLimitExhaustedKeys.has(key)) {
        this.activeAssignments.set(symbol, key);
        console.warn(`[MarketService] [${symbol}] ⚠️ Usando llave en cooldown temporal ...${key.slice(-6)}`);
        this.broadcastKeysStatus();
        return key;
      }
    }

    // 4. Fallback absoluto (todas agotadas — situación crítica)
    console.error(`[MarketService] [${symbol}] ❌ CRÍTICO: Todas las ${this.apiKeyList.length} llaves están agotadas.`);

    // Alerta de agotamiento absoluto para el frontend
    this.emit({
      type: 'keys-exhausted-alert',
      symbol,
      message: `❌ ¡ALERTA CRÍTICA! Se han agotado todas las ${this.apiKeyList.length} llaves API para el símbolo ${symbol}. No es posible obtener más datos.`
    } satisfies BackendMessage);

    this.broadcastKeysStatus();
    return this.apiKeyList[0] || '';
  }

  /**
   * Obtiene el estado actual detallado de todas las llaves API y sus estadísticas de uso.
   */
  public getKeysPoolStatus(): BackendMessage {
    this.checkDailyReset();
    const now = Date.now();

    // Mapeo inverso de llaves activas a símbolos
    const keyToSymbol = new Map<string, string>();
    for (const [sym, key] of this.activeAssignments.entries()) {
      keyToSymbol.set(key, sym);
    }

    // Construir la lista completa de todas las 35 llaves del pool
    const poolDetailsList = this.apiKeyList.map((key, index) => {
      const keyMasked = `...${key.slice(-6)}`;
      const assignedSymbol = keyToSymbol.get(key) || null;

      let status: 'active' | 'shared' | 'rate-limit' | 'daily-limit' = 'active';
      let cooldownRemaining = 0;

      if (this.dailyLimitExhaustedKeys.has(key)) {
        status = 'daily-limit';
      } else {
        const exhaustedAt = this.exhaustedKeys.get(key);
        if (exhaustedAt !== undefined) {
          const remaining = ApiKeyPool.KEY_RATE_LIMIT_COOLDOWN_MS - (now - exhaustedAt);
          if (remaining > 0) {
            status = 'rate-limit';
            cooldownRemaining = Math.ceil(remaining / 1000);
          } else {
            this.exhaustedKeys.delete(key);
          }
        }
      }

      if (status === 'active' && assignedSymbol) {
        const sharingCount = Array.from(this.activeAssignments.values()).filter(k => k === key).length;
        if (sharingCount > 1) {
          status = 'shared';
        }
      }

      let totalRequests = 0;
      let minutelyRate = 0;
      let minutelyMax = 0;

      if (this.keyStats.has(key)) {
        const stats = this.keyStats.get(key)!;
        stats.requestTimestamps = stats.requestTimestamps.filter(ts => now - ts <= 60000);
        totalRequests = stats.totalRequests;
        minutelyRate = stats.requestTimestamps.length;
        minutelyMax = stats.minutelyMax;
      }

      return {
        index: index + 1,
        keyMasked,
        status,
        requestsCount: totalRequests,
        minutelyRate,
        minutelyMax,
        cooldownRemaining,
        assignedSymbol
      };
    });

    // Assignments per symbol (for active currency cards)
    const assignmentsList = this.symbolList.map(sym => {
      const activeKey = this.activeAssignments.get(sym);
      const activeKeyMasked = activeKey ? `...${activeKey.slice(-6)}` : 'Ninguna';

      let status: 'active' | 'shared' | 'exhausted' = 'active';
      if (this.apiKeyList.every(k => this.isKeyExhausted(k) || this.dailyLimitExhaustedKeys.has(k))) {
        status = 'exhausted';
      } else if (activeKey) {
        if (this.isKeyExhausted(activeKey) || this.dailyLimitExhaustedKeys.has(activeKey)) {
          status = 'exhausted';
        } else {
          const sharingSymbolsCount = Array.from(this.activeAssignments.values()).filter(k => k === activeKey).length;
          if (sharingSymbolsCount > 1) {
            status = 'shared';
          }
        }
      }

      let totalRequests = 0;
      let minutelyRate = 0;
      let minutelyMax = 0;

      if (activeKey && this.keyStats.has(activeKey)) {
        const stats = this.keyStats.get(activeKey)!;
        stats.requestTimestamps = stats.requestTimestamps.filter(ts => now - ts <= 60000);
        totalRequests = stats.totalRequests;
        minutelyRate = stats.requestTimestamps.length;
        minutelyMax = stats.minutelyMax;
      }

      return {
        symbol: sym,
        activeKeyMasked,
        status,
        requestsCount: totalRequests,
        minutelyRate,
        minutelyMax
      };
    });

    const exhaustedKeysCount = poolDetailsList.filter(k => k.status === 'rate-limit' || k.status === 'daily-limit').length;
    const allExhausted = poolDetailsList.every(k => k.status === 'rate-limit' || k.status === 'daily-limit');

    const exhaustedKeysDetails = poolDetailsList
      .filter(k => k.status === 'rate-limit')
      .map(k => ({
        keyMasked: k.keyMasked,
        cooldownRemaining: k.cooldownRemaining
      }));

    return {
      type: 'keys-status',
      totalKeys: this.apiKeyList.length,
      exhaustedKeysCount,
      allExhausted,
      assignments: assignmentsList,
      exhaustedKeys: exhaustedKeysDetails,
      poolDetails: poolDetailsList
    } satisfies BackendMessage;
  }

  /**
   * Incrementa el contador de peticiones de una API Key y limpia los registros de más de 60 segundos.
   */
  public incrementKeyRequest(key: string): void {
    if (!key) return;

    if (!this.keyStats.has(key)) {
      this.keyStats.set(key, {
        totalRequests: 0,
        requestTimestamps: [],
        minutelyMax: 0
      });
    }

    const stats = this.keyStats.get(key)!;
    stats.totalRequests++;

    const now = Date.now();
    stats.requestTimestamps.push(now);

    // Limpiar peticiones de más de 60 segundos
    stats.requestTimestamps = stats.requestTimestamps.filter(ts => now - ts <= 60000);

    // Actualizar máximo
    if (stats.requestTimestamps.length > stats.minutelyMax) {
      stats.minutelyMax = stats.requestTimestamps.length;
    }

    this.broadcastKeysStatus();
  }

  /**
   * Transmite el estado actual de las llaves API a todos los clientes.
   */
  public broadcastKeysStatus(): void {
    this.emit(this.getKeysPoolStatus());
  }

  public markDailyExhausted(key: string): void {
    this.dailyLimitExhaustedKeys.add(key);
    this.saveDailyExhaustedKeys(); // Persistir
  }

  public markRateLimited(key: string): void {
    this.exhaustedKeys.set(key, Date.now());
  }

  public assignedKey(symbol: string): string | undefined {
    return this.activeAssignments.get(symbol);
  }
}
