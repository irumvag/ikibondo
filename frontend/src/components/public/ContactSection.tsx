import { Mail, MapPin, Phone } from 'lucide-react';
import { DEFAULTS, type SiteContent } from '@/lib/siteContent';

/** Contact block (Admin → Site content → Contact details). Empty details are hidden. */
export function ContactSection({ content = DEFAULTS.contact }: { content?: SiteContent['contact'] }) {
  const rows = [
    content.email && { icon: Mail, label: content.email, href: `mailto:${content.email}` },
    content.phone && { icon: Phone, label: content.phone, href: `tel:${content.phone.replace(/\s+/g, '')}` },
    content.address && { icon: MapPin, label: content.address, href: null },
  ].filter(Boolean) as { icon: typeof Mail; label: string; href: string | null }[];

  return (
    <section id="contact" className="border-t py-16" style={{ borderColor: 'var(--rule)' }} aria-labelledby="contact-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8">
        <div>
          <h2 id="contact-heading" className="text-3xl font-extrabold mb-3" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {content.title}
          </h2>
          <p className="text-base leading-relaxed max-w-prose" style={{ color: 'var(--text-muted)' }}>{content.body}</p>
        </div>
        {rows.length > 0 && (
          <ul className="flex flex-col gap-3 text-base">
            {rows.map(({ icon: Icon, label, href }) => (
              <li key={label} className="flex items-start gap-3" style={{ color: 'var(--text)' }}>
                <Icon size={18} aria-hidden="true" className="mt-1 shrink-0" style={{ color: 'var(--ink)' }} />
                {href
                  ? <a href={href} className="font-bold underline-offset-2 hover:underline" style={{ color: 'var(--ink)' }}>{label}</a>
                  : <span className="whitespace-pre-line">{label}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
