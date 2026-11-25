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
      <footer className="border-t-2 py-10" style={{ borderColor: 'var(--ink)' }}>
        <div
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:justify-between gap-2 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <p>
            <span className="font-extrabold" style={{ color: 'var(--ink)' }}>Ikibondo</span>
            {' '}means &ldquo;baby&rdquo; in Kinyarwanda.
          </p>
          <p>&copy; {new Date().getFullYear()} Ikibondo, Rwanda</p>
        </div>
      </footer>
    </>
  );
}
