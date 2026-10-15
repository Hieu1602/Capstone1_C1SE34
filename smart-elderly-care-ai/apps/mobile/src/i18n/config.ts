import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import english from './english';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Rehydrate user language preference from AsyncStorage
AsyncStorage.getItem('smartcare-user-language').then((savedLng) => {
  if (savedLng === 'en' || savedLng === 'vi') {
    void i18n.changeLanguage(savedLng);
  }
}).catch(() => {});

export default i18n;
