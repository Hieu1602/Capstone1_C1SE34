// src/services/websocket.ts - WebSocket client for real-time alerts

type AlertCallback = (event: any) => void;

class AdminWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<AlertCallback> = new Set();
  private isConnecting = false;
  private reconnectInterval = 5000;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8000/ws/alerts`;

    this.isConnecting = true;
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Admin WS] Kết nối WebSocket Real-time Alerts thành công:', wsUrl);
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          if (event.data === 'pong') return;
          const data = JSON.parse(event.data);
          this.listeners.forEach((cb) => cb(data));
        } catch {
          // ignore plain text ping/pong
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        setTimeout(() => this.connect(), this.reconnectInterval);
      };

      this.ws.onerror = (err) => {
        console.warn('[Admin WS] Lỗi kết nối WebSocket:', err);
        this.ws?.close();
      };
    } catch (e) {
      this.isConnecting = false;
      setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }

  subscribe(callback: AlertCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const adminWebSocket = new AdminWebSocketClient();

