const isDev = process.env.NODE_ENV !== "production";

// Allow the API origin the browser is actually configured to call. Derive it
// from the same env var the API client uses so the CSP never drifts from reality.
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
let apiOrigin;
try {
  apiOrigin = new URL(apiUrl).origin;
} catch {
  apiOrigin = "http://localhost:8000";
}

// 'unsafe-eval' is only needed by the Next.js dev server (fast refresh). Never
// ship it to production.
const scriptSrc = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      `connect-src 'self' ${apiOrigin}`,
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/manager',          destination: '/supervisor',          permanent: true },
      { source: '/manager/:path*',   destination: '/supervisor/:path*',   permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "8000" },
    ],
  },
};

module.exports = nextConfig;
