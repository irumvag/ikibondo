'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Heart, Syringe, Bell, BellOff, ChevronRight, CheckCheck,
  Calendar, AlertTriangle, Clock, UserCheck, MessageSquare,
  QrCode, X, Printer,
} from 'lucide-react';
const QRCodeSVG = dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), { ssr: false });
import { Alert } from '@/components/ui/Alert';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useMyChildren, useNotifications, QK, useChildVaccinations } from '@/lib/api/queries';
import { markAllRead, markNotificationRead } from '@/lib/api/parent';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import type { SupervisedChild } from '@/lib/api/parent';

// ── constants ──────────────────────────────────────────────────────────────────

const RISK_VARIANT: Record<string, 'danger' | 'warn' | 'success' | 'default'> = {
  HIGH: 'danger', MEDIUM: 'warn', LOW: 'success', UNKNOWN: 'default',
};
const RISK_DOT: Record<string, string> = {
  HIGH: 'var(--danger)', MEDIUM: 'var(--warn)', LOW: 'var(--success)', UNKNOWN: 'var(--text-muted)',
};
// Risk levels the API returns; their text is in messages/en.json under parent.home.riskStatus / riskBadge
const RISK_LEVELS = ['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'] as const;
const isRiskLevel = (v: string): v is (typeof RISK_LEVELS)[number] => (RISK_LEVELS as readonly string[]).includes(v);
function NotifIcon({ type }: { type: string }) {
  if (type === 'HIGH_RISK_ALERT' || type === 'SAM_ALERT')
    return <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />;
  if (type === 'VACCINATION_REMINDER' || type === 'VACCINATION_OVERDUE')
    return <Syringe size={16} style={{ color: 'var(--ink)' }} />;
  return <Bell size={16} style={{ color: 'var(--text-muted)' }} />;
}

// ── Child vaccination mini-summary ────────────────────────────────────────────

function VaccineSummary({ childId }: { childId: string }) {
  const tt = useTranslations('parent.home');
  const { data: vax = [], isLoading } = useChildVaccinations(childId);
  if (isLoading) return <Skeleton className="h-4 w-24 rounded" />;

  const scheduled = vax.filter((v) => v.status === 'SCHEDULED');
  const overdue   = scheduled.filter((v) => v.is_overdue);
  const upcoming  = scheduled.filter((v) => !v.is_overdue);
  const done      = vax.filter((v) => v.status === 'DONE').length;

  if (scheduled.length === 0 && done === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1.5">
      {overdue.length > 0 && (
        <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--danger)' }}>
          <Syringe size={11} />{' '}{tt('overdue', { length: overdue.length })}</span>
      )}
      {upcoming.length > 0 && (
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Clock size={11} />{' '}{tt('upcoming', { length: upcoming.length })}</span>
      )}
      {done > 0 && (
        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--success)' }}>{tt('done', { done: done })}</span>
      )}
    </div>
  );
}

// ── Child Card ────────────────────────────────────────────────────────────────

interface QRTarget { id: string; name: string; reg: string; camp?: string }

function ChildCard({ child, onShowQR }: { child: SupervisedChild; onShowQR: (t: QRTarget) => void }) {
  const tt = useTranslations('parent.home');
  const rl = child.risk_level ?? 'UNKNOWN';
  const riskDot = RISK_DOT[rl] ?? 'var(--text-muted)';

  return (
    <div
      className="flex rounded-2xl border border-l-4 overflow-hidden transition-all hover:shadow-[var(--shadow-sm)]"
      style={{ borderColor: 'var(--border)', borderLeftColor: riskDot, backgroundColor: 'var(--bg-elev)' }}
    >
      {/* Main link area */}
      <Link
        href={`/parent/children/${child.id}`}
        className="flex items-start gap-4 p-5 flex-1 min-w-0 transition-colors hover:bg-[var(--bg-sand)]"
      >
        {/* Avatar with risk dot */}
        <div className="relative shrink-0">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-sand)' }}
          >
            <Heart size={22} style={{ color: 'var(--ink)' }} />
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{ backgroundColor: riskDot, borderColor: 'var(--bg-elev)' }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{child.full_name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {child.age_display} · {child.sex === 'M' ? tt('boy') : tt('girl')} · {child.registration_number}
              </p>
            </div>
            <Badge variant={RISK_VARIANT[rl] ?? 'default'} className="shrink-0">
              {isRiskLevel(rl) ? tt(`riskBadge.${rl}`) : rl}
            </Badge>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{isRiskLevel(rl) ? tt(`riskStatus.${rl}`) : '—'}</p>
          <VaccineSummary childId={child.id} />
        </div>

        <ChevronRight size={16} className="shrink-0 self-center" style={{ color: 'var(--text-muted)' }} />
      </Link>

      {/* QR shortcut button */}
      <button
        type="button"
        onClick={() => onShowQR({ id: child.id, name: child.full_name, reg: child.registration_number })}
        className="flex flex-col items-center justify-center gap-1 px-4 transition-colors hover:bg-[var(--bg-sand)] shrink-0"
        style={{ borderLeft: '1px solid var(--border)', color: 'var(--text-muted)', minWidth: 58 }}
        title={tt('showQrCode')}
        aria-label={tt('showQrFor', { name: child.full_name })}
      >
        <QrCode size={18} style={{ color: 'var(--ink)' }} />
        <span style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>QR</span>
      </button>
    </div>
  );
}

// ── QR overlay modal ──────────────────────────────────────────────────────────

function QROverlay({ target, onClose }: { target: QRTarget; onClose: () => void }) {
  const tt = useTranslations('parent.home');
  const print = () => {
    const w = window.open('', '_blank', 'width=420,height=540');
    if (!w) return;
    const el = document.getElementById('dash-qr-img');
    const qrHtml = el?.outerHTML ?? '';
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${tt('qrPrintTitle', { name: target.name })}</title>
      <style>body{font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;
        justify-content:center;min-height:100vh;margin:0;padding:32px;text-align:center;background:#fff;}
        h1{font-size:20px;font-weight:700;margin:0 0 4px;} .reg{font-size:11px;font-family:monospace;
        color:#6b7280;letter-spacing:.05em;margin-bottom:16px;} .qr{padding:16px;border:1px solid #e5e7eb;
        border-radius:16px;display:inline-block;margin-bottom:16px;} .footer{font-size:9px;color:#9ca3af;margin-top:8px;}
      </style></head><body>
        <h1>${target.name}</h1><p class="reg">${target.reg}</p>
        <div class="qr">${qrHtml}</div>
        <p class="footer">${tt('qrPrintFooter')}</p>
        <script>window.onload=function(){window.print();};<\/script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-3xl flex flex-col items-center gap-5 p-6"
        style={{
          backgroundColor: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full flex items-start justify-between">
          <div>
            <p className="font-bold text-lg leading-tight" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
              {target.name}
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{target.reg}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-sand)]"
            style={{ color: 'var(--text-muted)' }}
            aria-label={tt('close')}
          >
            <X size={16} />
          </button>
        </div>

        {/* QR code */}
        <div
          id="dash-qr-img"
          className="p-4 rounded-2xl"
          style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
        >
          <QRCodeSVG value={target.id} size={200} level="M" includeMargin={false} />
        </div>

        <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--text-muted)' }}>{tt('showThisToYour')}</p>

        {/* Actions */}
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={print}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-[var(--bg-sand)]"
            style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
          >
            <Printer size={14} />{' '}{tt('print')}</button>
          <Link
            href={`/parent/children/${target.id}?tab=qr`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
          >{tt('fullDetail')}</Link>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function ParentDashboard() {
  const tt = useTranslations('parent.home');
  const user = useAuthStore((s) => s.user);
  const qc   = useQueryClient();
  const [qrChild, setQrChild] = useState<QRTarget | null>(null);

  const { data: childrenData, isLoading: childrenLoading } = useMyChildren();
  const { data: notifData,    isLoading: notifLoading }    = useNotifications();

  const children    = childrenData?.items ?? [];
  const childCount  = childrenData?.count ?? 0;
  const notifs      = notifData?.items ?? [];
  const unreadCount = notifData?.unread ?? 0;

  // Count children with overdue vaccines for KPI
  const highRiskCount = children.filter((c) => c.risk_level === 'HIGH').length;

  const handleMarkAllRead = async () => {
    await markAllRead();
    await qc.invalidateQueries({ queryKey: QK.notifications });
  };

  const handleMarkOneRead = async (id: string) => {
    await markNotificationRead(id);
    await qc.invalidateQueries({ queryKey: QK.notifications });
  };

  return (
    <>
    <div className="flex flex-col gap-8 max-w-2xl mx-auto w-full">

      {/* Greeting */}
      <div>
        <h2
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
        >{tt('hello')}{' '}{user?.full_name?.split(' ')[0] ?? tt('parent')} 👋
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          {user?.camp_name ? ` · ${user.camp_name}` : ''}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <KPICard
          label={tt('children')}
          value={childrenLoading ? '—' : childCount.toString()}
          icon={<Heart size={18} />}
          variant="success"
          isLoading={childrenLoading}
        />
        <KPICard
          label={tt('highRisk')}
          value={childrenLoading ? '—' : highRiskCount.toString()}
          icon={<AlertTriangle size={18} />}
          variant={highRiskCount > 0 ? 'danger' : 'default'}
          subtext={highRiskCount > 0 ? tt('needsAttention') : tt('allClear')}
          isLoading={childrenLoading}
        />
        <KPICard
          label={tt('alerts')}
          value={notifLoading ? '—' : unreadCount.toString()}
          icon={<Bell size={18} />}
          variant={unreadCount > 0 ? 'warn' : 'default'}
          subtext={unreadCount === 0 ? tt('allRead') : tt('unread')}
          isLoading={notifLoading}
        />
      </div>

      {/* High-risk alert banner */}
      {highRiskCount > 0 && (
        <Alert variant="danger" title={tt('childrenNeedAttention', { count: highRiskCount })}>
          {tt.rich('contactChwOrRequest', {
            link: (chunks) => <Link href="/parent/request-visit" className="underline font-medium">{chunks}</Link>,
          })}
        </Alert>
      )}

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>{tt('quickActions')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/parent/vaccines',       icon: Syringe,      label: tt('vaccineCard'),    desc: tt('viewAllScheduledDoses') },
            { href: '/parent/request-visit',  icon: Calendar,     label: tt('requestAVisit2'), desc: tt('askYourChwTo') },
            { href: '/parent/notifications',  icon: Bell,         label: tt('notifications'),   desc: tt('unreadMessages', { count: unreadCount }) },
            { href: '/parent/consent',        icon: UserCheck,    label: tt('consentData'),  desc: tt('manageYourPrivacySettings') },
          ].map(({ href, icon: Icon, label, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-start gap-3 p-4 rounded-2xl border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
              >
                <Icon size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Children section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{tt('yourChildren')}</h3>
          {childCount > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{tt('registered', { childCount: childCount })}</span>
          )}
        </div>

        {childrenLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : children.length === 0 ? (
          <EmptyState
            icon={<Heart size={28} />}
            title={tt('noChildrenLinkedYet')}
            description={tt('askYourCommunityHealth')}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {children.map((child) => (
              <ChildCard key={child.id} child={child} onShowQR={setQrChild} />
            ))}
          </div>
        )}
      </section>

      {/* Help banner */}
      <div
        className="flex items-center gap-4 px-4 py-4 rounded-2xl border"
        style={{ background: 'var(--bg-elev)', borderColor: 'var(--border)' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}
        >
          <MessageSquare size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{tt('needHelp')}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tt('yourCommunityHealthWorker')}</p>
        </div>
        <Link
          href="/parent/request-visit"
          className="text-xs font-medium px-3 py-1.5 rounded-xl border shrink-0 transition-colors hover:bg-[var(--bg-sand)]"
          style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
        >{tt('contactChw')}</Link>
      </div>

      {/* Notifications */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{tt('notifications')}{unreadCount > 0 && (
              <span
                className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--warn)', color: 'white' }}
              >
                {unreadCount}
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              <CheckCheck size={13} />{' '}{tt('markAllRead')}</button>
          )}
        </div>

        {notifLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : notifs.length === 0 ? (
          <EmptyState
            icon={<BellOff size={24} />}
            title={tt('noNotifications')}
            description={tt('upcomingVaccinationRemindersAnd')}
          />
        ) : (
          <>
            <div className="rounded-2xl border overflow-hidden divide-y" style={{ borderColor: 'var(--border)' }}>
              {notifs.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3.5 transition-colors"
                  style={{ backgroundColor: n.is_read ? 'var(--bg)' : 'var(--bg-elev)' }}
                >
                  <span className="shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--bg-sand)' }}>
                    <NotifIcon type={n.notification_type} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--ink)' }}>
                      {n.notification_type_display}
                      {n.child_name && (
                        <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                          {' '}· {n.child_name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {n.message}
                    </p>
                  </div>
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => handleMarkOneRead(n.id)}
                      className="shrink-0 text-xs px-2 py-1 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
                      style={{ color: 'var(--text-muted)' }}
                    >{tt('dismiss')}</button>
                  )}
                </div>
              ))}
            </div>
            {notifs.length > 10 && (
              <Link
                href="/parent/notifications"
                className="block text-center text-xs mt-2 py-2 rounded-xl transition-colors hover:bg-[var(--bg-sand)]"
                style={{ color: 'var(--text-muted)' }}
              >{tt('viewAllNotifications', { length: notifs.length })}</Link>
            )}
          </>
        )}
      </section>
    </div>

      {/* QR overlay — shown when parent taps the QR button on a child card */}
      {qrChild && <QROverlay target={qrChild} onClose={() => setQrChild(null)} />}
    </>
  );
}
