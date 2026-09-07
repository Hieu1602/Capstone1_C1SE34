// websocket.ts
// WebSocket client – Nhận chỉ số sinh hiệu real-time từ Backend

const WS_BASE_URL: string = (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_WS_URL) || 'ws://10.0.2.2:8000/ws';

export type VitalPayload = {
  type: 'telemetry';
  device_id: string;
  timestamp: number;
  heart_rate?: number;
  spo2?: number;
  skin_temp_max?: number;
  person_count?: number;
  fall_detected?: boolean;
};

type WSHandler = (data: VitalPayload) => void;

class VitalsWebSocket {
  private socket: WebSocket | null = null;
  private deviceId: string = '';
  private handlers: Set<WSHandler> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  connect(deviceId: string): void {
    this.deviceId = deviceId;
    this.shouldReconnect = true;
    this._connect();
  }

  private _connect(): void {
    const url = `${WS_BASE_URL}/vitals/${this.deviceId}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('[WS] Kết nối real-time vitals:', this.deviceId);
      // Ping mỗi 30s để giữ kết nối
      this.pingInterval = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send('ping');
        }
      }, 30_000);
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        if (event.data === 'pong') return;
        const data: VitalPayload = JSON.parse(event.data);
        this.handlers.forEach((handler) => handler(data));
      } catch {
        console.warn('[WS] Parse error:', event.data);
      }
    };

    this.socket.onclose = () => {
      console.warn('[WS] Kết nối đóng. Reconnect sau 3s...');
      this._clearPing();
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this._connect(), 3000);
      }
    };

    this.socket.onerror = (error: Event) => {
      console.error('[WS] Lỗi:', error);
    };
  }

  subscribe(handler: WSHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this._clearPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.socket?.close();
    this.socket = null;
  }

  private _clearPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const vitalsWS = new VitalsWebSocket();
