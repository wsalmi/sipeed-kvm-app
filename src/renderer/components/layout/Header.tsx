import React from 'react';
import { Search, RefreshCw, LayoutGrid, Square, Columns } from 'lucide-react';
import { LayoutMode } from '../../../shared/types/session';
import { useI18n } from '../../i18n/I18nContext';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  layoutMode: LayoutMode;
  onLayoutChange: (mode: LayoutMode) => void;
  onRefreshAll: () => void;
  isRefreshing?: boolean;
  hasActiveSessions: boolean;
  activeSessionCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  layoutMode,
  onLayoutChange,
  onRefreshAll,
  isRefreshing,
  hasActiveSessions,
  activeSessionCount,
}) => {
  const { t } = useI18n();

  return (
    <div className="app-header">
      {/* Search Input */}
      <div className="header-search">
        <Search size={15} className="search-icon" />
        <input
          type="text"
          placeholder={t.header.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button className="clear-search-btn" onClick={() => onSearchChange('')} title={t.header.clearSearch}>
            ✕
          </button>
        )}
      </div>

      <div className="header-controls">
        {/* Layout Grid Selector (only shown when multiple sessions are active) */}
        {hasActiveSessions && activeSessionCount > 1 && (
          <div className="layout-picker" title={t.header.layoutPicker}>
            <button
              className={`layout-btn ${layoutMode === 'single' ? 'active' : ''}`}
              onClick={() => onLayoutChange('single')}
              title={t.header.layoutSingle}
            >
              <Square size={13} />
            </button>
            <button
              className={`layout-btn ${layoutMode === 'grid-1x2' ? 'active' : ''}`}
              onClick={() => onLayoutChange('grid-1x2')}
              title={t.header.layoutSideBySide}
            >
              <Columns size={13} />
            </button>
            <button
              className={`layout-btn ${layoutMode === 'grid-2x2' ? 'active' : ''}`}
              onClick={() => onLayoutChange('grid-2x2')}
              title={t.header.layoutQuad}
            >
              <LayoutGrid size={13} />
            </button>
          </div>
        )}

        {/* Global Refresh Health Button */}
        <button
          className="refresh-btn"
          onClick={onRefreshAll}
          disabled={isRefreshing}
          title={t.header.checkNetworkTooltip}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin-slow' : ''} />
          <span>{t.header.checkNetwork}</span>
        </button>
      </div>
    </div>
  );
};

