import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enUS, ru as ruLocale } from 'date-fns/locale';
import en from './locales/en.json';
import ru from './locales/ru.json';

const languageStorageKey = 'grace_planner_lang';
const fallbackLng = 'ru';

const savedLanguage = localStorage.getItem(languageStorageKey);
const initialLanguage = savedLanguage
  ? savedLanguage
  : navigator.language?.toLowerCase().startsWith('ru')
  ? 'ru'
  : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: initialLanguage,
  fallbackLng,
  interpolation: { escapeValue: false },
});

export const getDateFnsLocale = (language: string) =>
  language.startsWith('ru') ? ruLocale : enUS;

const setDocumentLanguage = (language: string) => {
  document.documentElement.lang = language.startsWith('ru') ? 'ru' : 'en';
};

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(languageStorageKey, lng);
  setDocumentLanguage(lng);
});

setDocumentLanguage(i18n.language);

export default i18n;
