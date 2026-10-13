import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { MarketService } from './market.service';
import type { BackendMessage } from './types';

import { Inject, forwardRef, OnModuleInit } from '@nestjs/common';

@WebSocketGateway()
export class MarketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    @Inject(forwardRef(() => MarketService))
    private readonly marketService: MarketService
  ) {}

  onModuleInit() {
    // Escuchar eventos de broadcast desde el servicio de mercado y transmitirlos
    this.marketService.events.on('broadcast', (message: BackendMessage) => {
      this.broadcast(message);
    });
  }

  handleConnection(client: WebSocket) {
    console.log('[Server] Frontend conectado');

    // Enviar snapshots iniciales de todos los símbolos activos si están disponibles
    const snapshots = this.marketService.getAllLastSnapshots();
    snapshots.forEach((snap) => {
      client.send(JSON.stringify(snap));
    });

    // Enviar estado de las llaves API al conectar
    const keysStatus = this.marketService.getKeysPoolStatus();
    client.send(JSON.stringify(keysStatus));
  }

  handleDisconnect(client: WebSocket) {
    console.log('[Server] Frontend desconectado');
  }

  private broadcast(message: BackendMessage) {
    if (!this.server || !this.server.clients) return;

    const data = JSON.stringify(message);
    this.server.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}
