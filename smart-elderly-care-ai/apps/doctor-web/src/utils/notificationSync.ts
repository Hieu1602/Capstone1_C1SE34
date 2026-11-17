// src/utils/notificationSync.ts
// Quản lý đồng bộ trạng thái đọc/chưa đọc thông báo theo thời gian thực (0ms)
// Hỗ trợ Hoàn tác (Undo/Khôi phục) khi lỡ bấm nhầm "Đã đọc tất cả" và toggle từng thông báo.

const READ_STORAGE_KEY = '@doctor_web_read_notifs';
const UNDO_STORAGE_KEY = '@doctor_web_read_notifs_undo';
export const NOTIFS_SYNC_EVENT = 'seca_notifications_sync';

export interface SyncPayload {
  readIds: string[];
  canUndo: boolean;
}

/**
 * Lấy danh sách ID đã đọc từ localStorage
 */
export function getStoredReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

/**
 * Kiểm tra xem có bản sao lưu để Hoàn tác (Undo) hay không
 */
export function hasUndoSnapshot(): boolean {
  try {
    return Boolean(localStorage.getItem(UNDO_STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * Lưu danh sách ID đã đọc, đồng thời phát CustomEvent để mọi component (Navbar, Page) cập nhật 0ms
 */
export function broadcastReadIds(nextIds: Set<string>, undoSnapshot?: Set<string>): void {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(nextIds)));
    if (undoSnapshot !== undefined) {
      if (undoSnapshot.size > 0 || undoSnapshot !== null) {
        localStorage.setItem(UNDO_STORAGE_KEY, JSON.stringify(Array.from(undoSnapshot)));
      } else {
        localStorage.removeItem(UNDO_STORAGE_KEY);
      }
    }
  } catch (e) {
    console.warn('[notificationSync] Error writing to storage:', e);
  }

  const payload: SyncPayload = {
    readIds: Array.from(nextIds),
    canUndo: hasUndoSnapshot(),
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
  return { nextIds: current, isRead: !isCurrentlyRead };
}

/**
 * Đánh dấu tất cả thông báo là đã đọc kèm lưu snapshot để Khôi phục / Hoàn tác nếu bấm nhầm
 */
export function markAllAsReadWithUndo(allItemIds: string[], rawIncidentIds: string[] = []): Set<string> {
  const previous = getStoredReadIds();
  const next = new Set<string>(previous);

  allItemIds.forEach((id) => next.add(id));
  rawIncidentIds.forEach((rawId) => {
    if (rawId) {
      next.add(rawId);
      next.add(`inc_${rawId}`);
    }
  });

  // Lưu lại snapshot trạng thái trước đó để có thể hoàn tác
  broadcastReadIds(next, previous);
  return next;
}

/**
 * Khôi phục trạng thái chưa đọc (Hoàn tác thao tác bấm nhầm "Đã đọc tất cả")
 */
export function restorePreviousReadState(): Set<string> | null {
  try {
    const rawUndo = localStorage.getItem(UNDO_STORAGE_KEY);
    if (!rawUndo) return null;

    const restored = new Set<string>(JSON.parse(rawUndo));
    localStorage.removeItem(UNDO_STORAGE_KEY);
    broadcastReadIds(restored, new Set()); // Xoá undo snapshot sau khi đã hoàn tác
    return restored;
  } catch (e) {
    console.warn('[notificationSync] Error restoring undo snapshot:', e);
    return null;
  }
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
