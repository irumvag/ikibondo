'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggle } from './ThemeToggle';

const NAV_LINKS = [
  { href: '/',      label: 'Home'  },
  { href: '/about', label: 'About' },
];

export function PublicNav() {
  const pathname = usePathname();

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
          >
            Ikibondo
          </Link>

          {/* Nav links */}
          <nav
            className="hidden sm:flex items-center gap-0.5"
            aria-label="Primary navigation"
          >
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? 'page' : undefined}
                className={[
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  pathname === href
                    ? 'bg-[var(--bg-sand)] text-[var(--ink)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-sand)]',
                ].join(' ')}
              >
                {label}
              </Link>
            ))}
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
          </div>

        </div>
      </div>
    </header>
  );
}
