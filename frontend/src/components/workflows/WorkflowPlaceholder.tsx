'use client';

import { Construction } from 'lucide-react';

interface WorkflowPlaceholderProps {
  title: string;
  description?: string;
  phase?: string;
}

/** Renders a standard "coming soon" card for workflows not yet implemented. */
export function WorkflowPlaceholder({ title, description, phase }: WorkflowPlaceholderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >
          {title}
        </h2>
        {phase && (
          <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Planned: {phase}
          </p>
        )}
      </div>
      <div
        className="rounded-2xl border border-dashed p-10 flex flex-col items-center gap-4 text-center"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-sand)' }}
        >
          <Construction size={28} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            This workflow is coming soon
          </p>
          {description && (
            <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
