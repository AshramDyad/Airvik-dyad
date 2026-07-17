import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHostname: string | undefined;

if (supabaseUrl) {
  try {
    supabaseHostname = new URL(supabaseUrl).hostname;
  } catch {
    supabaseHostname = undefined;
  }
}

const legacySupabaseHostname = "fflsucsqhjjuozmfwpho.supabase.co";
const supabasePathname = "/storage/v1/object/public/images/**";
const cloudflareR2PublicUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL;
let cloudflareR2Hostname: string | undefined;

if (cloudflareR2PublicUrl) {
  try {
    cloudflareR2Hostname = new URL(cloudflareR2PublicUrl).hostname;
  } catch {
    cloudflareR2Hostname = undefined;
  }
}

const buildSupabasePattern = (hostname: string): RemotePattern => ({
  protocol: "https",
  hostname,
  port: "",
  pathname: supabasePathname,
});

const imageRemotePatterns: RemotePattern[] = [];

if (supabaseHostname) {
  imageRemotePatterns.push(buildSupabasePattern(supabaseHostname));
}

if (!supabaseHostname || supabaseHostname !== legacySupabaseHostname) {
  imageRemotePatterns.push(buildSupabasePattern(legacySupabaseHostname));
}

if (cloudflareR2Hostname) {
  imageRemotePatterns.push({
    protocol: "https",
    hostname: cloudflareR2Hostname,
    port: "",
    pathname: "/**",
  });
}

imageRemotePatterns.push({
  protocol: "https",
  hostname: "i.ytimg.com",
  port: "",
  pathname: "/vi/**",
});

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to succeed even if lint errors are present.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: imageRemotePatterns,
    deviceSizes: [320, 480, 640, 768, 960, 1200, 1600, 1920],
    imageSizes: [32, 48, 64, 96, 128, 256],
    qualities: [75],
  },
  webpack: (config) => {
    if (process.env.NODE_ENV === "development") {
      config.module.rules.push({
        test: /\.(jsx|tsx)$/,
        exclude: /node_modules/,
        enforce: "pre",
        use: "@dyad-sh/nextjs-webpack-component-tagger",
      });
    }
    return config;
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/admin", permanent: false },
      { source: "/reservations", destination: "/admin/reservations", permanent: false },
      { source: "/reservations/:id", destination: "/admin/reservations/:id", permanent: false },
      { source: "/calendar", destination: "/admin/calendar", permanent: false },
      { source: "/housekeeping", destination: "/admin/housekeeping", permanent: false },
      { source: "/guests", destination: "/admin/guests", permanent: false },
      { source: "/guests/:id", destination: "/admin/guests/:id", permanent: false },
      { source: "/room-categories", destination: "/admin/room-categories", permanent: false },
      { source: "/room-types", destination: "/admin/room-types", permanent: false },
      { source: "/rooms", destination: "/admin/rooms", permanent: false },
      { source: "/rates", destination: "/admin/rates", permanent: false },
      { source: "/reports", destination: "/admin/reports", permanent: false },
      { source: "/settings", destination: "/admin/settings", permanent: false },
    ];
  },
};

export default nextConfig;
