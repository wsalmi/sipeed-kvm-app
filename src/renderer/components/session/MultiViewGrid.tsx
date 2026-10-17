import React from 'react';
import { ActiveSession, LayoutMode } from '../../../shared/types/session';
import { KvmSessionView } from './KvmSessionView';
import { Maximize2, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface MultiViewGridProps {
  sessions: ActiveSession[];
  activeSessionId: string | null;
  layoutMode: LayoutMode;
  onFocusSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onSingleView: (sessionId: string) => void;
  isStretchFill?: boolean;
}

export const MultiViewGrid: React.FC<MultiViewGridProps> = ({
  sessions,
  activeSessionId,
  layoutMode,
  onFocusSession,
  onCloseSession,
  onSingleView,
  isStretchFill = false,
}) => {
  const { t } = useI18n();
  if (sessions.length === 0) return null;

  // Single tab view
  if (layoutMode === 'single') {
    const active = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    return (
      <div className="grid-single-container">
        <KvmSessionView session={active} isFocused={true} isStretchFill={isStretchFill} />
      </div>
    );
  }

  // Grid views: 1x2, 2x2, 3x3
  const gridClass = `grid-layout-${layoutMode}`;

  return (
    <div className={`multi-view-grid ${gridClass}`}>
      {sessions.map((session) => {
        const isFocused = session.id === activeSessionId;

        return (
          <div
            key={session.id}
            className={`grid-cell ${isFocused ? 'grid-cell-focused' : ''}`}
            onClick={() => onFocusSession(session.id)}
            onDoubleClick={() => onSingleView(session.id)}
          >
            {/* Cell mini header */}
            <div className="grid-cell-header">
              <span className="grid-cell-title truncate">{session.title}</span>
              <div className="grid-cell-actions">
                <button
                  className="grid-tool-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSingleView(session.id);
                  }}
                  title={t.session.grid.doubleClickToFocus}
                >
                  <Maximize2 size={11} />
                </button>
                <button
                  className="grid-tool-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseSession(session.id);
                  }}
                  title={t.session.closeSession}
                >
                  <X size={11} />
                </button>
              </div>
            </div>


            <div className="grid-cell-content">
              <KvmSessionView session={session} isFocused={isFocused} isStretchFill={isStretchFill} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
