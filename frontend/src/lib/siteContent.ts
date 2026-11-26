/**
 * Public-site text that an admin can edit (Admin → Site content).
 *
 * DEFAULTS holds the built-in text for every section. The API stores only what an
 * admin changed (per language); pages merge those changes over the defaults, so an
 * empty database shows exactly the text below. FIELDS describes each section's form
 * in the admin editor.
 */

import { BUILTIN_TRANSLATIONS } from './siteContentTranslations';

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
  'app.parent_home': { title: string; body: string };
  'app.certificate': { title: string; body: string; steps: Step[] };
  'app.feeding': { title: string; body: string; steps: Step[] };
  'app.baby_care': { title: string; body: string; steps: Step[] };
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
  'app.parent_home': {
    title: 'Your child’s health, in one place',
    body: 'See each child’s growth and vaccinations, ask for a home visit, and get reminders before a dose is due. Your community health worker is one tap away.',
  },
  'app.certificate': {
    title: 'Getting a vaccination certificate',
    body: 'The app shows every dose your child has received. For an official, stamped certificate:',
    steps: [
      { title: 'Open Vaccines', description: 'Check that every dose your child received is marked as given.' },
      { title: 'Visit your health centre', description: 'Bring the child’s QR card or registration number to the nurse at your camp.' },
      { title: 'Collect the certificate', description: 'The nurse prints and stamps the certificate from Ikibondo.' },
    ],
  },
  // Health guidance for parents (WHO/UNICEF infant and young child feeding)
  'app.feeding': {
    "title": "Feeding your child, by age",
    "body": "What and how much to give at each age, with an example day using foods found in the camp. Wash your hands with soap before cooking and feeding, and use a clean cup and spoon (not a bottle).",
    "steps": [
      {
        "title": "0 to 6 months: breast milk only",
        "description": "Give only breast milk, day and night, whenever the baby wants (8 to 12 times a day). No water, no porridge, no other drinks: breast milk has all the water and food the baby needs."
      },
      {
        "title": "6 to 8 months: first foods",
        "description": "Keep breastfeeding. Add soft food 2 to 3 times a day, starting with 2 to 3 spoonfuls and slowly up to half a cup. Food should be thick enough to stay on the spoon.\nExample day: thick sorghum or maize porridge with milk · mashed banana or avocado · mashed beans or groundnut paste with a little oil."
      },
      {
        "title": "9 to 11 months: more meals",
        "description": "Keep breastfeeding. Give 3 to 4 meals and 1 to 2 snacks a day, half a cup each, mashed or finely chopped. Add an animal food every day if you can.\nExample day: porridge with milk and mashed banana · avocado · mashed sweet potato with beans, dodo (green leaves) and small fish (isambaza) · fruit · rice or potato with egg."
      },
      {
        "title": "12 to 23 months: family food",
        "description": "Keep breastfeeding to 2 years or more. Give 3 to 4 meals and 1 to 2 snacks a day, three quarters to one full cup, cut small. Every day give a food from each group: grains or roots, beans or groundnuts, milk or eggs, fish or meat, green leaves, fruit.\nExample day: porridge with milk · mandazi or fruit · beans, sweet potato, dodo and fish · avocado · ugali with eggs and vegetables."
      },
      {
        "title": "2 to 5 years",
        "description": "Three family meals and two snacks a day in the child's own plate, so you can see how much they eat. Give milk, eggs, beans, fruit and vegetables. Avoid sweets and sugary drinks."
      },
      {
        "title": "When your child is sick",
        "description": "Keep breastfeeding and offer food more often, in small amounts. For diarrhoea give ORS and zinc from the health centre. After the illness give one extra meal a day for two weeks."
      }
    ]
  },
  'app.baby_care': {
    "title": "Caring for your baby",
    "body": "Simple things that keep babies healthy. Your community health worker can show you each one.",
    "steps": [
      {
        "title": "Go to the health centre now if your child",
        "description": "cannot breastfeed or drink · vomits everything · has convulsions (fits) · is very sleepy or hard to wake · breathes fast or with difficulty · has a fever, or a newborn feels cold · has diarrhoea with blood or for many days · a newborn has yellow palms or soles, or a red, smelly cord."
      },
      {
        "title": "The first days",
        "description": "Breastfeed within the first hour. Keep the baby warm, skin to skin on your chest. Keep the cord clean and dry and put nothing on it. Wait before the first bath."
      },
      {
        "title": "Sleep",
        "description": "Put the baby to sleep on their back, under a mosquito net, every night."
      },
      {
        "title": "Clean hands, clean water",
        "description": "Wash hands with soap after the toilet, after changing the baby and before cooking or feeding. Give boiled or treated water to children over 6 months."
      },
      {
        "title": "Talk and play",
        "description": "Talk, sing and play with your baby every day. Babies learn from your voice and your face, and it helps their brain grow."
      },
      {
        "title": "Check-ups",
        "description": "Bring your child every month to be weighed and measured, give every vaccine on time, and vitamin A and deworming when the health centre offers them."
      }
    ]
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
  {
    key: 'app.parent_home', label: 'Mobile app — parent home', page: '',
    fields: [
      { name: 'title', label: 'Heading', kind: 'text' },
      { name: 'body', label: 'Text', kind: 'textarea' },
    ],
  },
  {
    key: 'app.certificate', label: 'Mobile app — vaccination certificate', page: '',
    fields: [
      { name: 'title', label: 'Heading', kind: 'text' },
      { name: 'body', label: 'Introduction', kind: 'textarea' },
      { name: 'steps', label: 'Steps', kind: 'list', itemLabel: 'Step', fields: [
        { name: 'title', label: 'Title', kind: 'text' },
        { name: 'description', label: 'Description', kind: 'textarea' },
      ] },
    ],
  },
  {
    key: 'app.feeding', label: 'Mobile app — feeding by age', page: '',
    fields: [
      { name: 'title', label: 'Heading', kind: 'text' },
      { name: 'body', label: 'Introduction', kind: 'textarea' },
      { name: 'steps', label: 'Age stages', kind: 'list', itemLabel: 'Stage', fields: [
        { name: 'title', label: 'Age', kind: 'text' },
        { name: 'description', label: 'Advice and example day', kind: 'textarea' },
      ] },
    ],
  },
  {
    key: 'app.baby_care', label: 'Mobile app — caring for your baby', page: '',
    fields: [
      { name: 'title', label: 'Heading', kind: 'text' },
      { name: 'body', label: 'Introduction', kind: 'textarea' },
      { name: 'steps', label: 'Topics', kind: 'list', itemLabel: 'Topic', fields: [
        { name: 'title', label: 'Topic', kind: 'text' },
        { name: 'description', label: 'Advice', kind: 'textarea' },
      ] },
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

/**
 * English defaults, then the admin's English text, then the built-in translation
 * for the chosen language, then the admin's text in that language. So a French
 * visitor sees French even after an admin edits only the English.
 */
export function resolveSection<K extends SectionKey>(stored: StoredContent, key: K, lang: Lang = 'en'): SiteContent[K] {
  const row = stored[key];
  const out: Record<string, unknown> = { ...DEFAULTS[key] };
  const builtin = lang !== 'en' ? BUILTIN_TRANSLATIONS[lang]?.[key] : undefined;
  for (const layer of [
    row?.content_en,
    builtin as Record<string, unknown> | undefined,
    lang !== 'en' ? row?.[`content_${lang}`] : undefined,
  ]) {
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
