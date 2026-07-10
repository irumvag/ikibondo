import { describe, expect, it } from 'vitest';
import {
  buildVaccinationCertificateHtml,
  type CertificateChild,
} from './vaccinationCertificate';
import type { VaccinationRecord } from '@/lib/api/parent';

const child: CertificateChild = {
  full_name: 'Keza Niyonzima',
  registration_number: 'IKB-CAM-2026-0001',
  date_of_birth: '2024-01-15',
  sex: 'F',
  age_display: '2y 5m',
  camp_name: 'Mahama',
  zone_name: 'Zone A',
  guardian_name: 'Alice Uwase',
};

function record(over: Partial<VaccinationRecord> = {}): VaccinationRecord {
  return {
    id: 'v-1',
    child: 'c-1',
    child_name: child.full_name,
    zone_name: 'Zone A',
    guardian_name: 'Alice Uwase',
    guardian_phone: null,
    vaccine: 'vac-1',
    vaccine_name: 'BCG',
    vaccine_code: 'BCG',
    scheduled_date: '2024-01-20',
    administered_date: '2024-01-21',
    administered_by_name: 'Nurse Rojas',
    status: 'DONE',
    batch_number: 'B-42',
    notes: '',
    dropout_probability: null,
    dropout_risk_tier: null,
    is_overdue: false,
    ...over,
  };
}

describe('buildVaccinationCertificateHtml', () => {
  it('includes child identity, guardian, and camp', () => {
    const html = buildVaccinationCertificateHtml(child, [record()]);
    expect(html).toContain('Keza Niyonzima');
    expect(html).toContain('IKB-CAM-2026-0001');
    expect(html).toContain('Alice Uwase');
    expect(html).toContain('Mahama');
  });

  it('lists each dose with vaccine name, batch, and administrator', () => {
    const html = buildVaccinationCertificateHtml(child, [
      record(),
      record({ id: 'v-2', vaccine_name: 'Polio (OPV)', status: 'SCHEDULED', administered_date: null }),
    ]);
    expect(html).toContain('BCG');
    expect(html).toContain('Polio (OPV)');
    expect(html).toContain('B-42');
    expect(html).toContain('Nurse Rojas');
  });

  it('computes coverage from DONE doses', () => {
    const html = buildVaccinationCertificateHtml(child, [
      record(),
      record({ id: 'v-2', status: 'SCHEDULED', administered_date: null }),
    ]);
    // 1 of 2 done → 50%
    expect(html).toContain('50%');
  });

  it('escapes HTML in data-derived values (XSS guard)', () => {
    const html = buildVaccinationCertificateHtml(
      { ...child, full_name: '<script>alert(1)</script>' },
      [record({ vaccine_name: 'BCG "special" <b>' })],
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;special&quot;');
  });

  it('shows an empty-state row when there are no records', () => {
    const html = buildVaccinationCertificateHtml(child, []);
    expect(html).toContain('No vaccination records on file');
  });
});
