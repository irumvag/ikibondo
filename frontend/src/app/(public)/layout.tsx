import { PublicNav } from '@/components/layout/PublicNav';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicNav />
      {children}
      <footer
        className="border-t py-10 mt-8"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
          style={{ color: 'var(--text-muted)' }}
        >
          <p className="text-sm">
            &copy; {new Date().getFullYear()}{' '}
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Ikibondo</span>
            {' '}· Child Health Platform · Rwanda
          </p>
          <p className="text-xs mt-1">
            Built for community health workers and families in refugee camps.
          </p>
        </div>
      </footer>
    </>
  );
}
