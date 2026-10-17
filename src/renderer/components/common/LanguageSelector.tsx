import React, { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown, Check } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { Language } from '../../i18n/types';


interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'pt', label: 'Português', nativeLabel: 'Português (BR)', flag: '🇧🇷' },
  { code: 'en', label: 'English', nativeLabel: 'English (US)', flag: '🇺🇸' },
  { code: 'es', label: 'Español', nativeLabel: 'Español', flag: '🇪🇸' },
];

interface LanguageSelectorProps {
  className?: string;
  variant?: 'compact' | 'segmented' | 'dropdown';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className = '',
  variant = 'dropdown',
}) => {
  const { language, setLanguage, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (variant === 'segmented') {
    return (
      <div className={`lang-segmented-control ${className}`}>
        {LANGUAGES.map((opt) => (
          <button
            key={opt.code}
            type="button"
            className={`lang-segment-btn ${language === opt.code ? 'active' : ''}`}
            onClick={() => setLanguage(opt.code)}
            title={opt.nativeLabel}
          >
            <span className="lang-flag">{opt.flag}</span>
            <span className="lang-code">{opt.code.toUpperCase()}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`lang-selector-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className="lang-selector-trigger titlebar-action-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        title={t.titlebar.languageSelect}
        aria-expanded={isOpen}
      >
        <Languages size={13} className="lang-icon" />
        <span className="lang-flag">{currentOption.flag}</span>
        <span className="lang-code-text">{currentOption.code.toUpperCase()}</span>
        <ChevronDown size={11} className={`lang-caret ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="lang-dropdown-menu">
          <div className="lang-dropdown-header">{t.titlebar.languageSelect}</div>
          {LANGUAGES.map((opt) => {
            const isSelected = language === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                className={`lang-dropdown-item ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setLanguage(opt.code);
                  setIsOpen(false);
                }}
              >
                <span className="lang-flag-lg">{opt.flag}</span>
                <span className="lang-name-col">
                  <span className="lang-name-primary">{opt.label}</span>
                  <span className="lang-name-native">{opt.nativeLabel}</span>
                </span>
                {isSelected && <Check size={14} className="lang-check-icon" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
