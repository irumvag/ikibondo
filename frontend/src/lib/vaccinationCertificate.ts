import type { VaccinationRecord } from '@/lib/api/parent';

/**
 * Generates an official, printable "Certificate of Vaccination" for a child and
 * opens it in a new window that auto-prints (Save-as-PDF also works from the
 * browser print dialog). Mirrors the QR-card print pattern already used in the
 * app: a fully self-contained HTML document, independent of the app theme, so
 * it renders cleanly on paper.
 */

export interface CertificateChild {
  full_name: string;
  registration_number: string;
  date_of_birth?: string | null;
  sex: 'M' | 'F' | string;
  age_display?: string | null;
  camp_name?: string | null;
  zone_name?: string | null;
  guardian_name?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  DONE: 'Administered',
  SCHEDULED: 'Scheduled',
  MISSED: 'Missed',
  SKIPPED: 'Skipped',
};

/** Escape user/data-derived values before interpolating into the HTML document. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Format an ISO date (YYYY-MM-DD) as e.g. "05 Jul 2026"; blank/invalid → "—". */
function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return esc(value);
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function buildVaccinationCertificateHtml(
  child: CertificateChild,
  records: VaccinationRecord[],
): string {
  const now = new Date();
  const issued = now.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const total = records.length;
  const done = records.filter((r) => r.status === 'DONE').length;
  const coverage = total > 0 ? Math.round((done / total) * 100) : 0;

  // Chronological order: administered date if present, otherwise scheduled date.
  const sorted = [...records].sort((a, b) => {
    const da = a.administered_date ?? a.scheduled_date ?? '';
    const db = b.administered_date ?? b.scheduled_date ?? '';
    return da.localeCompare(db);
  });

  const rows =
    sorted.length === 0
      ? `<tr><td colspan="8" class="empty">No vaccination records on file.</td></tr>`
      : sorted
          .map(
            (r, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="vaccine">${esc(r.vaccine_name)}</td>
        <td class="mono">${esc(r.vaccine_code)}</td>
        <td>${fmtDate(r.scheduled_date)}</td>
        <td>${fmtDate(r.administered_date)}</td>
        <td><span class="st st-${esc(r.status)}">${STATUS_LABEL[r.status] ?? esc(r.status)}</span></td>
        <td class="mono">${esc(r.batch_number ?? '—')}</td>
        <td>${esc(r.administered_by_name ?? '—')}</td>
      </tr>`,
          )
          .join('');

  const sexLabel =
    child.sex === 'M' ? 'Male' : child.sex === 'F' ? 'Female' : esc(child.sex);

  const identity = [
    ['Registration No.', esc(child.registration_number)],
    ['Date of birth', fmtDate(child.date_of_birth)],
    ['Sex', sexLabel],
    ['Age', esc(child.age_display ?? '—')],
    ['Camp', esc(child.camp_name ?? '—')],
    ['Zone', esc(child.zone_name ?? '—')],
    ['Parent / Guardian', esc(child.guardian_name ?? '—')],
  ]
    .map(
      ([label, val]) =>
        `<div class="field"><span class="label">${label}</span><span class="val">${val}</span></div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Vaccination Certificate — ${esc(child.full_name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif; color: #111827; background: #f3f4f6;
      margin: 0; padding: 24px; -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .sheet {
      max-width: 820px; margin: 0 auto; background: #fff; padding: 40px 44px;
      border: 1px solid #e5e7eb; border-radius: 8px;
    }
    .toolbar { max-width: 820px; margin: 0 auto 16px; display: flex; justify-content: flex-end; }
    .print-btn {
      font: inherit; font-weight: 600; cursor: pointer; border: 1px solid #111827;
      background: #111827; color: #fff; padding: 8px 16px; border-radius: 8px;
    }
    header { display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 20px; }
    .org { font-size: 12px; color: #6b7280; letter-spacing: .04em; text-transform: uppercase; }
    .brand { font-size: 22px; font-weight: 800; letter-spacing: -.01em; margin: 2px 0 0; }
    h1 { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
      text-align: right; margin: 0; color: #111827; }
    .subtitle { text-align: right; font-size: 11px; color: #6b7280; margin-top: 4px; }
    .name { font-size: 20px; font-weight: 700; margin: 0 0 12px; }
    .identity { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 32px; margin-bottom: 22px; }
    .field { display: flex; justify-content: space-between; font-size: 13px;
      border-bottom: 1px dotted #e5e7eb; padding: 4px 0; }
    .label { color: #6b7280; }
    .val { font-weight: 600; text-align: right; }
    .summary { display: flex; gap: 24px; background: #f9fafb; border: 1px solid #e5e7eb;
      border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
    .summary b { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { text-align: left; background: #111827; color: #fff; padding: 8px 10px;
      font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
    tbody td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    .num { color: #9ca3af; width: 24px; }
    .vaccine { font-weight: 600; }
    .mono { font-family: "Courier New", monospace; font-size: 11px; }
    .empty { text-align: center; color: #9ca3af; padding: 24px; }
    .st { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .st-DONE { background: #dcfce7; color: #166534; }
    .st-SCHEDULED { background: #e5e7eb; color: #374151; }
    .st-MISSED { background: #fee2e2; color: #991b1b; }
    .st-SKIPPED { background: #f3f4f6; color: #6b7280; }
    footer { margin-top: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
    .issued { font-size: 11px; color: #6b7280; max-width: 60%; }
    .sign { text-align: center; font-size: 11px; color: #6b7280; }
    .sign .line { width: 200px; border-top: 1px solid #111827; margin-bottom: 4px; }
    @page { margin: 14mm; }
    @media print {
      body { background: #fff; padding: 0; }
      .sheet { border: none; border-radius: 0; padding: 0; max-width: none; }
      .toolbar { display: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet">
    <header>
      <div>
        <div class="org">Ikibondo · Child Nutrition Monitoring Platform</div>
        <div class="brand">Ikibondo</div>
      </div>
      <div>
        <h1>Certificate of Vaccination</h1>
        <div class="subtitle">Official Immunization Record</div>
      </div>
    </header>

    <p class="name">${esc(child.full_name)}</p>
    <div class="identity">${identity}</div>

    <div class="summary">
      <div><b>${done}</b> of <b>${total}</b> doses administered</div>
      <div><b>${coverage}%</b> immunization coverage</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Vaccine</th>
          <th>Code</th>
          <th>Scheduled</th>
          <th>Date administered</th>
          <th>Status</th>
          <th>Batch no.</th>
          <th>Administered by</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <footer>
      <div class="issued">
        Issued: ${esc(issued)}.<br />
        Computer-generated immunization record from the Ikibondo platform.
        Not valid without the official stamp and signature of the issuing health facility.
      </div>
      <div class="sign">
        <div class="line"></div>
        Health facility stamp &amp; signature
      </div>
    </footer>
  </div>
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
</body>
</html>`;
}

/**
 * Opens the certificate in a new window and triggers printing.
 * Returns false if the popup was blocked so callers can surface a message.
 */
export function printVaccinationCertificate(
  child: CertificateChild,
  records: VaccinationRecord[],
): boolean {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.write(buildVaccinationCertificateHtml(child, records));
  w.document.close();
  return true;
}
