'use client';

import type { ReactNode } from 'react';

interface TabItem {
  key: string;
  label: string;
  icon?: ReactNode;
  badge?: number;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function Tabs({ tabs, active, onChange, size = 'md', className = '' }: TabsProps) {
  const padding = size === 'sm' ? 'px-2.5 py-1.5' : 'px-3 py-2';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div
      role="tablist"
      className={`flex gap-0.5 border-b border-[var(--border)] overflow-x-auto scrollbar-none ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={[
              `flex items-center gap-1.5 whitespace-nowrap ${padding} ${textSize}`,
              'rounded-t-lg transition-colors select-none',
              isActive
                ? 'font-semibold border-b-2 -mb-px'
                : 'font-medium hover:bg-[var(--bg-sand)]',
            ].join(' ')}
            style={
              isActive
                ? { color: 'var(--ink)', borderBottomColor: 'var(--ink)' }
                : { color: 'var(--text-muted)' }
            }
          >
            {tab.icon && (
              <span className="shrink-0" aria-hidden="true">
                {tab.icon}
              </span>
            )}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className="inline-flex items-center justify-center rounded-full text-xs font-bold min-w-[18px] h-[18px] px-1"
                style={{
                  backgroundColor: 'var(--danger)',
                  color: '#fff',
                  fontSize: '10px',
                }}
              >
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
