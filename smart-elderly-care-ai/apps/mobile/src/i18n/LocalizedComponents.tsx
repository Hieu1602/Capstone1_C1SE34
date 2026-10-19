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

  const normalized = trimmed.replace(/\s+/g, ' ');
  const translated = translate(normalized, { defaultValue: normalized });
  return value.replace(trimmed, translated);
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

export const LocalizedAlert = {
  alert: (...args: Parameters<typeof NativeAlert.alert>) => {
    const [title, message, buttons, options] = args;
    NativeAlert.alert(
      typeof title === 'string' ? localizeString(title, i18n.t.bind(i18n)) : title,
      typeof message === 'string' ? localizeString(message, i18n.t.bind(i18n)) : message,
      buttons?.map((button) => ({
        ...button,
        text: typeof button.text === 'string' ? localizeString(button.text, i18n.t.bind(i18n)) : button.text,
      })),
      options,
    );
  },
};
