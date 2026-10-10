import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import english from './english';

i18n.use(initReactI18next).init({
  resources: {
    vi: { translation: {} },
    en: { translation: english },
  },
  lng: 'vi',
  fallbackLng: 'vi',
  keySeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
