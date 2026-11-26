'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from '@/components/ui/Logo';

// Each link can target a hash anchor on a specific page
interface NavLink {
  href: string;
  /** Key in messages/en.json under "nav" */
  label: 'home' | 'howItWorks' | 'faq' | 'about';
  /** If provided, this link is only highlighted when the pathname matches */
  matchPath?: string;
}

const NAV_LINKS: NavLink[] = [
  { href: '/',                label: 'home',         matchPath: '/' },
  { href: '/#how-it-works',   label: 'howItWorks',   matchPath: '/' },
  { href: '/#faq',            label: 'faq',          matchPath: '/' },
  { href: '/about',           label: 'about',        matchPath: '/about' },
];

function isActive(link: NavLink, pathname: string): boolean {
  if (link.href === '/') return pathname === '/';
  if (link.href.startsWith('/#')) return pathname === '/';
  return pathname.startsWith(link.matchPath ?? link.href);
}

export function PublicNav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        backgroundColor: 'var(--bg)',
        borderColor: 'var(--rule)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">

          {/* Logo */}
          <Link
            href="/"
            className="shrink-0 transition-opacity hover:opacity-75"
            onClick={closeMobile}
          >
            <Logo size={32} />
          </Link>

          {/* Desktop nav links */}
          <nav
            className="hidden md:flex items-center gap-0.5"
            aria-label={t('primary')}
          >
            {NAV_LINKS.map(link => {
              const active = isActive(link, pathname);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active && !link.href.startsWith('/#') ? 'page' : undefined}
                  className={[
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    active && !link.href.startsWith('/#')
                      ? 'bg-[var(--bg-sand)] text-[var(--ink)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-sand)]',
                  ].join(' ')}
                >
                  {t(link.label)}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            <Link
              href="/register"
              className="hidden sm:inline-flex items-center px-4 h-8 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
            >
              {t('register')}
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center px-4 h-9 rounded-[var(--radius-sm)] text-sm font-bold transition-colors bg-[var(--ink)] hover:bg-[var(--ink-soft)]"
              style={{ color: 'var(--bg)' }}
            >
              {t('signIn')}
            </Link>

            {/* Mobile menu toggle */}
            <button
              type="button"
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
              style={{ color: 'var(--ink)' }}
              onClick={() => setMobileOpen(v => !v)}
              aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              {mobileOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          className="md:hidden border-t px-4 py-3 flex flex-col gap-1"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          {NAV_LINKS.map(link => {
            const active = isActive(link, pathname) && !link.href.startsWith('/#');
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                onClick={closeMobile}
                className={[
                  'px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-[var(--bg-sand)] text-[var(--ink)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-sand)]',
                ].join(' ')}
              >
                {t(link.label)}
              </Link>
            );
          })}
          <div className="border-t mt-2 pt-3" style={{ borderColor: 'var(--border)' }}>
            <Link
              href="/register"
              onClick={closeMobile}
              className="block px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--bg-sand)]"
              style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
            >
              {t('register')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
