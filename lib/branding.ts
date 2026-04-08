import type { DbClient } from './env';
import type { Branding } from './report';

export type BrandingOwner = { type: 'subscriber' | 'user'; id: string };

export async function getBranding(db: DbClient, owner: BrandingOwner): Promise<Branding | null> {
  const row = await db.prepare(`
    SELECT agency_name, logo_url, logo_data_url
    FROM brandings
    WHERE owner_type = ? AND owner_id = ?
  `).get(owner.type, owner.id) as any;

  if (!row) return null;
  return {
    agencyName: row.agency_name ?? null,
    logoUrl: row.logo_url ?? null,
    logoDataUrl: row.logo_data_url ?? null,
  };
}

export async function upsertBranding(db: DbClient, owner: BrandingOwner, branding: Branding): Promise<void> {
  await db.prepare(`
    INSERT INTO brandings (owner_type, owner_id, agency_name, logo_url, logo_data_url, updated_at)
    VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    ON CONFLICT(owner_type, owner_id) DO UPDATE SET
      agency_name = excluded.agency_name,
      logo_url = excluded.logo_url,
      logo_data_url = excluded.logo_data_url,
      updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  `).run(
    owner.type,
    owner.id,
    branding.agencyName ?? null,
    branding.logoUrl ?? null,
    branding.logoDataUrl ?? null
  );
}

