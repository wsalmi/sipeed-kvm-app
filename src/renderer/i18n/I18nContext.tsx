import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Language, TranslationSchema } from './types';
import { pt } from './locales/pt';
import { en } from './locales/en';
import { es } from './locales/es';

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationSchema;
}

const STORAGE_KEY = 'salmer_kvm_lang';

const dictionaries: Record<Language, TranslationSchema> = {
  pt,
  en,
  es,
};

function detectSystemLanguage(): Language {
  const navLang = (navigator.language || (navigator.languages && navigator.languages[0]) || '').toLowerCase();
  if (navLang.startsWith('pt')) return 'pt';
  if (navLang.startsWith('es')) return 'es';
  return 'en';
}

function getInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'pt' || saved === 'en' || saved === 'es') {
      return saved;
    }
  } catch (e) {
    console.warn('Failed to read language from localStorage:', e);
  }
  return detectSystemLanguage();
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // Sync with Electron settings if saved on backend
  useEffect(() => {
    if (window.kvmApi) {
      window.kvmApi.getSettings().then((s) => {
        if (s?.language && (s.language === 'pt' || s.language === 'en' || s.language === 'es')) {
          setLanguageState(s.language);
          try {
            localStorage.setItem(STORAGE_KEY, s.language);
          } catch (e) {
            // ignore
          }
        }
      }).catch(console.error);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {
      console.warn('Failed to save language to localStorage:', e);
    }

    if (window.kvmApi) {
      window.kvmApi.saveSettings({ language: lang }).catch(console.error);
    }
  };

  const t = useMemo(() => dictionaries[language] || dictionaries.en, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
