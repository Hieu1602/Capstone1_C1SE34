// Đồng bộ trạng thái "đã đọc" thông báo của bác sĩ với server (kèm giờ đọc) – dùng chung với Doctor Web.
// Mã chung: inc_<id>, apt_<id>, pat_<id>, sys_<id>. AsyncStorage vẫn giữ làm cache để mở app là có ngay.
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../../../services/api';

const READ_IDS_KEY = '@doctor_read_notification_ids';
const READ_AT_KEY = '@doctor_read_notification_at';

/** Khóa lưu "đã đọc" theo từng tài khoản – tránh 2 bác sĩ dùng chung máy dùng chung trạng thái */
export const readIdsStorageKey = (userId?: string | null) => `${READ_IDS_KEY}:${userId || 'anonymous'}`;
const readAtStorageKey = (userId?: string | null) => `${READ_AT_KEY}:${userId || 'anonymous'}`;

const SERVER_KEY_RE = /^(inc|apt|pat|sys)_/;

export interface ReadState {
  ids: Set<string>;
  readAt: Record<string, string>;
}

type Listener = (state: ReadState) => void;
const listeners = new Set<Listener>();

/** Đăng ký nhận thay đổi trạng thái đọc (từ server / thiết bị khác). Trả về hàm hủy. */
export function subscribeReadState(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function loadReadState(userId?: string | null): Promise<ReadState> {
  const [rawIds, rawAt] = await Promise.all([
    AsyncStorage.getItem(readIdsStorageKey(userId)).catch(() => null),
    AsyncStorage.getItem(readAtStorageKey(userId)).catch(() => null),
  ]);
  let ids = new Set<string>();
  let readAt: Record<string, string> = {};
  try {
    const parsed = rawIds ? JSON.parse(rawIds) : [];
    if (Array.isArray(parsed)) ids = new Set(parsed);
  } catch {}
  try {
    readAt = rawAt ? JSON.parse(rawAt) || {} : {};
  } catch {}
  return { ids, readAt };
}

async function saveAndNotify(userId: string | null | undefined, state: ReadState): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(readIdsStorageKey(userId), JSON.stringify(Array.from(state.ids))),
      AsyncStorage.setItem(readAtStorageKey(userId), JSON.stringify(state.readAt)),
    ]);
  } catch {}
  listeners.forEach((fn) => fn({ ids: new Set(state.ids), readAt: { ...state.readAt } }));
}

function addKey(ids: Set<string>, key: string) {
  ids.add(key);
  if (key.startsWith('inc_')) ids.add(key.slice(4));
}

function removeKey(ids: Set<string>, key: string) {
  ids.delete(key);
  if (key.startsWith('inc_')) ids.delete(key.slice(4));
}

/** Áp dụng kết quả server (API hoặc WebSocket) vào cache cục bộ */
export async function applyServerReads(
  userId: string | null | undefined,
  items: { key: string; read_at?: string }[],
  read = true,
): Promise<void> {
  if (!items.length) return;
  const state = await loadReadState(userId);
  items.forEach(({ key, read_at }) => {
    if (read) {
      addKey(state.ids, key);
      if (read_at) state.readAt[key] = read_at;
    } else {
      removeKey(state.ids, key);
      delete state.readAt[key];
    }
  });
  await saveAndNotify(userId, state);
}

/** Tải trạng thái đã đọc từ server (khi mở danh sách thông báo) */
export async function syncReadsFromServer(userId?: string | null): Promise<void> {
  if (!userId) return;
  try {
    const res = await api.get('/notification-reads');
    if (Array.isArray(res.data)) await applyServerReads(userId, res.data, true);
  } catch (e) {
    console.warn('[notificationReadSync] Không tải được trạng thái đã đọc:', e);
  }
}

/**
 * Lưu tập đã đọc mới: cập nhật cache ngay (UI 0ms) rồi gửi phần thay đổi lên server.
 * Chỉ các mã dạng inc_/apt_/pat_/sys_ được đồng bộ (mã thô trùng lặp chỉ để tương thích cũ).
 */
export async function persistReadIdsWithServer(
  userId: string | null | undefined,
  prevIds: Set<string>,
  nextIds: Set<string>,
): Promise<void> {
  const added = Array.from(nextIds).filter((k) => SERVER_KEY_RE.test(k) && !prevIds.has(k));
  const removed = Array.from(prevIds).filter((k) => SERVER_KEY_RE.test(k) && !nextIds.has(k));
  const state = await loadReadState(userId);
  removed.forEach((k) => delete state.readAt[k]);
  await saveAndNotify(userId, { ids: new Set(nextIds), readAt: state.readAt });
  if (!userId) return;

  const send = async (keys: string[], read: boolean) => {
    for (let i = 0; i < keys.length; i += 500) {
      try {
        const res = await api.post('/notification-reads', { keys: keys.slice(i, i + 500), read });
        if (read && Array.isArray(res.data) && res.data.length) await applyServerReads(userId, res.data, true);
      } catch (e) {
        console.warn('[notificationReadSync] Không lưu được trạng thái đã đọc lên server:', e);
      }
    }
  };
  const newlyRead = added.filter((k) => !state.readAt[k]);
  if (newlyRead.length) await send(newlyRead, true);
  if (removed.length) await send(removed, false);
}

/** Tin WebSocket NOTIFICATIONS_READ: chỉ áp dụng cho chính tài khoản đang đăng nhập */
export function handleReadsWsMessage(data: any, currentUserId?: string | number | null): boolean {
  if (data?.type !== 'NOTIFICATIONS_READ') return false;
  const payload = data.data || {};
  const uid = currentUserId != null ? String(currentUserId) : '';
  if (uid && String(payload.user_id) === uid) {
    applyServerReads(uid, Array.isArray(payload.items) ? payload.items : [], payload.read !== false).catch(
      () => {},
    );
  }
  return true;
}

/** Giờ đọc (ISO) của 1 thông báo */
export function getReadAtFor(readAt: Record<string, string>, id: string, rawIncidentId?: string): string | undefined {
  return (rawIncidentId && readAt[`inc_${rawIncidentId}`]) || readAt[id];
}
