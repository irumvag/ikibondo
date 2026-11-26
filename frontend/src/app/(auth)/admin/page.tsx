'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import {
  Users, MapPin, ScrollText, Cpu, Baby,
  AlertTriangle, Shield, Activity, Syringe, UserCheck,
  TrendingUp, MessageSquare, GitMerge, ClipboardList,
  Building2, Home, Globe, Megaphone, HelpCircle, BarChart3, Target,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useAuthStore } from '@/store/authStore';
import { KPICard } from '@/components/ui/KPICard';
import { Alert } from '@/components/ui/Alert';
import { useLandingStats, usePendingApprovals } from '@/lib/api/queries';
import {
  BarChart, Bar, CartesianGrid, Legend, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

type ColumnsT = ReturnType<typeof useTranslations<'admin.home'>>;

// Grouped so the newer areas (organisations, statistics, website & app text) are easy to find
const SECTIONS = (t: ColumnsT): { title: string; links: { href: string; icon: typeof Users; label: string; desc: string }[] }[] => [
  { title: t('people'), links: [
    { href: '/admin/users',         icon: Users,         label: t('usersRoles'),     desc: t('staffAccountsExtraRolesPendingRegistrations') },
    { href: '/admin/organizations', icon: Building2,     label: t('organisations'),     desc: t('ministriesAndNgoUnPartnersAndTheCampsTheySee') },
    { href: '/admin/camps',         icon: MapPin,        label: t('campsZones'),     desc: t('campsZonesAndChwAssignments') },
    { href: '/admin/guardians',     icon: UserCheck,     label: t('chwAssignments'),   desc: t('whichChwVisitsWhichFamily') },
  ] },
  { title: t('childrenCare'), links: [
    { href: '/admin/children',       icon: Baby,          label: t('allChildren'),      desc: t('searchCloseOrTransferChildrenAcrossCamps') },
    { href: '/admin/health-records', icon: ClipboardList, label: t('healthRecords'),    desc: t('everyMeasurementWithWhoZScores') },
    { href: '/admin/vaccinations',   icon: Syringe,       label: t('vaccinations'),      desc: t('vaccinationRecordsAcrossCamps') },
    { href: '/admin/referrals',      icon: GitMerge,      label: t('referrals'),         desc: t('openAndCompletedReferrals') },
    { href: '/admin/visit-requests', icon: Home,          label: t('visitRequests'),    desc: t('homeVisitsParentsAskedFor') },
    { href: '/admin/consultations',  icon: MessageSquare, label: t('consultations'),     desc: t('chwAndNurseThreads') },
  ] },
  { title: t('websiteMobileApp'), links: [
    { href: '/admin/site-content',  icon: Globe,     label: t('siteAppText'),   desc: t('homePageAboutAndTheAppsParentHomeCertificateFeedingAndCareGuides') },
    { href: '/admin/announcements', icon: Megaphone, label: t('announcements'),     desc: t('bannersOnTheWebsiteAndOnEveryAppHomeScreen') },
    { href: '/admin/faq',           icon: HelpCircle, label: 'FAQ',              desc: t('questionsOnThePublicWebsite') },
  ] },
  { title: t('oversightSystem'), links: [
    { href: '/insights',      icon: BarChart3,  label: t('statistics'),     desc: t('theViewGovernmentAndPartnersSeeWithCsvReports') },
    { href: '/admin/indicators', icon: Target,  label: t('indicators'),     desc: t('namesTargetsAndExplanationsOfTheStatisticsIndicators') },
    { href: '/admin/ml',      icon: Cpu,        label: t('riskModel'),     desc: t('modelVersionsAccuracyAndStatus') },
    { href: '/admin/audit',   icon: ScrollText, label: t('auditLog'),      desc: t('whoDidWhatAndModelPredictions') },
  ] },
];

const RISK = (t: ColumnsT): { key: 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_MEASURED'; label: string; color: string }[] => [
  { key: 'HIGH', label: t('riskHighRisk'), color: 'var(--danger)' },
  { key: 'MEDIUM', label: t('riskMedium'), color: 'var(--warn)' },
  { key: 'LOW', label: t('riskLow'), color: 'var(--success)' },
  { key: 'NOT_MEASURED', label: t('riskNotMeasuredYet'), color: 'var(--rule)' },
];
const NUTRITION = (t: ColumnsT): { key: 'SAM' | 'MAM' | 'NORMAL' | 'NOT_MEASURED'; label: string; color: string }[] => [
  { key: 'SAM', label: t('nutritionSevereSam'), color: 'var(--muac-red)' },
  { key: 'MAM', label: t('nutritionModerateMam'), color: 'var(--muac-yellow)' },
  { key: 'NORMAL', label: t('nutritionNormal'), color: 'var(--muac-green)' },
  { key: 'NOT_MEASURED', label: t('nutritionNotMeasuredYet'), color: 'var(--rule)' },
];

const card = { borderColor: 'var(--border)', backgroundColor: 'var(--bg-elev)', boxShadow: 'var(--shadow-md)' };

export default function AdminDashboard() {
  const t = useTranslations('admin.home');
  const user = useAuthStore((s) => s.user);
  const { data: stats, isLoading: statsLoading } = useLandingStats();
  const { data: pending, isLoading: pendingLoading } = usePendingApprovals();
  const [view, setView] = useState<'risk' | 'nutrition'>('risk');

  const pendingCount = pending?.length ?? 0;
  const highRisk = stats?.high_risk_30d ?? 0;
  const bands = view === 'risk' ? RISK(t) : NUTRITION(t);
  const counts = (view === 'risk' ? stats?.children_by_risk : stats?.children_by_nutrition) as Record<string, number> | undefined;
  const totalKids = stats?.total_children ?? 0;
  const trend = (stats?.trend ?? []).map((m) => ({
    month: new Date(`${m.month}-01`).toLocaleDateString(undefined, { month: 'short' }),
    'Children seen': m.children_seen,
    MAM: m.mam,
    SAM: m.sam,
  }));
  const n = (v: number | undefined) => (stats ? (v ?? 0).toLocaleString() : '—');

  return (
    <div className="flex flex-col gap-6">
      {/* Header, as on the phone */}
      <div
        className="rounded-2xl p-6 flex flex-wrap items-center gap-5"
        style={{ background: 'linear-gradient(135deg, var(--ink), var(--sky))', boxShadow: 'var(--shadow-md)' }}
      >
        <span className="rounded-2xl p-1" style={{ backgroundColor: 'rgba(255,255,255,.9)' }}>
          <Logo size={48} name={false} />
        </span>
        <div className="flex-1 min-w-[14rem]">
          <h2 className="text-2xl font-bold text-white">{t('welcomeBackName', { name: user?.full_name?.split(' ')[0] ?? t('administrator') })}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,.88)' }}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            {stats && t('statsSummary', { camps: stats.total_camps, children: stats.total_children, orgs: stats.organizations ?? 0 })}
          </p>
        </div>
        <Link href="/insights" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: 'rgba(255,255,255,.95)', color: 'var(--ink)' }}>
          <BarChart3 size={16} aria-hidden="true" />{' '}{t('statisticsReports')}</Link>
      </div>

      {/* Alerts */}
      {(pendingCount > 0 || highRisk > 0) && (
        <div className="flex flex-col gap-3">
          {pendingCount > 0 && (
            <Alert variant="warn" title={t('usersAwaiting', { count: pendingCount })}>
              <Link href="/admin/users?status=pending" className="underline font-medium">{t('reviewPendingApprovals')}</Link>
            </Alert>
          )}
          {highRisk > 0 && (
            <Alert variant="danger" title={`${highRisk} high-risk check-ups in the last 30 days`}>
              <Link href="/admin/health-records?risk=HIGH" className="underline font-medium">{t('viewHighRiskRecords')}</Link>
            </Alert>
          )}
        </div>
      )}

      {/* Figures */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link href="/admin/children"><KPICard label={t('childrenRegistered')} value={n(stats?.total_children)} icon={<Baby size={18} />} subtext={(stats ? t('inCamps', { count: stats.total_camps }) : '—')} isLoading={statsLoading} /></Link>
        <Link href="/admin/users?role=CHW"><KPICard label={t('activeChws')} value={n(stats?.total_chws_active)} icon={<Activity size={18} />} variant="success" subtext={t('withAnActiveAccount')} isLoading={statsLoading} /></Link>
        <Link href="/admin/health-records?risk=HIGH"><KPICard label={t('highRiskCheckUps')} value={n(highRisk)} icon={<AlertTriangle size={18} />} variant="danger" subtext={t('last30Days')} isLoading={statsLoading} /></Link>
        <Link href="/admin/users?status=pending"><KPICard label={t('pendingApprovals')} value={pendingLoading ? '—' : pendingCount.toString()} icon={<Shield size={18} />} variant={pendingCount > 0 ? 'warn' : 'default'} subtext={pendingCount > 0 ? t('needsReview') : t('allClear')} isLoading={pendingLoading} /></Link>
        <Link href="/admin/vaccinations"><KPICard label={t('vaccinationCoverage')} value={stats ? `${stats.vaccination_coverage_pct}%` : '—'} icon={<Syringe size={18} />} variant="success" subtext={t('dosesGivenOfDoses')} isLoading={statsLoading} /></Link>
        <Link href="/admin/health-records"><KPICard label={t('checkUps')} value={n(stats?.visits_30d)} icon={<ClipboardList size={18} />} subtext={t('last30Days')} isLoading={statsLoading} /></Link>
        <Link href="/admin/referrals"><KPICard label={t('openReferrals')} value={n(stats?.referrals_open)} icon={<GitMerge size={18} />} variant={(stats?.referrals_open ?? 0) > 0 ? 'warn' : 'default'} subtext={t('waitingForTheFacility')} isLoading={statsLoading} /></Link>
        <Link href="/admin/visit-requests"><KPICard label={t('visitRequests')} value={n(stats?.visit_requests_open)} icon={<Home size={18} />} subtext={t('openFromParents')} isLoading={statsLoading} /></Link>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Children's status: one stacked bar plus legend with counts */}
        <section className="lg:col-span-2 rounded-2xl border p-5" style={card} aria-labelledby="status-h">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 id="status-h" className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('childrenSStatus')}</h3>
            <div className="flex rounded-full p-0.5" style={{ backgroundColor: 'var(--bg-sand)' }} role="group" aria-label={t('show')}>
              {(['risk', 'nutrition'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                  className="px-3 h-7 rounded-full text-xs font-semibold transition-colors"
                  style={view === v ? { backgroundColor: 'var(--ink)', color: 'var(--bg-elev)' } : { color: 'var(--ink)' }}>
                  {v === 'risk' ? t('risk') : t('nutrition')}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t('byEachChildS')}</p>
          <div className="flex h-4 rounded-full overflow-hidden mb-4" style={{ backgroundColor: 'var(--bg-sand)' }}>
            {totalKids > 0 && bands.map((b) => (
              <div key={b.key} style={{ width: `${((counts?.[b.key] ?? 0) / totalKids) * 100}%`, backgroundColor: b.color }}
                title={`${b.label}: ${counts?.[b.key] ?? 0}`} />
            ))}
          </div>
          <ul className="flex flex-col gap-2.5">
            {bands.map((b) => (
              <li key={b.key} className="flex items-center gap-3 text-sm">
                <span className="w-3 h-3 rounded" style={{ backgroundColor: b.color }} aria-hidden="true" />
                <span className="flex-1" style={{ color: 'var(--text)' }}>{b.label}</span>
                <span className="font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>{counts?.[b.key] ?? 0}</span>
                <span className="w-12 text-right text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {totalKids ? `${Math.round(((counts?.[b.key] ?? 0) / totalKids) * 100)}%` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 12-month trend */}
        <section className="lg:col-span-3 rounded-2xl border p-5" style={card} aria-labelledby="trend-h">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} style={{ color: 'var(--ink)' }} aria-hidden="true" />
            <h3 id="trend-h" className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('last12Months')}</h3>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t('childrenMeasuredEachMonth')}</p>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} cursor={{ fill: 'var(--bg-sand)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Children seen" fill="var(--ink)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="MAM" fill="var(--muac-yellow)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="SAM" fill="var(--muac-red)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* By camp */}
      {(stats?.camp_stats?.length ?? 0) > 0 && (
        <section className="rounded-2xl border overflow-x-auto" style={card}>
          <table className="w-full text-sm">
            <caption className="text-left px-5 pt-4 pb-2 text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('byCamp')}</caption>
            <thead>
              <tr className="text-left text-xs border-b" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                <th scope="col" className="px-5 py-2 font-semibold">{t('camp')}</th>
                <th scope="col" className="px-5 py-2 font-semibold text-right">{t('children')}</th>
                <th scope="col" className="px-5 py-2 font-semibold text-right">{t('everHighRisk')}</th>
                <th scope="col" className="px-5 py-2 font-semibold w-1/3"><span className="sr-only">{t('share')}</span></th>
              </tr>
            </thead>
            <tbody>
              {[...(stats?.camp_stats ?? [])].sort((a, b) => b.total_children - a.total_children).map((c) => (
                <tr key={c.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                  <th scope="row" className="px-5 py-2.5 text-left font-semibold" style={{ color: 'var(--ink)' }}>{c.name}</th>
                  <td className="px-5 py-2.5 text-right tabular-nums">{c.total_children}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums" style={{ color: c.high_risk ? 'var(--danger)' : undefined }}>{c.high_risk}</td>
                  <td className="px-5 py-2.5">
                    <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--bg-sand)' }}>
                      <div className="h-2 rounded-full" style={{ width: `${totalKids ? (c.total_children / totalKids) * 100 : 0}%`, backgroundColor: 'var(--ink)' }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Admin sections, grouped */}
      {SECTIONS(t).map((sec) => (
        <section key={sec.title} aria-labelledby={`sec-${sec.title}`}>
          <h3 id={`sec-${sec.title}`} className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>{sec.title}</h3>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {sec.links.map(({ href, icon: Icon, label, desc }) => (
              <Link key={href} href={href}
                className="flex items-start gap-3.5 p-4 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)]"
                style={card}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-sand)', color: 'var(--ink)' }}>
                  <Icon size={19} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{label}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
