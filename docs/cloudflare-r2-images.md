# Cloudflare R2 image setup

The application stores original public images in Cloudflare R2. The shared image component resolves migrated local paths to R2 URLs and leaves resizing, format selection, and responsive `srcset` generation to Next.js' built-in image optimizer.

## Cloudflare dashboard

1. Create an R2 bucket named `ashram`.
2. Create an Object Read & Write credential restricted to that bucket.
3. Enable the bucket's public `r2.dev` development URL for local testing.
4. Add the variables documented in `.env.example` to local, Preview, and Production environments.

Keep `NEXT_PUBLIC_CLOUDFLARE_R2_ENABLED=false` until static and database media have been uploaded and verified. For production, replace the public development URL with an R2 custom domain before disabling `r2.dev`; no application code change is required.

## Static images

Preview the detected production assets without changing files:

```bash
pnpm media:migrate:static:dry-run
```

Upload them and generate `src/config/cloudflare-media-manifest.json`:

```bash
pnpm media:migrate:static
```

The command hashes assets, reuses existing R2 objects, verifies their public URLs, and writes a deterministic local-path-to-object-key manifest.

## Existing Supabase images

Follow the project's local-first Supabase workflow. Never run direct UPDATE statements against production.

1. Create a gitignored data backup with `supabase db dump --data-only --linked`.
2. Extract public Supabase image URLs:

   ```bash
   pnpm media:extract:supabase -- --dump supabase/backups/<data-backup>.sql
   ```

3. Upload the extracted files to R2 and write an old/new URL mapping:

   ```bash
   pnpm media:migrate:remote -- --inventory supabase/backups/cloudflare-image-url-inventory.json
   ```

4. Generate a transactional migration:

   ```bash
   pnpm media:generate:migration -- --mapping supabase/backups/cloudflare-image-url-map.json
   ```

5. Review the SQL, run `supabase db reset`, and verify locally. Stop for approval before any production push.
6. Before deployment, take mandatory schema and data backups, run `supabase db push --dry-run`, obtain approval, and only then push.

Old local assets and Supabase objects must remain available until the production observation period is complete.
