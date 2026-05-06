'use client';

import { useState, useEffect } from 'react';
import { Bluetooth, BluetoothOff, Plus, Trash2, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface PairedDevice {
  id: string;          // BLE device ID or manual ID
  name: string;
  type: 'weight_scale' | 'muac_tape' | 'thermometer' | 'pulse_oximeter' | 'other';
  connectedAt: string; // ISO
  isManual: boolean;
}

const DEVICE_TYPES: { value: PairedDevice['type']; label: string }[] = [
  { value: 'weight_scale',   label: 'Weight Scale' },
  { value: 'muac_tape',      label: 'MUAC Tape' },
  { value: 'thermometer',    label: 'Thermometer' },
  { value: 'pulse_oximeter', label: 'Pulse Oximeter' },
  { value: 'other',          label: 'Other' },
];

const STORAGE_KEY = 'ikibondo.ble_devices';

function loadDevices(): PairedDevice[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveDevices(devices: PairedDevice[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: { acceptAllDevices: boolean; optionalServices?: string[] }): Promise<{
        id: string;
        name?: string;
      }>;
    };
  }
}

export default function BLEDevicesPage() {
  const [devices, setDevices]       = useState<PairedDevice[]>([]);
  const [bleSupported, setBleSupported] = useState(false);
  const [scanning, setScanning]     = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualId, setManualId]     = useState('');
  const [manualName, setManualName] = useState('');
  const [manualType, setManualType] = useState<PairedDevice['type']>('weight_scale');
  const [error, setError]           = useState('');

  useEffect(() => {
    setDevices(loadDevices());
    setBleSupported(typeof navigator !== 'undefined' && !!navigator.bluetooth);
  }, []);

  async function handleBleScan() {
    if (!navigator.bluetooth) return;
    setScanning(true);
    setError('');
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service', 'health_thermometer', 'weight_scale'],
      });
      const newDev: PairedDevice = {
        id: device.id,
        name: device.name ?? device.id,
        type: 'other',
        connectedAt: new Date().toISOString(),
        isManual: false,
      };
      const updated = [newDev, ...devices.filter((d) => d.id !== device.id)];
      setDevices(updated);
      saveDevices(updated);
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'NotFoundError') {
        setError((e as Error)?.message ?? 'Bluetooth scan failed.');
      }
    } finally {
      setScanning(false);
    }
  }

  function addManual() {
    if (!manualId.trim() || !manualName.trim()) return;
    const newDev: PairedDevice = {
      id: manualId.trim(),
      name: manualName.trim(),
      type: manualType,
      connectedAt: new Date().toISOString(),
      isManual: true,
    };
    const updated = [newDev, ...devices.filter((d) => d.id !== newDev.id)];
    setDevices(updated);
    saveDevices(updated);
    setShowManual(false);
    setManualId('');
    setManualName('');
    setManualType('weight_scale');
  }

  function removeDevice(id: string) {
    const updated = devices.filter((d) => d.id !== id);
    setDevices(updated);
    saveDevices(updated);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Bluetooth size={20} style={{ color: 'var(--primary)' }} />
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}>
            BLE Devices
          </h2>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Pair Bluetooth sensor devices for automatic vital sign capture during visits.
        </p>
      </div>

      {/* BLE support banner */}
      {!bleSupported && (
        <div
          className="rounded-xl border px-4 py-3 flex items-start gap-3"
          style={{ borderColor: 'var(--warn)', background: '#fffbeb' }}
        >
          <BluetoothOff size={18} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--warn)' }}>
              Web Bluetooth not supported
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Your browser does not support Web Bluetooth API. Use Chrome or Edge on Android/desktop to scan
              devices automatically, or add devices manually using the button below.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {bleSupported && (
          <Button onClick={handleBleScan} disabled={scanning}>
            {scanning ? (
              <><Wifi size={16} className="mr-1 animate-pulse" /> Scanning…</>
            ) : (
              <><Bluetooth size={16} className="mr-1" /> Scan for Devices</>
            )}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setShowManual(!showManual)}>
          <Plus size={16} className="mr-1" /> Add Manually
        </Button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fef2f2', color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {/* Manual entry form */}
      {showManual && (
        <div
          className="rounded-xl border p-4 flex flex-col gap-3"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Add Device Manually</h3>
          <Input
            placeholder="Device ID (from device label or app)"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <Input
            placeholder="Device name (e.g. SECA mBCA 525)"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
          />
          <select
            value={manualType}
            onChange={(e) => setManualType(e.target.value as PairedDevice['type'])}
            className="w-full rounded-lg px-3 py-2 text-sm border"
            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--ink)' }}
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowManual(false)}>Cancel</Button>
            <Button onClick={addManual} disabled={!manualId.trim() || !manualName.trim()}>Save Device</Button>
          </div>
        </div>
      )}

      {/* Paired devices list */}
      {devices.length === 0 ? (
        <div
          className="rounded-xl border p-8 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <WifiOff size={32} style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium text-sm" style={{ color: 'var(--ink)' }}>No devices paired yet</p>
          <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
            Pair a BLE sensor to automatically populate measurements during a visit.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {devices.map((dev) => (
            <div
              key={dev.id}
              className="rounded-xl border p-4 flex items-center gap-3"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg)' }}
              >
                <Bluetooth size={20} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{dev.name}</span>
                  <Badge variant="info">
                    {DEVICE_TYPES.find((t) => t.value === dev.type)?.label ?? 'Other'}
                  </Badge>
                  {dev.isManual && (
                    <Badge variant="warn">Manual</Badge>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  ID: {dev.id} · Paired {new Date(dev.connectedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                <button
                  onClick={() => removeDevice(dev.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  title="Remove device"
                >
                  <Trash2 size={15} style={{ color: 'var(--danger)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div
        className="rounded-xl border p-4 flex flex-col gap-2"
        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
      >
        <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>How device pairing works</p>
        <ul className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
          <li>1. Enable Bluetooth on your phone and switch on the sensor device.</li>
          <li>2. Tap <strong>Scan for Devices</strong> and select your device from the list.</li>
          <li>3. During a visit, the app will automatically read measurements from the sensor.</li>
          <li>4. If BLE is unavailable, enter readings manually — the pairing list is still used for matching.</li>
        </ul>
      </div>
    </div>
  );
}
