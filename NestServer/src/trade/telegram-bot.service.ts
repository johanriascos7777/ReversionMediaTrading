import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository, EntityManager } from '@mikro-orm/mysql';
import { PendingSignal } from './pending-signal.entity';
import { Trade } from './trade.entity';
import { TradeService } from './trade.service';
import { RequestContext } from '@mikro-orm/core';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private botToken: string = '';
  private chatId: string = '';
  private isRunning: boolean = false;
  private offset: number = 0;
  private pendingPriceInputChatMap = new Map<number, number>(); // chatId -> pendingSignalId

  constructor(
    @InjectRepository(PendingSignal)
    private readonly pendingSignalRepo: EntityRepository<PendingSignal>,
    @InjectRepository(Trade)
    private readonly tradeRepo: EntityRepository<Trade>,
    private readonly tradeService: TradeService,
    private readonly em: EntityManager,
  ) {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  async onModuleInit() {
    if (!this.botToken) {
      console.warn('[Telegram-Bot] No TELEGRAM_BOT_TOKEN found in .env. Bot loop not started.');
      return;
    }
    this.isRunning = true;
    this.startPolling();
    console.log('[Telegram-Bot] Bot service started (Long Polling)...');
  }

  onModuleDestroy() {
    this.isRunning = false;
  }

  private async startPolling() {
    while (this.isRunning) {
      try {
        await this.pollUpdates();
      } catch (err) {
        const isRateLimit = err.message && err.message.includes('429');
        if (isRateLimit) {
          console.warn('[Telegram-Bot] Rate limit exceeded (HTTP 429). Waiting 30 seconds before retrying to respect Telegram API rules...');
          await new Promise(resolve => setTimeout(resolve, 30000));
        } else {
          console.error('[Telegram-Bot] Polling error:', err);
          // Wait 5 seconds before retrying on general crash
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  }

  private async pollUpdates() {
    const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=20`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Telegram API responded with ${res.status}`);
    }
    const data = await res.json() as any;
    if (data.ok && data.result.length > 0) {
      for (const update of data.result) {
        this.offset = update.update_id + 1;
        await this.handleUpdate(update);
      }
    }
  }

  private async handleUpdate(update: any) {
    // 1️⃣ Botón inline presionado (Callback Query)
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
    // 2️⃣ Mensaje de texto recibido
    else if (update.message && update.message.text) {
      await this.handleMessage(update.message);
    }
  }

  private async handleCallbackQuery(cb: any) {
    await RequestContext.create(this.em, async () => {
      const callbackQueryId = cb.id;
      const data = cb.data as string; // ej: "approve:42" o "discard:42"
      const messageId = cb.message.message_id;
      const fromChatId = cb.message.chat.id;

      // Responder al callback query de inmediato para quitar el cargando en Telegram
      await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId }),
      });

      const [action, idStr] = data.split(':');
      const signalId = parseInt(idStr, 10);
      if (isNaN(signalId)) return;

      // Buscar la señal pendiente
      const signal = await this.pendingSignalRepo.findOne(signalId);
      if (!signal) {
        await this.sendTelegramMessage(fromChatId, '❌ Error: Esta alerta ya no existe en la base de datos.');
        return;
      }

      if (signal.status !== 'pending') {
        await this.sendTelegramMessage(fromChatId, `⚠️ Esta alerta ya fue procesada anteriormente (Estado: ${signal.status}).`);
        return;
      }

      if (action === 'approve') {
        // Registrar que este chat está esperando el precio para esta señal
        this.pendingPriceInputChatMap.set(fromChatId, signalId);

        // Enviar solicitud de precio
        await this.sendTelegramMessage(
          fromChatId,
          `✍️ **Aprobando Alerta #${signalId} (${signal.symbol} ${signal.direction})**\n\nPor favor, responde a este mensaje con el precio de ejecución real (ej: \`${signal.entryPrice.toFixed(5)}\`) o escribe \`auto\` para registrarla con el precio de la alerta.`,
          messageId
        );
      } else if (action === 'discard') {
        // Cambiar estado a simulación activa (Fomowatch)
        signal.status = 'discarded_active';
        signal.openedAt = new Date();
        await this.em.flush();

        // Editar mensaje original para notificar descarte
        await this.editTelegramMessage(
          fromChatId,
          messageId,
          `🛑 **Alerta Descartada — Iniciando Simulación Fomowatch**\n\nSímbolo: ${signal.symbol}\nDirección: ${signal.direction}\nPrecio Alerta: ${signal.entryPrice.toFixed(5)}\n\nEl simulador medirá si toca TP o SL de forma autónoma.`
        );
      }
    });
  }

  private async handleMessage(msg: any) {
    await RequestContext.create(this.em, async () => {
      const chatId = msg.chat.id;
      const text = msg.text.trim();
      const replyToMessage = msg.reply_to_message;

      // Verificar si estamos esperando un precio de este chat
      const pendingSignalId = this.pendingPriceInputChatMap.get(chatId);
      if (!pendingSignalId) return;

      const signal = await this.pendingSignalRepo.findOne(pendingSignalId);
      if (!signal) {
        this.pendingPriceInputChatMap.delete(chatId);
        await this.sendTelegramMessage(chatId, '❌ La alerta pendiente ya no existe.');
        return;
      }

      let executionPrice = signal.entryPrice;
      if (text.toLowerCase() !== 'auto') {
        const parsedPrice = parseFloat(text);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
          await this.sendTelegramMessage(
            chatId,
            `❌ Precio inválido. Envía un número correcto (ej: \`${signal.entryPrice.toFixed(5)}\`) o escribe \`auto\`.`,
            msg.message_id
          );
          return;
        }
        executionPrice = parsedPrice;
      }

      try {
        // 1. Crear el Trade real
        const trade = await this.tradeService.create({
          symbol: signal.symbol,
          direction: signal.direction,
          tradeType: 'scalping',
          tradeMode: signal.tradeMode as any,
          session: signal.session as any,
          entryPrice: executionPrice,
          leverage: 200, // leverage por defecto (ajustable en bitácora)
          spread: 0.00013,
          investmentAmount: 2.0, // inversión estándar
          hasTypeC: signal.hasTypeC,
          hasPedestrianLight: signal.hasPedestrianLight,
          elasticityM5State: signal.elasticityM5State,
          elasticityM15State: signal.elasticityM15State,
          fusedState: signal.fusedState,
          elasticityM5Value: signal.elasticityM5Value,
          elasticityM15Value: signal.elasticityM15Value,
          structureState: signal.structureState,
          structureSignal: signal.structureSignal,
          rsiAtEntry: signal.rsiAtEntry,
          divergenceAtEntry: signal.divergenceAtEntry,
          ema200SlopeAtEntry: signal.ema200SlopeAtEntry,
          nearestSRPrice: signal.nearestSRPrice,
          nearestSRType: signal.nearestSRType,
          nearestSRStrength: signal.nearestSRStrength,
          nearestSRDistance: signal.nearestSRDistance,
          contextualWinRate: signal.contextualWinRate,
          contextualCases: signal.contextualCases,
          openedAt: new Date().toISOString(),
          notes: `Registrado automáticamente desde Telegram Bot. Precio sugerido: ${signal.entryPrice.toFixed(5)}. Precio real: ${executionPrice.toFixed(5)}`,
        });

        // 2. Actualizar el estado de la alerta pendiente
        signal.status = 'approved';
        signal.closedAt = new Date();
        await this.em.flush();

        // Quitar de la cola de espera
        this.pendingPriceInputChatMap.delete(chatId);

        // Enviar confirmación al usuario
        await this.sendTelegramMessage(
          chatId,
          `✅ **¡Operación registrada con éxito!**\n\nTrade ID: \`#${trade.id}\`\nSímbolo: ${trade.symbol}\nDirección: ${trade.direction}\nPrecio Entrada: \`${executionPrice.toFixed(5)}\`\nModo: ${trade.tradeMode}\n\nPuedes verla e inspeccionarla en tu Torre de Control.`,
          msg.message_id
        );

        // Intentar actualizar el mensaje de la alerta original si fue una respuesta
        if (replyToMessage) {
          // En una respuesta a la solicitud de precio, podemos buscar la alerta y actualizar su texto
          // En este flujo, no tenemos el message_id exacto de la alerta original aquí fácilmente,
          // pero podemos mandar un aviso limpio.
        }
      } catch (err) {
        console.error('[Telegram-Bot] Error registrando trade:', err);
        await this.sendTelegramMessage(chatId, `❌ Error interno al registrar la operación: ${err.message}`);
      }
    });
  }

  private async sendTelegramMessage(chatId: number, text: string, replyToMessageId?: number) {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyToMessageId) {
      payload.reply_to_message_id = replyToMessageId;
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  private async editTelegramMessage(chatId: number, messageId: number, text: string) {
    const url = `https://api.telegram.org/bot${this.botToken}/editMessageText`;
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'Markdown',
    };
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
}
