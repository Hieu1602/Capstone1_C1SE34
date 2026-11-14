// src/services/websocket.ts
// WebSocket client cho Doctor Web Portal (nhận cảnh báo khẩn cấp & cập nhật thời gian thực)

type AlertCallback = (event: any) => void;

class DoctorWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<AlertCallback> = new Set();
  private isConnecting = false;
  private reconnectTimer: any = null;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    let wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      const host = window.location.hostname || 'localhost';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${host}:8000/ws/alerts`;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('seca_doctor_token') : null;
    const finalUrl = `${wsUrl}${token ? (wsUrl.includes('?') ? `&token=${encodeURIComponent(token)}` : `?token=${encodeURIComponent(token)}`) : ''}`;

    this.isConnecting = true;
    try {
      this.ws = new WebSocket(finalUrl);

      this.ws.onopen = () => {
        if (import.meta.env.DEV) {
          console.log('[Doctor WS] Kết nối WebSocket Real-time thành công');
        }
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.listeners.forEach((callback) => callback(data));
        } catch {
          // Ignore parse errors
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  subscribe(callback: AlertCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const doctorWebSocket = new DoctorWebSocketClient();

