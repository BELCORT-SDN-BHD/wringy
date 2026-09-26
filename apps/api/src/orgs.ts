/**
 * `app.orgs` as the API reads and writes it (migration 0011; kickoff-package.md
 * §3.2, ruling D1; M2-03 code review R1, R2, R10). Serves M2-AC03/1: any
 * signed-in person can create an org, which is `live` with a database-chosen id.
 *
 * The runtime role may insert `(name, created_by)` and update `name`, nothing
 * else: it cannot choose an id, write `data_origin` (every org it creates takes
 * the column's `live` default) or change the creator, and it has no DELETE.
 * Every instant is the database's.
 */
import type { DataOrigin, OrgCapability, OrgRole, OrgSummary, PlatformCapability, WorkspacesResponse } from '@wringy/contracts';
import type { PoolClient } from '@wringy/db';

type Queryable = Pick<PoolClient, 'query'>;

/** The columns the OrgSummary contract needs, listed explicitly (the response schema is still the allow-list). */
const ORG_COLUMNS = 'id, name, data_origin, created_at';

interface OrgRow {
  id: string;
  name: string;
  data_origin: DataOrigin;
  created_at: Date;
}

function toOrgSummary(row: OrgRow): OrgSummary {
  return { id: row.id, name: row.name, dataOrigin: row.data_origin, createdAt: row.created_at.toISOString() };
}

/** Inserts an org as the API: the name and the creator only (R1, R2). */
export async function insertOrg(client: Queryable, { name, createdBy }: { name: string; createdBy: string }): Promise<OrgSummary> {
  const { rows } = await client.query<OrgRow>(
    `INSERT INTO app.orgs (name, created_by) VALUES ($1, $2) RETURNING ${ORG_COLUMNS}`,
    [name, createdBy],
  );
  if (rows[0] === undefined) throw new Error('the org insert returned no row');
  return toOrgSummary(rows[0]);
}

/** Renames an org (`UPDATE (name)` is the API's one column on the table); null when there is no such org. */
export async function renameOrg(client: Queryable, orgId: string, name: string): Promise<OrgSummary | null> {
  const { rows } = await client.query<OrgRow>(`UPDATE app.orgs SET name = $2 WHERE id = $1 RETURNING ${ORG_COLUMNS}`, [
    orgId,
    name,
  ]);
  return rows[0] === undefined ? null : toOrgSummary(rows[0]);
}

/** One org, or null. */
export async function readOrg(client: Queryable, orgId: string): Promise<OrgSummary | null> {
  const { rows } = await client.query<OrgRow>(`SELECT ${ORG_COLUMNS} FROM app.orgs WHERE id = $1`, [orgId]);
  return rows[0] === undefined ? null : toOrgSummary(rows[0]);
}

/**
 * `GET /me/workspaces` (R10): the caller's active memberships ordered by org
 * name, and the grants the caller holds — three SELECTs on one client. A grant is
 * not a membership: an org grant may name an org absent from `orgs`.
 */
export async function listWorkspaces(client: Queryable, userId: string): Promise<WorkspacesResponse> {
  const orgs = await client.query<{ id: string; name: string; role: OrgRole; data_origin: DataOrigin }>(
    `SELECT o.id, o.name, m.role, o.data_origin
       FROM app.org_members m
       JOIN app.orgs o ON o.id = m.org_id
      WHERE m.user_id = $1 AND m.status = 'active'
      ORDER BY o.name, o.id`,
    [userId],
  );
  const org = await client.query<{ org_id: string; capability: OrgCapability }>(
    `SELECT org_id, capability FROM app.admin_scopes WHERE user_id = $1 ORDER BY org_id, capability`,
    [userId],
  );
  const platform = await client.query<{ capability: PlatformCapability }>(
    `SELECT capability FROM app.platform_grants WHERE user_id = $1 ORDER BY capability`,
    [userId],
  );
  return {
    personal: { userId },
    orgs: orgs.rows.map((row) => ({ orgId: row.id, name: row.name, role: row.role, dataOrigin: row.data_origin })),
    grants: {
      org: org.rows.map((row) => ({ orgId: row.org_id, capability: row.capability })),
      platform: platform.rows.map((row) => row.capability),
    },
  };
}
