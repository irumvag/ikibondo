import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function Home() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 p-8"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <div className="text-center">
        <h1
          className="text-5xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-fraunces)", color: "var(--ink)" }}
        >
          Ikibondo
        </h1>
        <p className="mt-2 text-lg" style={{ color: "var(--text-muted)" }}>
          Child Health Platform — Phase 0 Foundation ✓
        </p>
      </div>

      <ThemeToggle />

      <div className="flex gap-3 flex-wrap justify-center">
        {(["LOW", "MEDIUM", "HIGH"] as const).map((level) => (
          <div
            key={level}
            className="px-5 py-2 rounded-xl text-sm font-semibold"
            style={{
              backgroundColor:
                level === "LOW"
                  ? "var(--low-bg)"
                  : level === "MEDIUM"
                  ? "var(--med-bg)"
                  : "var(--high-bg)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
          >
            {level} risk
          </div>
        ))}
      </div>

      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Toggle theme above — System / Light / Dark (persists across sessions)
      </p>
    </main>
  );
}
