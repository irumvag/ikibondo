import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  if (items.length <= 1) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={`hidden md:flex items-center gap-1 text-xs ${className}`}
    >
      <ol className="flex items-center gap-1" role="list">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1">
              {idx > 0 && (
                <ChevronRight
                  size={12}
                  aria-hidden="true"
                  style={{ color: 'var(--text-muted)' }}
                />
              )}
              {isLast || !item.href ? (
                <span
                  className="font-medium truncate max-w-[160px]"
                  style={{ color: isLast ? 'var(--text)' : 'var(--text-muted)' }}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="truncate max-w-[160px] hover:underline transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
