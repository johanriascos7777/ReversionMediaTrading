import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';
import { MarketService } from './market.service';
import type { BackendMessage } from './types';

@WebSocketGateway()
export class MarketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server: Server;

  constructor(private readonly marketService: MarketService) {
    // Escuchar eventos de broadcast desde el servicio de mercado y transmitirlos
    this.marketService.events.on('broadcast', (message: BackendMessage) => {
      this.broadcast(message);
    });
  }

  handleConnection(client: WebSocket) {
    console.log('[Server] Frontend conectado');

    // Enviar el snapshot inicial si está disponible
    const initialSnapshot = this.marketService.getLastSnapshotMessage();
    if (initialSnapshot) {
      client.send(JSON.stringify(initialSnapshot));
    }
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
