'use client';

/**
 * RiskExplainer — shared component for rendering SHAP top-factor explanations.
 *
 * Nurse / CHW view: shows raw feature names + numeric SHAP values with bars.
 * Parent view (plain=true): shows friendly factor labels and directional icons only.
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ── Factor label maps (plain-language for parents) ────────────────────────────

const FRIENDLY_LABELS: Record<string, string> = {
  weight_kg:           'Weight',
  height_cm:           'Height',
  muac_cm:             'Mid-upper arm measurement',
  age_months:          'Child\'s age',
  waz:                 'Weight for age',
  haz:                 'Height for age',
  whz:                 'Weight for height',
  bmi_z:               'Body mass index',
  temperature_c:       'Body temperature',
  missed_vaccine_count:'Missed vaccines',
  visit_count:         'Number of clinic visits',
  days_since_last_visit:'Days since last visit',
  sex:                 'Sex',
  feeding_type:        'Feeding method',
  gestational_age:     'Gestational age',
  birth_weight:        'Birth weight',
  respiratory_rate:    'Breathing rate',
  oxygen_saturation:   'Oxygen level',
  hemoglobin:          'Haemoglobin (blood)',
  symptoms_count:      'Reported symptoms',
};

function friendlyLabel(feature: string): string {
  return FRIENDLY_LABELS[feature] ?? feature.replace(/_/g, ' ');
}

function barColor(riskLevel: string): string {
  if (riskLevel === 'HIGH')   return 'var(--danger)';
  if (riskLevel === 'MEDIUM') return 'var(--warn)';
  return 'var(--success)';
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RiskFactor {
  feature: string;
  value:   number;   // SHAP value — positive means pushing toward higher risk
}

interface Props {
  /** Top SHAP factors as {feature, value} pairs or raw Record<string,number> */
  factors:   RiskFactor[] | Record<string, number>;
  riskLevel: string;
  /** When true, show parent-friendly labels and no numeric SHAP values */
  plain?:    boolean;
  /** Max factors to display */
  limit?:    number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RiskExplainer({ factors, riskLevel, plain = false, limit = 5 }: Props) {
  // Normalise to array
  const entries: RiskFactor[] = Array.isArray(factors)
    ? factors
    : Object.entries(factors as Record<string, number>).map(([feature, value]) => ({ feature, value }));

  const sorted = [...entries]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, limit);

  if (sorted.length === 0) return null;

  const maxAbs = Math.max(...sorted.map((f) => Math.abs(f.value)), 0.001);
  const color  = barColor(riskLevel);

  if (plain) {
    // ── Parent-friendly view ─────────────────────────────────────────────────
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Key factors identified
        </p>
        <div className="flex flex-col gap-1.5">
          {sorted.map(({ feature, value }) => {
            const isRising  = value > 0.01;
            const isFalling = value < -0.01;
            const Icon = isRising ? TrendingUp : isFalling ? TrendingDown : Minus;
            const iconColor = isRising ? 'var(--danger)' : isFalling ? 'var(--success)' : 'var(--text-muted)';
            const desc = isRising
              ? 'contributing to risk'
              : isFalling
              ? 'helping protect'
              : 'neutral factor';
            return (
              <div key={feature} className="flex items-center gap-2 text-sm">
                <Icon size={14} style={{ color: iconColor, flexShrink: 0 }} />
                <span style={{ color: 'var(--ink)' }}>{friendlyLabel(feature)}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>— {desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Clinical view (nurse / CHW / supervisor) ─────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        SHAP feature contributions
      </p>
      <div className="flex flex-col gap-2">
        {sorted.map(({ feature, value }) => (
          <div key={feature} className="flex items-center gap-3">
            <span className="text-xs w-40 truncate" style={{ color: 'var(--text-muted)' }}>
              {feature.replace(/_/g, ' ')}
            </span>
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-sand)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(Math.abs(value) / maxAbs) * 100}%`,
                  backgroundColor: value > 0 ? color : 'var(--text-muted)',
                }}
              />
            </div>
            <span className="text-xs font-mono w-14 text-right" style={{ color: 'var(--ink)' }}>
              {value > 0 ? '+' : ''}{value.toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
