'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, Bell } from 'lucide-react';
import { getMe, patchMe } from '@/lib/api/user';

interface NotifPrefs {
  sms_high_risk: boolean;
  sms_vaccination: boolean;
  sms_visit_accepted: boolean;
  sms_visit_declined: boolean;
  sms_visit_completed: boolean;
  push_high_risk: boolean;
  push_vaccination: boolean;
  push_visit_accepted: boolean;
  push_visit_declined: boolean;
  push_visit_completed: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_enabled: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  sms_high_risk: true,
  sms_vaccination: true,
  sms_visit_accepted: true,
  sms_visit_declined: true,
  sms_visit_completed: true,
  push_high_risk: true,
  push_vaccination: true,
  push_visit_accepted: true,
  push_visit_declined: true,
  push_visit_completed: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '07:00',
  quiet_hours_enabled: false,
};

const CATEGORIES: { key: keyof Omit<NotifPrefs, 'quiet_hours_start' | 'quiet_hours_end' | 'quiet_hours_enabled'>; label: string; description: string; smsKey: string; pushKey: string }[] = [
  { key: 'sms_high_risk', smsKey: 'sms_high_risk', pushKey: 'push_high_risk', label: 'High risk alerts', description: 'When your child is classified as high risk' },
  { key: 'sms_vaccination', smsKey: 'sms_vaccination', pushKey: 'push_vaccination', label: 'Vaccination reminders', description: 'Upcoming and overdue vaccination notices' },
  { key: 'sms_visit_accepted', smsKey: 'sms_visit_accepted', pushKey: 'push_visit_accepted', label: 'Visit accepted', description: 'When a CHW accepts your visit request' },
  { key: 'sms_visit_declined', smsKey: 'sms_visit_declined', pushKey: 'push_visit_declined', label: 'Visit declined', description: 'When a CHW declines your visit request' },
  { key: 'sms_visit_completed', smsKey: 'sms_visit_completed', pushKey: 'push_visit_completed', label: 'Visit completed', description: 'When a home visit is marked as done' },
];

export default function NotificationPreferencesPage() {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = (me as unknown as { notification_prefs?: Partial<NotifPrefs> } | undefined);
    if (raw?.notification_prefs) {
      setPrefs({ ...DEFAULT_PREFS, ...raw.notification_prefs });
    }
  }, [me]);

  const mutation = useMutation({
    mutationFn: (p: NotifPrefs) => patchMe({ notification_prefs: p as unknown as Record<string, unknown> }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function toggle(key: keyof NotifPrefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Bell className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Preferences</h1>
          <p className="text-sm text-gray-500">Choose what you are notified about and how.</p>
        </div>
      </div>

      {/* Category toggles */}
      <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
        {/* Header */}
        <div className="grid grid-cols-[1fr_60px_60px] gap-2 px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <span>Alert type</span>
          <span className="text-center">SMS</span>
          <span className="text-center">Push</span>
        </div>

        {CATEGORIES.map(({ label, description, smsKey, pushKey }) => (
          <div key={smsKey} className="grid grid-cols-[1fr_60px_60px] gap-2 items-center px-4 py-3.5 bg-white">
            <div>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
            <div className="flex justify-center">
              <Toggle
                checked={prefs[smsKey as keyof NotifPrefs] as boolean}
                onChange={() => toggle(smsKey as keyof NotifPrefs)}
              />
            </div>
            <div className="flex justify-center">
              <Toggle
                checked={prefs[pushKey as keyof NotifPrefs] as boolean}
                onChange={() => toggle(pushKey as keyof NotifPrefs)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Quiet hours */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">Quiet hours</p>
            <p className="text-xs text-gray-500">Suppress non-urgent notifications during these hours</p>
          </div>
          <Toggle
            checked={prefs.quiet_hours_enabled}
            onChange={() => toggle('quiet_hours_enabled')}
          />
        </div>

        {prefs.quiet_hours_enabled && (
          <div className="flex items-center gap-4">
            <label className="flex-1">
              <span className="block text-xs text-gray-500 mb-1">From</span>
              <input
                type="time"
                value={prefs.quiet_hours_start}
                onChange={(e) => setPrefs((p) => ({ ...p, quiet_hours_start: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex-1">
              <span className="block text-xs text-gray-500 mb-1">Until</span>
              <input
                type="time"
                value={prefs.quiet_hours_end}
                onChange={(e) => setPrefs((p) => ({ ...p, quiet_hours_end: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </label>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => mutation.mutate(prefs)}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save preferences
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
