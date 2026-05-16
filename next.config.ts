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
    loader: "custom",
    loaderFile: "./supabase-image-loader.js",
    remotePatterns: imageRemotePatterns,
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
