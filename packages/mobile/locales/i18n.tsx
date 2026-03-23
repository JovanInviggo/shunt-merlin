import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import en from "./en";
import de from "./de";

// Available languages
export type Language = "en" | "de";

// Translation type (based on English as the base)
type Translations = typeof en;

// All translations
const translations: Record<Language, Translations> = {
  en,
  de,
};

// Default language
const DEFAULT_LANGUAGE: Language = "en";

// Context type
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

// Create context
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Provider component
interface I18nProviderProps {
  children: ReactNode;
  initialLanguage?: Language;
}

export function I18nProvider({ children, initialLanguage = DEFAULT_LANGUAGE }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const value: I18nContextType = {
    language,
    setLanguage,
    t: translations[language],
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Hook to use translations
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

// Helper function for interpolation (e.g., {{count}} -> actual value)
export function interpolate(text: string, params: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key]?.toString() ?? `{{${key}}}`;
  });
}
