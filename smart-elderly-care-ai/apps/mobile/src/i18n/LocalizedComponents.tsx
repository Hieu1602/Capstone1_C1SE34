import React from 'react';
import {
  Alert as NativeAlert,
  Text as NativeText,
  TextInput as NativeTextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import type { TextInputProps, TextProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from './config';
import { useThemeStore } from '../store/useThemeStore';

function scaleTextStyle(style: TextProps['style'], fontScale: number) {
  if (!style) {
    if (Platform.OS === 'web') {
      return { fontFamily: "'Inter', 'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, sans-serif" };
    }
    return style;
  }

  const flattened = StyleSheet.flatten(style);
  if (!flattened || typeof flattened !== 'object') return style;

  const nextItem = { ...flattened } as Record<string, any>;

  if (typeof nextItem.fontSize === 'number') {
    if (fontScale !== 1) {
      nextItem.fontSize = Math.round(nextItem.fontSize * fontScale);
    }
    if (typeof nextItem.lineHeight === 'number') {
      if (fontScale !== 1) {
        nextItem.lineHeight = Math.round(nextItem.lineHeight * fontScale);
      }
      if (nextItem.lineHeight < nextItem.fontSize * 1.3) {
        nextItem.lineHeight = Math.round(nextItem.fontSize * 1.35);
      }
    }
  }

  if (Platform.OS === 'web' && !nextItem.fontFamily) {
    nextItem.fontFamily = "'Inter', 'Be Vietnam Pro', 'Plus Jakarta Sans', -apple-system, sans-serif";
  }

  return nextItem;
}

function localizeString(value: string, translate: (key: string, options?: any) => string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;

  // Khi đang ở chế độ Tiếng Việt, giữ nguyên text gốc trong code mà không chạy regex/fallback tiếng Anh
  const currentLang = i18n.language || 'vi';
  if (currentLang.startsWith('vi')) {
    return value;
  }

  const normalized = trimmed.replace(/\s+/g, ' ');
  const translated = translate(normalized, { defaultValue: normalized });

  // Direct hit
  if (translated !== normalized) {
    return value.replace(trimmed, translated);
  }

  // Trailing colon handling (e.g. "Loại Nguồn:", "Kiểu kết nối:", "Chi tiết:")
  if (normalized.endsWith(':')) {
    const withoutColon = normalized.slice(0, -1).trim();
    const trWithoutColon = translate(withoutColon, { defaultValue: withoutColon });
    if (trWithoutColon !== withoutColon) {
      return value.replace(trimmed, `${trWithoutColon}:`);
    }
  }

  // Dynamic prefix: "Người đeo: <tên>"
  const wearerMatch = normalized.match(/^Người đeo:\s*(.+)$/i);
  if (wearerMatch) {
    const wearerLabel = translate('Người đeo', { defaultValue: 'Wearer' });
    const wearerVal = wearerMatch[1].trim() === 'Chưa cập nhật'
      ? translate('Chưa cập nhật', { defaultValue: 'Not updated' })
      : wearerMatch[1].trim();
    return value.replace(trimmed, `${wearerLabel}: ${wearerVal}`);
  }

  // Dynamic invitation confirm: "<name> đã xác nhận đồng ý tham gia căn nhà \"<house>\"!"
  const inviteMatch = normalized.match(/^(.+?)\s+đã xác nhận đồng ý tham gia căn nhà\s*"(.*?)"!?$/i);
  if (inviteMatch) {
    return value.replace(
      trimmed,
      `${inviteMatch[1]} confirmed joining house "${inviteMatch[2]}"!`,
    );
  }

  // Dynamic filter pill: "💊 Uống thuốc" or "💊 Uống thuốc (<count>)"
  const medMatch = normalized.match(/^💊\s*Uống thuốc(?:\s*\((.+)\))?$/i);
  if (medMatch) {
    const medText = translate('Uống thuốc', { defaultValue: 'Medication' });
    const innerStatus = medMatch[1]?.trim();
    if (innerStatus && innerStatus !== 'Xong') {
      return value.replace(trimmed, `💊 ${medText} (${innerStatus})`);
    }
    return value.replace(trimmed, `💊 ${medText}`);
  }

  // Emoji pill: "🚨 Nguy kịch"
  if (/^🚨\s*Nguy kịch$/i.test(normalized)) {
    return value.replace(trimmed, `🚨 ${translate('Nguy kịch', { defaultValue: 'Critical' })}`);
  }

  // Emoji pill: "🗓️ Lịch khám"
  if (/^🗓️\s*Lịch khám$/i.test(normalized)) {
    return value.replace(trimmed, `🗓️ ${translate('Lịch khám', { defaultValue: 'Appointments' })}`);
  }

  // Dynamic prefix: "Thiết bị: <id>"
  const devMatch = normalized.match(/^Thiết bị:\s*(.+)$/i);
  if (devMatch) {
    return value.replace(trimmed, `${translate('Thiết bị', { defaultValue: 'Device' })}: ${devMatch[1]}`);
  }

  // Dynamic prefix: "CẢNH BÁO: <msg>"
  const alertMatch = normalized.match(/^CẢNH BÁO:\s*(.+)$/i);
  if (alertMatch) {
    const warningLabel = translate('CẢNH BÁO', { defaultValue: 'WARNING' });
    const innerMsg = alertMatch[1].trim();
    const translatedInner = translate(innerMsg, { defaultValue: innerMsg });
    return value.replace(trimmed, `${warningLabel}: ${translatedInner}`);
  }

  // Security center dynamic patterns
  const improveMatch = normalized.match(/^Cải thiện ngay\s*\((.+)\)$/i);
  if (improveMatch) {
    return value.replace(trimmed, `Improve now (${improveMatch[1]})`);
  }

  const countSettingsMatch = normalized.match(/^(\d+)\s+thiết lập$/i);
  if (countSettingsMatch) {
    return value.replace(trimmed, `${countSettingsMatch[1]} settings`);
  }

  const countQuestionsMatch = normalized.match(/^(\d+)\s+câu hỏi$/i);
  if (countQuestionsMatch) {
    return value.replace(trimmed, `${countQuestionsMatch[1]} questions`);
  }

  const countSessionsMatch = normalized.match(/^(\d+)\s+phiên gần đây$/i);
  if (countSessionsMatch) {
    return value.replace(trimmed, `${countSessionsMatch[1]} recent sessions`);
  }

  const countTrustedMatch = normalized.match(/^(\d+)\s+thiết bị tin cậy$/i);
  if (countTrustedMatch) {
    return value.replace(trimmed, `${countTrustedMatch[1]} trusted device(s)`);
  }

  if (/^Android\s*[·•]\s*Hiện tại$/i.test(normalized)) {
    return value.replace(trimmed, 'Android · Current');
  }

  // App info / guides patterns
  const versionMatch = normalized.match(/^(.+?)\s*[•·]\s*Phiên bản\s*(.+)$/i);
  if (versionMatch) {
    return value.replace(trimmed, `${versionMatch[1]} • Version ${versionMatch[2]}`);
  }

  const callMatch = normalized.match(/^Gọi ngay:\s*(.+)$/i);
  if (callMatch) {
    return value.replace(trimmed, `Call now: ${callMatch[1]}`);
  }

  const stepMatch = normalized.match(/^Bước\s*(\d+[A-Za-z]?):\s*(.+)$/i);
  if (stepMatch) {
    const innerStep = stepMatch[2].trim();
    const trStep = translate(innerStep, { defaultValue: innerStep });
    return value.replace(trimmed, `Step ${stepMatch[1]}: ${trStep}`);
  }

  // Medical record dynamic patterns
  const birthGenderMatch = normalized.match(/^Năm sinh:\s*(\d+)\s*\((.+?)\)\s*[•·]\s*Giới tính:\s*(.+)$/i);
  if (birthGenderMatch) {
    const gender = translate(birthGenderMatch[3].trim(), { defaultValue: birthGenderMatch[3].trim() });
    return value.replace(trimmed, `Birth year: ${birthGenderMatch[1]} (${birthGenderMatch[2]}) • Gender: ${gender}`);
  }

  const todayPillMatch = normalized.match(/^Hôm nay\s*\((.+)\)$/i);
  if (todayPillMatch) {
    return value.replace(trimmed, `Today (${todayPillMatch[1]})`);
  }

  const yesterdayPillMatch = normalized.match(/^Hôm qua\s*\((.+)\)$/i);
  if (yesterdayPillMatch) {
    return value.replace(trimmed, `Yesterday (${yesterdayPillMatch[1]})`);
  }

  const daysAgoPillMatch = normalized.match(/^(\d+)\s+ngày trước\s*\((.+)\)$/i);
  if (daysAgoPillMatch) {
    return value.replace(trimmed, `${daysAgoPillMatch[1]} days ago (${daysAgoPillMatch[2]})`);
  }

  const dateSummaryMatch = normalized.match(/^Tổng kết ngày\s*(.+)$/i);
  if (dateSummaryMatch) {
    return value.replace(trimmed, `Summary for ${dateSummaryMatch[1]}`);
  }

  const pointsCountMatch = normalized.match(/^(\d+)\s+mốc đo ghi nhận$/i);
  if (pointsCountMatch) {
    return value.replace(trimmed, `${pointsCountMatch[1]} recorded reading(s)`);
  }

  const historyCountMatch = normalized.match(/^Tiền sử bệnh nền\s*\((.+)\)$/i);
  if (historyCountMatch) {
    return value.replace(trimmed, `Medical history (${historyCountMatch[1]})`);
  }

  const membersCountMatch = normalized.match(/^(\d+)\s+người$/i);
  if (membersCountMatch) {
    return value.replace(trimmed, `${membersCountMatch[1]} members`);
  }

  // Unicode subscript ₂ replacement
  if (normalized.includes('SpO₂')) {
    const asciiSpO2 = normalized.replace(/SpO₂/g, 'SpO2');
    const trAscii = translate(asciiSpO2, { defaultValue: asciiSpO2 });
    if (trAscii !== asciiSpO2) {
      return value.replace(trimmed, trAscii);
    }
  }

  return value;
}

function localizeChildren(
  children: React.ReactNode,
  translate: (key: string, options?: any) => string,
): React.ReactNode {
  if (typeof children === 'string') return localizeString(children, translate);
  if (Array.isArray(children)) return children.map((child) => localizeChildren(child, translate));
  return children;
}

export const LocalizedText = React.forwardRef<any, TextProps>(function LocalizedText(
  { children, accessibilityLabel, style, ...props },
  ref,
) {
  const { t } = useTranslation();
  const fontScale = useThemeStore((state) => state.fontScale);

  return (
    <NativeText
      {...props}
      ref={ref}
      style={scaleTextStyle(style, fontScale)}
      accessibilityLabel={typeof accessibilityLabel === 'string' ? localizeString(accessibilityLabel, t) : accessibilityLabel}
    >
      {localizeChildren(children, t)}
    </NativeText>
  );
});

export const LocalizedTextInput = React.forwardRef<any, TextInputProps>(function LocalizedTextInput(
  { placeholder, accessibilityLabel, style, ...props },
  ref,
) {
  const { t } = useTranslation();
  const fontScale = useThemeStore((state) => state.fontScale);

  return (
    <NativeTextInput
      {...props}
      ref={ref}
      style={scaleTextStyle(style as TextProps['style'], fontScale)}
      placeholder={typeof placeholder === 'string' ? localizeString(placeholder, t) : placeholder}
      accessibilityLabel={typeof accessibilityLabel === 'string' ? localizeString(accessibilityLabel, t) : accessibilityLabel}
    />
  );
});

import { useInAppAlertStore, AlertButton } from '../store/useInAppAlertStore';

export const LocalizedAlert = {
  alert: (...args: Parameters<typeof NativeAlert.alert>) => {
    const [title, message, buttons] = args;
    const localizedTitle = typeof title === 'string' ? localizeString(title, i18n.t.bind(i18n)) : (title || '');
    const localizedMessage = typeof message === 'string' ? localizeString(message, i18n.t.bind(i18n)) : (message || '');
    const localizedButtons: AlertButton[] = (buttons || [{ text: 'Đồng ý' }]).map((button) => ({
      text: typeof button.text === 'string' ? localizeString(button.text, i18n.t.bind(i18n)) : button.text,
      onPress: button.onPress,
      style: (button.style as any) || 'default',
    }));

    // Luôn ưu tiên hiển thị Modal trong App chuẩn Mobile (kể cả trên Web và Mobile)
    useInAppAlertStore.getState().showAlert(
      String(localizedTitle),
      String(localizedMessage),
      localizedButtons,
    );
  },
};
