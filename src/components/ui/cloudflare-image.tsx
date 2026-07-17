import NextImage, { type ImageProps } from "next/image";

import { publicMediaUrl } from "@/lib/cloudflare-images";

type CloudflareImageProps = Omit<ImageProps, "src" | "loader"> & {
  src: ImageProps["src"];
};

export default function CloudflareImage({ src, ...props }: CloudflareImageProps) {
  const resolvedSrc = typeof src === "string" ? publicMediaUrl(src) : src;

  return <NextImage {...props} src={resolvedSrc} />;
}
