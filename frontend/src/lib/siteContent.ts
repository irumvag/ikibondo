/**
 * Public-site text that an admin can edit (Admin → Site content).
 *
 * DEFAULTS holds the built-in text for every section. The API stores only what an
 * admin changed (per language); pages merge those changes over the defaults, so an
 * empty database shows exactly the text below. FIELDS describes each section's form
 * in the admin editor.
 */

export type Lang = 'en' | 'fr' | 'rw';

export interface Step { title: string; description: string }
export interface RoleItem { role: string; description: string; features: string }
export interface Principle { title: string; body: string }

export interface SiteContent {
  'home.hero': { title: string; body: string; primary_cta: string; secondary_cta: string; note: string };
  'home.how_it_works': { title: string; subtitle: string; steps: Step[] };
  'home.roles': { title: string; roles: RoleItem[] };
  'home.muac': { title: string; body: string };
  about: { title: string; intro_1: string; intro_2: string; principles_title: string; principles: Principle[]; closing: string };
  footer: { tagline: string };
  contact: { title: string; body: string; email: string; phone: string; address: string };
}

export type SectionKey = keyof SiteContent;

export const DEFAULTS: SiteContent = {
  'home.hero': {
    title: "See a child's growth falter before it becomes an emergency.",
    body: "Ikibondo is where community health workers, nurses and supervisors in Rwanda's refugee camps record every measurement, compare it with WHO growth standards, and see which children need help first.",
    primary_cta: 'Sign in',
    secondary_cta: 'Register as a parent',
    note: 'Health worker accounts are created by your camp supervisor.',
  },
  'home.how_it_works': {
    title: 'From a home visit to a referral',
    subtitle: 'Every measurement a health worker takes reaches the people who can act on it.',
    steps: [
      {
        title: 'A health worker measures the child',
        description: 'CHWs visit families in their zone and record weight, height, MUAC, oedema and symptoms on their phone. Visits are saved even without a connection and sync when the network returns.',
      },
      {
        title: 'Ikibondo checks the measurements',
        description: 'Each visit is compared with WHO growth standards and scored LOW, MEDIUM or HIGH risk. The factors behind each score are listed in plain language so a nurse can check the reasoning.',
      },
      {
        title: 'The right person is told',
        description: 'Nurses and supervisors are alerted about high-risk children the same day. Parents get reminders three days before each vaccine is due.',
      },
    ],
  },
  'home.roles': {
    title: 'What each person sees when they sign in',
    roles: [
      {
        role: 'Community health workers',
        description: 'Register visits, record measurements and look a child up by scanning their QR card. Works offline in the field.',
        features: 'Offline visit queue; QR child lookup; Risk result after every visit',
      },
      {
        role: 'Nurses',
        description: 'Review records, add clinical notes, run vaccination sessions and see why the model scored a child the way it did.',
        features: 'Top factors behind each score; Clinical notes; WHO growth charts',
      },
      {
        role: 'Supervisors',
        description: 'Follow CHW activity across zones, respond to high-risk alerts and prepare reports for camp leadership.',
        features: 'CHW activity; High-risk alerts; Exportable reports',
      },
      {
        role: 'Parents and guardians',
        description: "See your child's growth and vaccination card, get SMS reminders and request a visit from your health worker.",
        features: 'Growth in plain language; Vaccination card; SMS reminders',
      },
    ],
  },
  'home.muac': {
    title: 'Read a MUAC tape the way a health worker does',
    body: "The tape goes around the middle of a child's upper arm. Its colour band tells the health worker what to do next. Move the marker to see each band.",
  },
  about: {
    title: "Paper growth cards get lost. Children shouldn't.",
    intro_1: "In a busy camp, a child's weight might be written on a card at one visit and on a different card at the next. When the records are scattered, a child who is slowly falling behind can go unnoticed until they are seriously ill.",
    intro_2: 'Ikibondo keeps one record per child that every health worker, nurse and supervisor in the camp can see. Each new measurement is checked against WHO growth standards the moment it is saved, so the children who need help are visible the same day.',
    principles_title: 'What we hold to',
    principles: [
      { title: 'The nurse decides', body: 'A risk score is a prompt to look closer, never a diagnosis. Every score lists the measurements behind it so a clinician can check the reasoning and overrule it.' },
      { title: 'Works where the network doesn’t', body: 'Health workers keep recording visits with no connection. Records are sent when the phone is back online, and nothing is lost in between.' },
      { title: 'Families stay in control', body: 'Parents give consent before records are kept, see their own child’s growth in plain language, and can ask for a visit at any time.' },
    ],
    closing: 'Health worker accounts are created by your camp supervisor. Parents can register and are approved by a nurse at their camp.',
  },
  footer: {
    tagline: 'means “baby” in Kinyarwanda.',
  },
  contact: {
    title: 'Contact',
    body: 'Questions about Ikibondo or your account? Ask the nurse at your camp health centre, or contact the programme team.',
    email: '',
    phone: '',
    address: '',
  },
};

// ── Admin editor form description ─────────────────────────────────────────────

export type FieldDef =
  | { name: string; label: string; kind: 'text' | 'textarea'; hint?: string }
  | { name: string; label: string; kind: 'list'; itemLabel: string; fields: { name: string; label: string; kind: 'text' | 'textarea'; hint?: string }[] };

export const SECTIONS: { key: SectionKey; label: string; page: string; fields: FieldDef[] }[] = [
  {
    key: 'home.hero', label: 'Home — top banner', page: '/',
    fields: [
      { name: 'title', label: 'Headline', kind: 'textarea' },
      { name: 'body', label: 'Introduction', kind: 'textarea' },
      { name: 'primary_cta', label: 'Sign-in button', kind: 'text' },
      { name: 'secondary_cta', label: 'Register button', kind: 'text' },
      { name: 'note', label: 'Note under the buttons', kind: 'text' },
    ],
  },
  {
    key: 'home.how_it_works', label: 'Home — how it works', page: '/',
    fields: [
      { name: 'title', label: 'Heading', kind: 'text' },
      { name: 'subtitle', label: 'Subheading', kind: 'textarea' },
      { name: 'steps', label: 'Steps', kind: 'list', itemLabel: 'Step', fields: [
        { name: 'title', label: 'Title', kind: 'text' },
        { name: 'description', label: 'Description', kind: 'textarea' },
      ] },
    ],
  },
  {
    key: 'home.roles', label: 'Home — what each person sees', page: '/',
    fields: [
      { name: 'title', label: 'Heading', kind: 'text' },
      { name: 'roles', label: 'Roles', kind: 'list', itemLabel: 'Role', fields: [
        { name: 'role', label: 'Who', kind: 'text' },
        { name: 'description', label: 'Description', kind: 'textarea' },
        { name: 'features', label: 'Features', kind: 'text', hint: 'Separate with semicolons (;)' },
      ] },
    ],
  },
  {
    key: 'home.muac', label: 'Home — MUAC tape explainer', page: '/',
    fields: [
      { name: 'title', label: 'Heading', kind: 'text' },
      { name: 'body', label: 'Introduction', kind: 'textarea',
        hint: 'The band meanings themselves are clinical guidance and are not editable here.' },
    ],
  },
  {
    key: 'about', label: 'About page', page: '/about',
    fields: [
      { name: 'title', label: 'Headline', kind: 'textarea' },
      { name: 'intro_1', label: 'First paragraph', kind: 'textarea' },
      { name: 'intro_2', label: 'Second paragraph', kind: 'textarea' },
      { name: 'principles_title', label: 'Principles heading', kind: 'text' },
      { name: 'principles', label: 'Principles', kind: 'list', itemLabel: 'Principle', fields: [
        { name: 'title', label: 'Title', kind: 'text' },
        { name: 'body', label: 'Text', kind: 'textarea' },
      ] },
      { name: 'closing', label: 'Closing note', kind: 'textarea' },
    ],
  },
  {
    key: 'contact', label: 'Contact details', page: '/about',
    fields: [
      { name: 'title', label: 'Heading', kind: 'text' },
      { name: 'body', label: 'Text', kind: 'textarea' },
      { name: 'email', label: 'Email', kind: 'text', hint: 'Leave empty to hide' },
      { name: 'phone', label: 'Phone', kind: 'text', hint: 'Leave empty to hide' },
      { name: 'address', label: 'Address', kind: 'textarea', hint: 'Leave empty to hide' },
    ],
  },
  {
    key: 'footer', label: 'Footer', page: '/',
    fields: [
      { name: 'tagline', label: 'Text after “Ikibondo”', kind: 'text' },
    ],
  },
];

// ── Reading ────────────────────────────────────────────────────────────────────

export interface StoredSection {
  key: SectionKey;
  content_en: Record<string, unknown>;
  content_fr: Record<string, unknown>;
  content_rw: Record<string, unknown>;
  updated_by_name?: string | null;
  updated_at?: string;
}
export type StoredContent = Partial<Record<SectionKey, StoredSection>>;

function present(v: unknown) {
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return v != null;
}

/** Defaults, overridden by the admin's English text, overridden by the chosen language. */
export function resolveSection<K extends SectionKey>(stored: StoredContent, key: K, lang: Lang = 'en'): SiteContent[K] {
  const row = stored[key];
  const out: Record<string, unknown> = { ...DEFAULTS[key] };
  for (const layer of [row?.content_en, lang !== 'en' ? row?.[`content_${lang}`] : undefined]) {
    for (const [field, value] of Object.entries(layer ?? {})) {
      if (field in out && present(value)) out[field] = value;
    }
  }
  return out as SiteContent[K];
}

/** Server-side fetch for public pages; a failing API simply shows the defaults. */
export async function fetchSiteContent(): Promise<StoredContent> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
  try {
    const res = await fetch(`${base}/site-content/`, { next: { revalidate: 60 } });
    if (!res.ok) return {};
    const body = await res.json();
    return (body?.data ?? {}) as StoredContent;
  } catch {
    return {};
  }
}
