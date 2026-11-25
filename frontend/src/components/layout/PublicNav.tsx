'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

// Each link can target a hash anchor on a specific page
interface NavLink {
  href: string;
  label: string;
  /** If provided, this link is only highlighted when the pathname matches */
  matchPath?: string;
}

const NAV_LINKS: NavLink[] = [
  { href: '/',                label: 'Home',         matchPath: '/' },
  { href: '/#how-it-works',   label: 'How it works', matchPath: '/' },
  { href: '/#faq',            label: 'FAQ',          matchPath: '/' },
  { href: '/about',           label: 'About',        matchPath: '/about' },
];

function isActive(link: NavLink, pathname: string): boolean {
  if (link.href === '/') return pathname === '/';
  if (link.href.startsWith('/#')) return pathname === '/';
  return pathname.startsWith(link.matchPath ?? link.href);
}

export function PublicNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-4">

          {/* Logo */}
          <Link
            href="/"
            className="shrink-0 text-xl font-bold tracking-tight transition-opacity hover:opacity-75"
            style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--ink)' }}
            onClick={closeMobile}
          >
            Ikibondo
          </Link>

          {/* Desktop nav links */}
          <nav
            className="hidden md:flex items-center gap-0.5"
            aria-label="Primary navigation"
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
                  {link.label}
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
              Register
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center px-4 h-8 rounded-lg text-sm font-semibold transition-opacity hover:opacity-85"
              style={{ backgroundColor: 'var(--ink)', color: 'var(--bg)' }}
            >
              Login
            </Link>

            {/* Mobile menu toggle */}
            <button
              type="button"
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--bg-sand)]"
              style={{ color: 'var(--ink)' }}
              onClick={() => setMobileOpen(v => !v)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
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
                {link.label}
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
              Register
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
