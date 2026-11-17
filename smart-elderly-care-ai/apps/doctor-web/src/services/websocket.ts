// src/services/websocket.ts
// WebSocket client cho Doctor Web Portal (nhận cảnh báo khẩn cấp & cập nhật thời gian thực)
// Duy trì kết nối Global duy nhất trong Root Layout, không ngắt khi chuyển tab

type AlertCallback = (event: any) => void;

class DoctorWebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<AlertCallback> = new Set();
  private isConnecting = false;
  private reconnectTimer: any = null;
  private shouldStayConnected = false;

  connect() {
    this.shouldStayConnected = true;

    // Nếu đã mở hoặc đang kết nối, không tạo kết nối mới
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    let wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      const host = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
      const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${host}:8000/ws/alerts`;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('seca_doctor_token') : null;
    const finalUrl = `${wsUrl}${token ? (wsUrl.includes('?') ? `&token=${encodeURIComponent(token)}` : `?token=${encodeURIComponent(token)}`) : ''}`;

    this.isConnecting = true;
    try {
      this.ws = new WebSocket(finalUrl);

      this.ws.onopen = () => {
        if (import.meta.env.DEV) {
          console.log('[Doctor WS] Kết nối WebSocket Real-time thành công (Global)');
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
        if (this.shouldStayConnected) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch {
      this.isConnecting = false;
      if (this.shouldStayConnected) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (!this.shouldStayConnected) return;

    this.reconnectTimer = setTimeout(() => {
      if (this.shouldStayConnected) {
        this.connect();
      }
    }, 5000);
  }

  subscribe(callback: AlertCallback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  disconnect() {
    this.shouldStayConnected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnecting = false;
  }
}

export const doctorWebSocket = new DoctorWebSocketClient();
