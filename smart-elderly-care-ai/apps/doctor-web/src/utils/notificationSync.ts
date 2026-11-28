// src/utils/notificationSync.ts
// Quản lý đồng bộ trạng thái đọc/chưa đọc thông báo theo thời gian thực (0ms)

import { useDoctorAuthStore } from '../store/useDoctorAuthStore';
import { incidentsApi } from '../services/api';

const READ_STORAGE_KEY = '@doctor_web_read_notifs';
export const NOTIFS_SYNC_EVENT = 'seca_notifications_sync';

/** Khóa lưu "đã đọc" theo từng tài khoản – tránh 2 bác sĩ dùng chung trình duyệt dùng chung trạng thái */
const readStorageKey = () => `${READ_STORAGE_KEY}:${useDoctorAuthStore.getState().user?.id || 'anonymous'}`;

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

/** Ghi đè cache local từ danh sách read_ids trên server (dùng khi hydrate hoặc nhận WS từ Mobile). */
export function syncReadIdsFromServerPayload(readIds: string[]): Set<string> {
  const next = new Set<string>(readIds);
  broadcastReadIds(next);
  return next;
}

/** Tải danh sách ID đã đọc từ server về đồng bộ 2 chiều Web <-> App. */
export async function hydrateReadIdsFromServer(): Promise<Set<string>> {
  const serverIds = await incidentsApi.getReadState();
  if (serverIds.length > 0) {
    return syncReadIdsFromServerPayload(serverIds);
  }
  return getStoredReadIds();
}

/**
 * Đánh dấu một thông báo là đã đọc
 */
export function markAsRead(id: string, rawIncidentId?: string): Set<string> {
  const current = getStoredReadIds();
  const added = [id];
  current.add(id);
  if (rawIncidentId) {
    current.add(rawIncidentId);
    current.add(`inc_${rawIncidentId}`);
    added.push(rawIncidentId, `inc_${rawIncidentId}`);
  }
  broadcastReadIds(current);
  incidentsApi.updateReadState(added).catch(console.warn);
  return current;
}

/**
 * Toggle trạng thái Đã đọc <-> Chưa đọc cho một thông báo cụ thể
 */
export function toggleReadStatus(id: string, rawIncidentId?: string): { nextIds: Set<string>; isRead: boolean } {
  const current = getStoredReadIds();
  const isCurrentlyRead = current.has(id) || (rawIncidentId ? current.has(rawIncidentId) || current.has(`inc_${rawIncidentId}`) : false);
  const targetIds = [id, ...(rawIncidentId ? [rawIncidentId, `inc_${rawIncidentId}`] : [])];

  if (isCurrentlyRead) {
    // Chuyển sang CHƯA ĐỌC
    targetIds.forEach((k) => current.delete(k));
    incidentsApi.updateReadState([], targetIds).catch(console.warn);
  } else {
    // Chuyển sang ĐÃ ĐỌC
    targetIds.forEach((k) => current.add(k));
    incidentsApi.updateReadState(targetIds).catch(console.warn);
  }

  broadcastReadIds(current);
  return { nextIds: current, isRead: !isCurrentlyRead };
}

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export function markAllAsRead(allItemIds: string[], rawIncidentIds: string[] = []): Set<string> {
  const next = getStoredReadIds();
  const added: string[] = [];

  allItemIds.forEach((id) => {
    next.add(id);
    added.push(id);
  });
  rawIncidentIds.forEach((rawId) => {
    if (rawId) {
      next.add(rawId);
      next.add(`inc_${rawId}`);
      added.push(rawId, `inc_${rawId}`);
    }
  });

  broadcastReadIds(next);
  if (added.length > 0) {
    incidentsApi.updateReadState(added).catch(console.warn);
  }
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
