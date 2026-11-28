// src/utils/notificationSync.ts
// Quản lý đồng bộ trạng thái đọc/chưa đọc thông báo theo thời gian thực (0ms)

import { useDoctorAuthStore } from '../store/useDoctorAuthStore';
import { incidentsApi, notificationReadsApi } from '../services/api';

const READ_STORAGE_KEY = '@doctor_web_read_notifs';
const READ_AT_STORAGE_KEY = '@doctor_web_read_at';
export const NOTIFS_SYNC_EVENT = 'seca_notifications_sync';

/** Khóa lưu "đã đọc" theo từng tài khoản – tránh 2 bác sĩ dùng chung trình duyệt dùng chung trạng thái */
const readStorageKey = () => `${READ_STORAGE_KEY}:${useDoctorAuthStore.getState().user?.id || 'anonymous'}`;
const readAtStorageKey = () => `${READ_AT_STORAGE_KEY}:${useDoctorAuthStore.getState().user?.id || 'anonymous'}`;

// ===================== Đồng bộ "đã đọc" với server (kèm giờ đọc) =====================
// Mã chung giữa Web & App: inc_<id>, apt_<id>, pat_<id>, sys_<id>

/** Mã chuẩn gửi lên server cho 1 thông báo */
export const canonicalReadKey = (id: string, rawIncidentId?: string) => (rawIncidentId ? `inc_${rawIncidentId}` : id);

function getReadAtMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(readAtStorageKey()) || '{}');
  } catch {
    return {};
  }
}

function saveReadAtMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(readAtStorageKey(), JSON.stringify(map));
  } catch {
    /* bỏ qua */
  }
}

/** Thời điểm đọc (ISO) của 1 thông báo, nếu có */
export function getReadAt(id: string, rawIncidentId?: string): string | undefined {
  const map = getReadAtMap();
  return map[canonicalReadKey(id, rawIncidentId)] || map[id];
}

/** Thêm mã server vào tập đã đọc (inc_X cũng thêm X để khớp mọi chỗ đang kiểm tra) */
function addServerKey(set: Set<string>, key: string): void {
  set.add(key);
  if (key.startsWith('inc_')) set.add(key.slice(4));
}

function removeServerKey(set: Set<string>, key: string): void {
  set.delete(key);
  if (key.startsWith('inc_')) set.delete(key.slice(4));
}

/** Áp dụng kết quả từ server (API hoặc WebSocket) vào bộ nhớ cục bộ rồi phát sự kiện cập nhật UI */
export function applyServerReads(items: { key: string; read_at?: string }[], read = true): void {
  if (!items.length) return;
  const ids = getStoredReadIds();
  const map = getReadAtMap();
  items.forEach(({ key, read_at }) => {
    if (read) {
      addServerKey(ids, key);
      if (read_at) map[key] = read_at;
    } else {
      removeServerKey(ids, key);
      delete map[key];
    }
  });
  saveReadAtMap(map);
  broadcastReadIds(ids);
}

/** Tải trạng thái đã đọc từ server (gọi khi mở app & khi thiết bị khác vừa đọc) */
export async function syncReadsFromServer(): Promise<void> {
  if (!useDoctorAuthStore.getState().user?.id) return;
  try {
    applyServerReads(await notificationReadsApi.list());
  } catch (e) {
    console.warn('[notificationSync] Không tải được trạng thái đã đọc từ server:', e);
  }
}

/** Gửi thay đổi lên server; server trả về giờ đọc chính thức */
function pushReads(keys: string[], read: boolean): void {
  const unique = Array.from(new Set(keys.filter(Boolean)));
  if (!unique.length || !useDoctorAuthStore.getState().user?.id) return;
  if (!read) {
    const map = getReadAtMap();
    unique.forEach((k) => delete map[k]);
    saveReadAtMap(map);
  }
  // Server nhận tối đa 500 mã / lần
  for (let i = 0; i < unique.length; i += 500) {
    notificationReadsApi
      .set(unique.slice(i, i + 500), read)
      .then((rows) => {
        if (read && rows.length) applyServerReads(rows, true);
      })
      .catch((e) => console.warn('[notificationSync] Không lưu được trạng thái đã đọc lên server:', e));
  }
}

/** Xử lý tin WebSocket NOTIFICATIONS_READ của chính tài khoản này (từ thiết bị khác) */
export function handleReadsWsMessage(data: any): boolean {
  if (data?.type !== 'NOTIFICATIONS_READ') return false;
  const payload = data.data || {};
  if (!payload.user_id || payload.user_id !== useDoctorAuthStore.getState().user?.id) return true;
  applyServerReads(Array.isArray(payload.items) ? payload.items : [], payload.read !== false);
  return true;
}

/** Cảnh báo khẩn cấp: chỉ tắt bằng nút "Đã xử lý" rõ ràng, không bằng "đã đọc" */
export const isUrgentIncident = (inc?: { alert_level?: string | null } | null) =>
  inc?.alert_level === 'HIGH' || inc?.alert_level === 'CRITICAL';

/**
 * Khi mở xem một thông báo thường (không khẩn cấp) -> xác nhận lên server để App bác sĩ cũng thấy "đã đọc".
 * Giống hành vi của App, cảnh báo khẩn cấp không bị xác nhận tự động.
 */
export function syncReadToServer(rawIncidentId?: string, rawIncident?: { alert_level?: string | null; is_acknowledged?: boolean; alert_type?: string } | null): void {
  if (!rawIncidentId || !rawIncident || rawIncident.is_acknowledged) return;
  if (isUrgentIncident(rawIncident) || rawIncident.alert_type === 'HOUSE_INVITE_PENDING') return;
  incidentsApi.acknowledge(rawIncidentId).catch(console.warn);
}

export interface SyncPayload {
  readIds: string[];
}

/**
 * Lấy danh sách ID đã đọc từ localStorage
 */
export function getStoredReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(readStorageKey());
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

/**
 * Lưu danh sách ID đã đọc, đồng thời phát CustomEvent để mọi component (Navbar, Page) cập nhật 0ms
 */
export function broadcastReadIds(nextIds: Set<string>): void {
  try {
    localStorage.setItem(readStorageKey(), JSON.stringify(Array.from(nextIds)));
  } catch (e) {
    console.warn('[notificationSync] Error writing to storage:', e);
  }

  const payload: SyncPayload = {
    readIds: Array.from(nextIds),
  };

  // Bắn sự kiện nội bộ cho cùng tab trình duyệt
  window.dispatchEvent(new CustomEvent<SyncPayload>(NOTIFS_SYNC_EVENT, { detail: payload }));
}

/**
 * Đánh dấu một thông báo là đã đọc
 */
export function markAsRead(id: string, rawIncidentId?: string): Set<string> {
  const current = getStoredReadIds();
  current.add(id);
  if (rawIncidentId) {
    current.add(rawIncidentId);
    current.add(`inc_${rawIncidentId}`);
  }
  broadcastReadIds(current);
  if (!getReadAt(id, rawIncidentId)) pushReads([canonicalReadKey(id, rawIncidentId)], true);
  return current;
}

/**
 * Toggle trạng thái Đã đọc <-> Chưa đọc cho một thông báo cụ thể
 */
export function toggleReadStatus(id: string, rawIncidentId?: string): { nextIds: Set<string>; isRead: boolean } {
  const current = getStoredReadIds();
  const isCurrentlyRead = current.has(id) || (rawIncidentId ? current.has(rawIncidentId) || current.has(`inc_${rawIncidentId}`) : false);

  if (isCurrentlyRead) {
    // Chuyển sang CHƯA ĐỌC
    current.delete(id);
    if (rawIncidentId) {
      current.delete(rawIncidentId);
      current.delete(`inc_${rawIncidentId}`);
    }
  } else {
    // Chuyển sang ĐÃ ĐỌC
    current.add(id);
    if (rawIncidentId) {
      current.add(rawIncidentId);
      current.add(`inc_${rawIncidentId}`);
    }
  }

  broadcastReadIds(current);
  pushReads([canonicalReadKey(id, rawIncidentId)], !isCurrentlyRead);
  return { nextIds: current, isRead: !isCurrentlyRead };
}

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export function markAllAsRead(allItemIds: string[], rawIncidentIds: string[] = []): Set<string> {
  const next = getStoredReadIds();
  const readAt = getReadAtMap();
  const newKeys = [...allItemIds, ...rawIncidentIds.filter(Boolean).map((r) => `inc_${r}`)].filter((k) => !readAt[k]);

  allItemIds.forEach((id) => next.add(id));
  rawIncidentIds.forEach((rawId) => {
    if (rawId) {
      next.add(rawId);
      next.add(`inc_${rawId}`);
    }
  });

  broadcastReadIds(next);
  pushReads(newKeys, true);
  return next;
}

/**
 * Làm sạch văn bản thông báo, loại bỏ lỗi lặp từ ("Bác sĩ BS.", "Đồng hồ thông minh Smartband", v.v.)
 */
export function cleanNotificationText(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/Bác sĩ BS\./g, 'BS.')
    .replace(/Đồng hồ thông minh\s*\(\s*Đồng hồ thông minh Smartband\s*\)/gi, 'Đồng hồ thông minh Smartband')
    .replace(/\(\s*Đồng hồ thông minh Smartband\s*\)/gi, 'Smartband')
    .replace(/(?:\(|;\s*)?Tiền sử(?: bệnh lý)?:\s*(?:\)|;|\.|$)?/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
