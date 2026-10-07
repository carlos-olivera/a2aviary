import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  SiteError,
  canonicalJson,
  sha256,
  staticDigest,
  staticHashes,
  validateStaticFiles,
  validateStaticServing,
  assertStaticReport,
  type StaticFiles,
  type StaticTarget,
  type StaticServing,
  type StaticObservation,
  type ManagedDependencies,
} from "@a2aviary/generator";
import {
  Store,
  requireConfirmation,
  requireRole,
  type Principal,
} from "./store.ts";

type Site = {
  id: string;
  owner_id: string;
  kind: string;
  test_mode: boolean;
  lifecycle: string;
  current_release_id: string | null;
  slug: string;
};
type Binding = {
  target: StaticTarget;
  serving: StaticServing;
  baseline: Record<string, unknown>;
  observation: StaticObservation;
  handed_off: boolean;
};
type Release = {
  id: string;
  site_id: string;
  source_commit: string;
  artifact_sha256: string;
  baseline: boolean;
  state: string;
  predecessor_id: string | null;
  observation_sha256: string;
  report: any;
};
type Job = {
  id: string;
  site_id: string;
  release_id: string | null;
  base_release_id: string | null;
  actor_id: string;
  kind: "verify" | "deploy" | "rollback" | "usage";
  handoff: boolean;
  billing_snapshot: unknown;
  provider_deployment_id: string | null;
};
export interface ImportStatic {
  slug: string;
  expectedOwnerEmail: string;
  ownerEmail?: string;
  firstClientPilot: boolean;
  target: StaticTarget;
  sourceCommit: string;
  deploymentId: string;
  serving: StaticServing;
  files: StaticFiles;
  confirmation: string;
}
export const STATIC_TOOLS = [
  "site.import",
  "site.admin.assign",
  "site.admin.remove",
  "site.admin.list",
  "site.release.verify",
  "site.release.deploy",
  "site.release.rollback",
  "site.release.reconcile",
  "site.report",
  "site.costs.refresh",
];
export class ManagedSites {
  readonly store: Store;
  readonly dependencies: ManagedDependencies;
  constructor(store: Store, dependencies: ManagedDependencies) {
    this.store = store;
    this.dependencies = dependencies;
  }
  private async lock(c: PoolClient, id: string) {
    await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "managed-site:" + id,
    ]);
  }
  private async access(
    c: PoolClient,
    p: Principal,
    id: string,
    lock = true,
  ): Promise<Site> {
    if (lock) await this.lock(c, id);
    const site = (
      await c.query(
        `SELECT s.* FROM platform_site s JOIN "user" u ON u.id=$2 WHERE s.id=$1 AND u."emailVerified" AND
      (s.owner_id=$2 OR $3 OR EXISTS(SELECT 1 FROM platform_site_admin a WHERE a.site_id=s.id AND a.email=lower(u.email) AND a.enabled))`,
        [id, p.id, p.role === "superadmin"],
      )
    ).rows[0];
    if (!site || p.role === "tester" || site.test_mode)
      throw new SiteError("owned_site_required");
    if (site.lifecycle !== "active")
      throw new SiteError("site_" + site.lifecycle);
    return site;
  }
  private async imported(c: PoolClient, p: Principal, id: string, lock = true) {
    const s = await this.access(c, p, id, lock);
    if (s.kind !== "imported-static")
      throw new SiteError("imported_site_required");
    return s;
  }
  private async binding(c: PoolClient, id: string): Promise<Binding> {
    const b = (
      await c.query("SELECT * FROM platform_static_binding WHERE site_id=$1", [
        id,
      ])
    ).rows[0];
    if (!b) throw new SiteError("static_binding_missing");
    return b;
  }
  private async release(
    c: PoolClient,
    id: string,
    siteId: string,
  ): Promise<Release> {
    const r = (
      await c.query(
        "SELECT * FROM platform_static_release WHERE id=$1 AND site_id=$2",
        [id, siteId],
      )
    ).rows[0];
    if (!r) throw new SiteError("owned_release_required");
    return r;
  }
  private async billing(c: PoolClient, site: Site) {
    // Resolve the current owner independently of the acting site administrator.
    const owner = await this.store.currentPrincipal(c, site.owner_id);
    await c.query(
      "SELECT platform_record_billing(s,$2) FROM platform_site s WHERE s.id=$1",
      [site.id, owner.role],
    );
    const b = (
      await c.query(
        'SELECT id::text,owner_role AS "ownerRole",eligible,reason,effective_at AS "effectiveAt" FROM platform_site_billing WHERE site_id=$1 ORDER BY id DESC LIMIT 1',
        [site.id],
      )
    ).rows[0];
    return { ...b, chargesEnabled: false };
  }
  private async event(
    c: PoolClient,
    p: Principal,
    site: Site,
    kind: string,
    result: string,
    releaseId: string | null = null,
    jobId: string | null = null,
    details: object = {},
    snapshot?: unknown,
  ) {
    const billing = snapshot ?? (await this.billing(c, site));
    await c.query(
      "INSERT INTO platform_site_operation(site_id,actor_id,kind,result,release_id,job_id,billing_snapshot,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        site.id,
        p.id,
        kind,
        result,
        releaseId,
        jobId,
        JSON.stringify(billing),
        JSON.stringify(details),
      ],
    );
    await c.query(
      "INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,$2,$3,$4,false)",
      [
        p.id,
        kind,
        site.id,
        JSON.stringify({
          tool: kind,
          result,
          siteId: site.id,
          ...(releaseId ? { releaseId } : {}),
          test: false,
        }),
      ],
    );
  }
  private async action<T>(
    actor: string,
    tool: string,
    fn: (c: PoolClient, p: Principal) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.store.siteAction(actor, tool, fn);
    } catch (error) {
      await this.store.recordSiteResult(
        actor,
        tool,
        null,
        error instanceof SiteError ? error.code : "operation_failed",
      );
      throw error;
    }
  }
  private async files(id: string): Promise<StaticFiles> {
    return validateStaticFiles(
      JSON.parse(
        (
          await this.dependencies.objects.get(
            "static/releases/" + id + "/files.json",
          )
        ).toString(),
      ),
    );
  }
  async isImported(id: string) {
    return (
      (
        await this.store.pool.query(
          "SELECT 1 FROM platform_site WHERE id=$1 AND kind='imported-static'",
          [id],
        )
      ).rowCount !== 0
    );
  }
  async uploadBaseline(actor: string, input: unknown) {
    const files = validateStaticFiles(input);
    return this.action(actor, "site.import", async (c, p) => {
      const uploadId = randomUUID();
      await this.dependencies.objects.put(
        "static/imports/" + uploadId + ".json",
        Buffer.from(
          canonicalJson({ actorId: p.id, createdAt: Date.now(), files }),
        ),
      );
      await c.query(
        "INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'site.import.upload',$2,$3,false)",
        [
          p.id,
          uploadId,
          JSON.stringify({
            tool: "site.import",
            result: "accepted",
            artifactSha256: staticDigest(files),
          }),
        ],
      );
      return {
        uploadId,
        artifactSha256: staticDigest(files),
        expiresInHours: 24,
      };
    });
  }
  async importUploaded(
    actor: string,
    input: Omit<ImportStatic, "files"> & { uploadId: string },
  ) {
    const uploaded = JSON.parse(
      (
        await this.dependencies.objects.get(
          "static/imports/" + input.uploadId + ".json",
        )
      ).toString(),
    );
    if (
      uploaded.actorId !== actor ||
      uploaded.createdAt < Date.now() - 86400000
    )
      throw new SiteError("static_import_upload_required");
    return this.importSite(actor, { ...input, files: uploaded.files });
  }
  async importSite(actor: string, input: ImportStatic) {
    requireConfirmation(
      input.confirmation,
      "IMPORT_SITE:" + input.slug + ":" + input.deploymentId,
    );
    const files = validateStaticFiles(input.files);
    validateStaticServing(input.serving);
    if (
      !/^[a-z][a-z0-9-]{0,63}$/.test(input.slug) ||
      !/^[a-f0-9]{40}$/.test(input.sourceCommit)
    )
      throw new SiteError("invalid_static_import");
    return this.action(actor, "site.import", async (c, p) => {
      const identity = (
        await c.query('SELECT email FROM "user" WHERE id=$1', [p.id])
      ).rows[0];
      if (
        input.expectedOwnerEmail.toLowerCase() !==
        String(identity.email).toLowerCase()
      )
        throw new SiteError("static_owner_identity_mismatch");
      const email = (
        input.ownerEmail ?? input.expectedOwnerEmail
      ).toLowerCase();
      const owner = (
        await c.query(
          'SELECT id FROM "user" WHERE lower(email)=$1 AND "emailVerified"',
          [email],
        )
      ).rows[0];
      if (!owner) throw new SiteError("verified_owner_required");
      // serialize all imports/pilot admission; never silently reuse another target.
      await c.query("SELECT pg_advisory_xact_lock(hashtext('managed-import'))");
      if (
        input.firstClientPilot &&
        (
          await c.query(
            "SELECT 1 FROM platform_site s WHERE NOT test_mode AND (kind='imported-static' OR EXISTS(SELECT 1 FROM platform_site_spec p WHERE p.site_id=s.id)) LIMIT 1",
          )
        ).rowCount
      )
        throw new SiteError("first_client_reconciliation_required");
      if (
        (
          await c.query(
            "SELECT 1 FROM platform_static_binding WHERE target->>'serviceId'=$1 OR target->>'domain'=$2",
            [input.target.serviceId, input.target.domain],
          )
        ).rowCount
      )
        throw new SiteError("static_target_already_registered");
      if (
        (
          await c.query(
            "SELECT 1 FROM platform_static_binding WHERE target->>'projectId'=$1 AND target->>'environmentId'=$2 AND target->>'serviceId'=$3",
            [
              input.target.projectId,
              input.target.environmentId,
              input.target.serviceId,
            ],
          )
        ).rowCount
      )
        throw new SiteError("static_target_already_registered");
      const observed = await this.dependencies.provider.observe(input.target);
      if (
        observed.staged ||
        (observed.deploymentStatus &&
          observed.deploymentStatus !== "SUCCESS") ||
        observed.deploymentId !== input.deploymentId ||
        observed.sourceCommit !== input.sourceCommit ||
        !observed.sourceRepository
      )
        throw new SiteError("static_production_drift");
      const evidence = await this.dependencies.provider.capture(
        input.target,
        files,
      );
      if (
        canonicalJson(
          await this.dependencies.provider.observe(input.target),
        ) !== canonicalJson(observed)
      )
        throw new SiteError("static_production_drift");
      const id = randomUUID(),
        releaseId = randomUUID();
      const site = (
        await c.query(
          "INSERT INTO platform_site(id,owner_id,slug,plan_id,policy_version,kind,cms_mode,first_client_pilot,resources) VALUES($1,$2,$3,'managed-static','imported-static-v1','imported-static','none',$4,$5) RETURNING *",
          [
            id,
            owner.id,
            input.slug,
            input.firstClientPilot,
            JSON.stringify({
              projectId: input.target.projectId,
              environmentId: input.target.environmentId,
              webServiceId: input.target.serviceId,
              domain: input.target.domain,
            }),
          ],
        )
      ).rows[0] as Site;
      await this.dependencies.objects.put(
        "static/releases/" + releaseId + "/files.json",
        Buffer.from(canonicalJson(files)),
      );
      await c.query(
        "INSERT INTO platform_static_binding(site_id,target,serving,baseline,observation) VALUES($1,$2,$3,$4,$5)",
        [
          id,
          JSON.stringify(input.target),
          JSON.stringify(input.serving),
          JSON.stringify({
            files: staticHashes(files),
            fileCount: Object.keys(files).length,
            artifactBytes: Object.values(files).reduce(
              (n, b) => n + Buffer.from(b, "base64").length,
              0,
            ),
            evidence,
            sourceCommit: input.sourceCommit,
            deploymentId: input.deploymentId,
          }),
          JSON.stringify(observed),
        ],
      );
      await c.query(
        "INSERT INTO platform_static_release(id,site_id,source_commit,artifact_sha256,baseline,state,submitted_by,observation_sha256,provider_deployment_id) VALUES($1,$2,$3,$4,true,'live',$5,$6,$7)",
        [
          releaseId,
          id,
          input.sourceCommit,
          staticDigest(files),
          p.id,
          sha256(canonicalJson(observed)),
          input.deploymentId,
        ],
      );
      await c.query(
        "UPDATE platform_site SET current_release_id=$2 WHERE id=$1",
        [id, releaseId],
      );
      await this.event(c, p, site, "site.import", "accepted", releaseId);
      return {
        siteId: id,
        releaseId,
        kind: "imported-static",
        cmsMode: "none",
        firstClientPilot: input.firstClientPilot,
        hostingChanged: false,
        billing: await this.billing(c, site),
      };
    });
  }
  async admins(
    actor: string,
    siteId: string,
    operation: "assign" | "remove" | "list",
    emails: string[] = [],
  ) {
    return this.action(actor, "site.admin." + operation, async (c, p) => {
      const site = await this.imported(c, p, siteId);
      const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
      if (
        operation !== "list" &&
        (!unique.length ||
          unique.length > 100 ||
          unique.some(
            (e) => e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
          ))
      )
        throw new SiteError("invalid_email");
      for (const email of unique) {
        if (
          (
            await c.query(
              'SELECT 1 FROM "user" WHERE id=$1 AND lower(email)=$2',
              [site.owner_id, email],
            )
          ).rowCount
        )
          throw new SiteError("site_owner_membership_reserved");
        if (
          operation === "assign" &&
          (
            await c.query(
              "SELECT 1 FROM platform_tester WHERE email=$1 AND enabled",
              [email],
            )
          ).rowCount
        )
          throw new SiteError("reserved_identity");
        await c.query(
          "INSERT INTO platform_site_admin(site_id,email,assigned_by,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(site_id,email) DO UPDATE SET enabled=excluded.enabled,assigned_by=excluded.assigned_by,updated_at=now()",
          [siteId, email, p.id, operation === "assign"],
        );
      }
      await this.event(
        c,
        p,
        site,
        "site.admin." + operation,
        operation === "list" ? "read" : "updated",
        null,
        null,
        { count: unique.length },
      );
      return {
        siteId,
        admins: (
          await c.query(
            'SELECT a.email,a.enabled,a.created_at AS "createdAt",a.updated_at AS "updatedAt",EXISTS(SELECT 1 FROM "user" u WHERE lower(u.email)=a.email AND u."emailVerified") AS "verifiedIdentity" FROM platform_site_admin a WHERE a.site_id=$1 ORDER BY a.email',
            [siteId],
          )
        ).rows,
        delivery: "no_message_sent",
      };
    });
  }
  async submit(
    actor: string,
    input: { siteId: string; sourceCommit: string; files: StaticFiles },
  ) {
    const files = validateStaticFiles(input.files);
    if (!/^[a-f0-9]{40}$/.test(input.sourceCommit))
      throw new SiteError("invalid_static_commit");
    return this.action(actor, "site.release.verify", async (c, p) => {
      const site = await this.imported(c, p, input.siteId);
      const b = await this.binding(c, site.id);
      const existing = (
        await c.query(
          "SELECT id,state FROM platform_static_release WHERE site_id=$1 AND source_commit=$2 AND artifact_sha256=$3",
          [site.id, input.sourceCommit, staticDigest(files)],
        )
      ).rows[0];
      // The first candidate is a distinct release even when it matches the baseline commit/bytes.
      if (existing && !b.handed_off && existing.state === "live") {
        const id = existing.id;
        return {
          siteId: site.id,
          releaseId: id,
          state: "live",
          baseline: true,
          verificationRequired: true,
        };
      }
      if (existing)
        return {
          siteId: site.id,
          releaseId: existing.id,
          state: existing.state,
        };
      const id = randomUUID();
      await this.dependencies.objects.put(
        "static/releases/" + id + "/files.json",
        Buffer.from(canonicalJson(files)),
      );
      await c.query(
        "INSERT INTO platform_static_release(id,site_id,source_commit,artifact_sha256,submitted_by,predecessor_id,observation_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          id,
          site.id,
          input.sourceCommit,
          staticDigest(files),
          p.id,
          site.current_release_id,
          sha256(canonicalJson(b.observation)),
        ],
      );
      await this.event(c, p, site, "site.release.submit", "accepted", id);
      return { siteId: site.id, releaseId: id, state: "staged" };
    });
  }
  async verify(actor: string, siteId: string, releaseId: string) {
    return this.action(actor, "site.release.verify", async (c, p) => {
      const site = await this.imported(c, p, siteId);
      const r = await this.release(c, releaseId, siteId);
      const queued = (
        await c.query(
          "SELECT id,state FROM platform_static_job WHERE release_id=$1 AND kind='verify' AND state IN ('queued','running')",
          [releaseId],
        )
      ).rows[0];
      if (queued)
        return { siteId, releaseId, jobId: queued.id, state: queued.state };
      if (r.state === "verifying")
        return { siteId, releaseId, state: "verifying" };
      if (r.report?.passed && ["verified", "live"].includes(r.state))
        return { siteId, releaseId, state: r.state };
      if (["unknown"].includes(r.state)) throw new SiteError("static_job_busy");
      const billing = await this.billing(c, site);
      const jobId = randomUUID();
      await c.query(
        "INSERT INTO platform_static_job(id,site_id,release_id,actor_id,kind,billing_snapshot) VALUES($1,$2,$3,$4,'verify',$5)",
        [jobId, siteId, releaseId, p.id, JSON.stringify(billing)],
      );
      await c.query(
        "UPDATE platform_static_release SET state=CASE WHEN baseline THEN state ELSE 'verifying' END,approved_by=NULL,approved_at=NULL WHERE id=$1",
        [releaseId],
      );
      await this.event(
        c,
        p,
        site,
        "site.release.verify",
        "queued",
        releaseId,
        jobId,
        {},
        billing,
      );
      return { siteId, releaseId, jobId, state: "queued" };
    });
  }
  async deploy(
    actor: string,
    siteId: string,
    releaseId: string,
    confirmation: string,
    rollback = false,
  ) {
    if (!this.dependencies.deploymentEnabled)
      throw new SiteError("static_deployment_disabled");
    return this.action(
      actor,
      rollback ? "site.release.rollback" : "site.release.deploy",
      async (c, p) => {
        const site = await this.imported(c, p, siteId),
          b = await this.binding(c, siteId),
          r = await this.release(c, releaseId, siteId);
        const handoff = !b.handed_off;
        requireConfirmation(
          confirmation,
          (rollback
            ? "ROLLBACK_SITE:"
            : handoff
              ? "HANDOFF_SITE:"
              : "DEPLOY_RELEASE:") +
            siteId +
            ":" +
            releaseId,
        );
        if (
          handoff &&
          (!this.dependencies.handoffEnabled ||
            p.role !== "superadmin" ||
            rollback)
        )
          throw new SiteError("static_handoff_disabled");
        const busy = (
          await c.query(
            "SELECT id,release_id,kind,state FROM platform_static_job WHERE site_id=$1 AND kind IN ('deploy','rollback') AND state IN ('queued','running','unknown')",
            [siteId],
          )
        ).rows[0];
        if (busy) {
          if (
            busy.release_id === releaseId &&
            busy.kind === (rollback ? "rollback" : "deploy") &&
            busy.state !== "unknown"
          )
            return { siteId, releaseId, jobId: busy.id, state: busy.state };
          throw new SiteError("static_job_busy");
        }
        if (!r.report?.passed && !rollback)
          throw new SiteError("static_verified_release_required");
        if (!rollback) {
          const baselineId = (
            await c.query(
              "SELECT id FROM platform_static_release WHERE site_id=$1 AND baseline",
              [siteId],
            )
          ).rows[0].id;
          try {
            assertStaticReport(
              r.report,
              await this.files(r.id),
              await this.files(baselineId),
            );
          } catch {
            throw new SiteError("static_verified_release_required");
          }
        }
        if (
          rollback &&
          !r.baseline &&
          !(
            await c.query(
              "SELECT 1 FROM platform_static_job WHERE release_id=$1 AND kind IN ('deploy','rollback') AND state='done'",
              [releaseId],
            )
          ).rowCount
        )
          throw new SiteError("static_retained_release_required");
        if (
          !rollback &&
          r.predecessor_id !== site.current_release_id &&
          !r.baseline
        )
          throw new SiteError("static_stale_release");
        const observation = await this.dependencies.provider.observe(b.target);
        if (
          observation.staged ||
          canonicalJson(observation) !== canonicalJson(b.observation)
        )
          throw new SiteError("static_production_drift");
        if (
          !rollback &&
          r.observation_sha256 !== sha256(canonicalJson(observation))
        )
          throw new SiteError("static_stale_release");
        const billing = await this.billing(c, site),
          id = randomUUID();
        await c.query(
          "INSERT INTO platform_static_job(id,site_id,release_id,base_release_id,actor_id,kind,handoff,billing_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            id,
            siteId,
            releaseId,
            site.current_release_id,
            p.id,
            rollback ? "rollback" : "deploy",
            handoff,
            JSON.stringify(billing),
          ],
        );
        await c.query(
          "UPDATE platform_static_release SET approved_by=$2,approved_at=now() WHERE id=$1",
          [releaseId, p.id],
        );
        await this.event(
          c,
          p,
          site,
          rollback ? "site.release.rollback" : "site.release.deploy",
          "queued",
          releaseId,
          id,
          {},
          billing,
        );
        return { siteId, releaseId, jobId: id, state: "queued" };
      },
    );
  }
  async status(actor: string, siteId: string) {
    return this.action(actor, "site.status", async (c, p) => {
      const site = await this.imported(c, p, siteId);
      const releases = (
        await c.query(
          'SELECT id AS "releaseId",source_commit AS "sourceCommit",artifact_sha256 AS "artifactSha256",baseline,state,predecessor_id AS "predecessorId",approved_by AS "approvedBy",approved_at AS "approvedAt",provider_deployment_id AS "deploymentId",created_at AS "createdAt",report FROM platform_static_release WHERE site_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20',
          [siteId],
        )
      ).rows;
      const jobs = (
        await c.query(
          'SELECT id AS "jobId",release_id AS "releaseId",kind,state,error_code AS error,provider_deployment_id AS "deploymentId",created_at AS "createdAt",finished_at AS "finishedAt" FROM platform_static_job WHERE site_id=$1 ORDER BY created_at DESC LIMIT 20',
          [siteId],
        )
      ).rows;
      await this.event(c, p, site, "site.status", "read");
      const b = await this.binding(c, siteId);
      return {
        siteId,
        kind: site.kind,
        cmsMode: "none",
        lifecycle: site.lifecycle,
        currentReleaseId: site.current_release_id,
        handedOff: b.handed_off,
        siteUrl: "https://" + b.target.domain,
        billing: await this.billing(c, site),
        releases,
        jobs,
      };
    });
  }
  async list(
    actor: string,
    input: {
      test?: boolean;
      owner?: string;
      status?: string;
      after?: string;
      limit: number;
    },
  ) {
    return this.action(actor, "sites.list", async (c, p) => {
      const rows = (
        await c.query(
          `SELECT s.id AS "siteId",s.owner_id AS "ownerId",s.slug,s.kind,s.cms_mode AS "cmsMode",s.first_client_pilot AS "firstClientPilot",s.test_mode AS test,s.lifecycle,s.policy_version AS "policyVersion",CASE WHEN s.lifecycle='active' THEN COALESCE(r.state,cur.state,v.state,'staged') ELSE s.lifecycle END AS status
        FROM platform_site s LEFT JOIN platform_static_release r ON r.id=s.current_release_id LEFT JOIN platform_site_spec cur ON cur.id=s.current_spec_id LEFT JOIN LATERAL(SELECT state FROM platform_site_spec WHERE site_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1)v ON true
        WHERE ($1::boolean IS NULL OR s.test_mode=$1) AND ($2::text IS NULL OR s.owner_id=$2) AND ($3::text IS NULL OR CASE WHEN s.lifecycle='active' THEN COALESCE(r.state,cur.state,v.state,'staged') ELSE s.lifecycle END=$3) AND ($4::uuid IS NULL OR s.id>$4) ORDER BY s.id LIMIT $5`,
          [
            input.test ?? null,
            input.owner ?? null,
            input.status ?? null,
            input.after ?? null,
            input.limit,
          ],
        )
      ).rows;
      await c.query(
        "INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'sites.list','platform_site',$2,$3)",
        [
          p.id,
          JSON.stringify({
            tool: "sites.list",
            result: "read",
            test: input.test === true,
          }),
          input.test === true,
        ],
      );
      return {
        sites: rows,
        nextAfter: rows.length === input.limit ? rows.at(-1).siteId : null,
      };
    });
  }
  async refresh(
    actor: string,
    siteId: string,
    period = new Date().toISOString().slice(0, 7),
  ) {
    this.period(period);
    return this.action(actor, "site.costs.refresh", async (c, p) => {
      const site = await this.imported(c, p, siteId);
      const billing = await this.billing(c, site);
      const existing = (
        await c.query(
          "SELECT id,state FROM platform_static_job WHERE site_id=$1 AND kind='usage' AND state IN ('queued','running')",
          [siteId],
        )
      ).rows[0];
      if (existing)
        return { siteId, jobId: existing.id, state: existing.state };
      const id = randomUUID();
      await c.query(
        "INSERT INTO platform_static_job(id,site_id,actor_id,kind,billing_snapshot) VALUES($1,$2,$3,'usage',$4)",
        [id, siteId, p.id, JSON.stringify({ ...billing, period })],
      );
      await this.event(
        c,
        p,
        site,
        "site.costs.refresh",
        "queued",
        null,
        id,
        {},
        billing,
      );
      return { siteId, jobId: id, state: "queued" };
    });
  }
  private period(period: string) {
    if (
      !/^[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(period) ||
      period > new Date().toISOString().slice(0, 7)
    )
      throw new SiteError("invalid_report_period");
  }
  async report(actor: string, siteId: string, period: string) {
    this.period(period);
    return this.action(actor, "site.report", async (c, p) => {
      const site = await this.access(c, p, siteId);
      const from = period + "-01T00:00:00Z",
        to = new Date(
          Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1),
        ).toISOString();
      const operations = (
        await c.query(
          'SELECT id::text,actor_id AS "actorId",kind,result,release_id AS "releaseId",job_id AS "jobId",billing_snapshot AS billing,details,created_at AS "createdAt" FROM platform_site_operation WHERE site_id=$1 AND created_at>=$2 AND created_at<$3 ORDER BY id DESC LIMIT 1000',
          [siteId, from, to],
        )
      ).rows;
      const summary = (
        await c.query(
          "SELECT kind,result,count(*)::int AS count FROM platform_site_operation WHERE site_id=$1 AND created_at>=$2 AND created_at<$3 GROUP BY kind,result",
          [siteId, from, to],
        )
      ).rows;
      const costs =
        (
          await c.query(
            'SELECT data,collected_at AS "collectedAt" FROM platform_site_cost WHERE site_id=$1 AND period=$2 ORDER BY observed_date DESC LIMIT 1',
            [siteId, period],
          )
        ).rows[0] ?? null;
      const eligibility = (
        await c.query(
          'SELECT id::text,eligible,owner_role AS "ownerRole",reason,effective_at AS "effectiveAt" FROM platform_site_billing WHERE site_id=$1 AND effective_at<$3 AND (effective_at>=$2 OR id=(SELECT max(id) FROM platform_site_billing WHERE site_id=$1 AND effective_at<$2)) ORDER BY id',
          [siteId, from, to],
        )
      ).rows;
      const legacy = (
        await c.query(
          "SELECT j.kind,j.state,count(*)::int AS count FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.created_at>=$2 AND j.created_at<$3 GROUP BY j.kind,j.state",
          [siteId, from, to],
        )
      ).rows;
      const changes = (
        await c.query(
          "SELECT count(*)::int AS count FROM platform_site_spec WHERE site_id=$1 AND accounting IS NOT NULL AND applied_at>=$2 AND applied_at<$3",
          [siteId, from, to],
        )
      ).rows[0].count;
      const billing = await this.billing(c, site);
      await this.event(c, p, site, "site.report", "read");
      return {
        siteId,
        period,
        currency: "USD",
        billing,
        eligibility,
        summary,
        operations,
        operationsTruncated: operations.length === 1000,
        catalogJobs: legacy,
        appliedChanges: changes,
        costs: costs ?? {
          data: {
            status: "unavailable",
            basis: "unavailable",
            amount: null,
            reason: "not_collected",
          },
          collectedAt: null,
        },
        verificationCost: {
          status: "unavailable",
          amount: null,
          reason: "provider_verification_cost_not_reported",
        },
        storageCost: {
          status: "unavailable",
          amount: null,
          reason: "shared_bucket_not_allocated",
        },
        sharedPlatformOverhead: { status: "unallocated", amount: null },
        csvUrl: "/api/site-reports/" + siteId + "/" + period + ".csv",
      };
    });
  }
  async csv(actor: string, siteId: string, period: string) {
    const r = await this.report(actor, siteId, period);
    const escape = (v: unknown) => {
      let s = v === null || v === undefined ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const rows: unknown[][] = [
      [
        "record",
        "site_id",
        "period",
        "time",
        "kind",
        "result",
        "actor_id",
        "release_id",
        "billing_eligible",
        "cost_usd",
        "basis",
      ],
      [
        "cost",
        siteId,
        period,
        r.costs.collectedAt,
        "railway",
        r.costs.data.status,
        "",
        "",
        r.billing.eligible,
        r.costs.data.amount,
        r.costs.data.basis,
      ],
      [
        "cost",
        siteId,
        period,
        "",
        "verification",
        "unavailable",
        "",
        "",
        "",
        null,
        "unavailable",
      ],
      [
        "cost",
        siteId,
        period,
        "",
        "storage",
        "unavailable",
        "",
        "",
        "",
        null,
        "unavailable",
      ],
      [
        "cost",
        siteId,
        period,
        "",
        "shared-platform",
        "unallocated",
        "",
        "",
        "",
        null,
        "unallocated",
      ],
    ];
    for (const [kind, amount] of Object.entries(r.costs.data.breakdown ?? {}))
      rows.push([
        "provider-cost-component",
        siteId,
        period,
        r.costs.collectedAt,
        kind,
        r.costs.data.status,
        "",
        "",
        "",
        amount,
        r.costs.data.basis,
      ]);
    for (const [kind, data] of Object.entries(r.costs.data.metrics ?? {}))
      rows.push([
        "resource-usage",
        siteId,
        period,
        r.costs.collectedAt,
        kind,
        r.costs.data.metricsStatus,
        "",
        "",
        "",
        "",
        JSON.stringify(data),
      ]);
    if (r.costs.data.providerBillingPeriod)
      rows.push([
        "provider-period",
        siteId,
        period,
        r.costs.collectedAt,
        "billing-period",
        r.costs.data.status,
        "",
        "",
        "",
        "",
        JSON.stringify(r.costs.data.providerBillingPeriod),
      ]);
    for (const j of r.catalogJobs)
      rows.push([
        "catalog-jobs",
        siteId,
        period,
        "",
        j.kind,
        j.state,
        "",
        "",
        "",
        "",
        String(j.count),
      ]);
    rows.push([
      "applied-changes",
      siteId,
      period,
      "",
      "changes",
      "applied",
      "",
      "",
      "",
      "",
      String(r.appliedChanges),
    ]);
    for (const o of r.operations)
      rows.push([
        "operation",
        siteId,
        period,
        o.createdAt,
        o.kind,
        o.result,
        o.actorId,
        o.releaseId,
        o.billing.eligible,
        "",
        "",
      ]);
    for (const e of r.eligibility)
      rows.push([
        "eligibility",
        siteId,
        period,
        e.effectiveAt,
        e.ownerRole,
        e.reason,
        "",
        "",
        e.eligible,
        "",
        "",
      ]);
    return rows.map((row) => row.map(escape).join(",")).join("\r\n") + "\r\n";
  }
  async artifact(
    actor: string,
    siteId: string,
    releaseId: string,
    name: string,
  ) {
    return this.action(actor, "site.status", async (c, p) => {
      await this.imported(c, p, siteId);
      await this.release(c, releaseId, siteId);
      if (
        !/^(?:report\.json|(?:baseline|candidate)-[a-f0-9]{16}-[0-9]+\.png)$/.test(
          name,
        )
      )
        throw new SiteError("static_artifact_invalid");
      return this.dependencies.objects.get(
        "static/releases/" + releaseId + "/artifacts/" + name,
      );
    });
  }
  async reconcile(
    actor: string,
    siteId: string,
    releaseId: string,
    confirmation: string,
  ) {
    requireConfirmation(
      confirmation,
      "RECONCILE_SITE:" + siteId + ":" + releaseId,
    );
    return this.action(actor, "site.release.reconcile", async (c, p) => {
      const site = await this.imported(c, p, siteId),
        b = await this.binding(c, siteId),
        r = await this.release(c, releaseId, siteId);
      const unknown = (
        await c.query(
          "SELECT * FROM platform_static_job WHERE site_id=$1 AND state='unknown' AND kind IN ('deploy','rollback')",
          [siteId],
        )
      ).rows[0];
      if (
        !unknown ||
        ![unknown.release_id, unknown.base_release_id].includes(releaseId)
      )
        throw new SiteError("static_reconciliation_required");
      const o = await this.dependencies.provider.observe(b.target);
      if (
        o.staged ||
        (o.deploymentStatus && o.deploymentStatus !== "SUCCESS") ||
        o.domainsSha256 !== b.observation.domainsSha256
      )
        throw new SiteError("static_production_drift");
      if (
        ![
          unknown.provider_deployment_id,
          unknown.recovery_deployment_id,
          b.observation.deploymentId,
        ].includes(o.deploymentId)
      )
        throw new SiteError("static_reconciliation_required");
      const files = await this.files(releaseId);
      if (staticDigest(files) !== r.artifact_sha256)
        throw new SiteError("static_artifact_mismatch");
      await this.dependencies.provider.capture(b.target, files);
      const applied =
        releaseId === unknown.release_id &&
        o.deploymentId === unknown.provider_deployment_id;
      await c.query(
        "UPDATE platform_static_job SET state=$2,error_code=NULL,finished_at=now() WHERE id=$1",
        [unknown.id, applied ? "done" : "failed"],
      );
      await c.query(
        "UPDATE platform_static_release SET state='live',provider_deployment_id=$2 WHERE id=$1",
        [releaseId, o.deploymentId],
      );
      await c.query(
        "UPDATE platform_site SET current_release_id=$2 WHERE id=$1",
        [siteId, releaseId],
      );
      await c.query(
        "UPDATE platform_static_binding SET observation=$2,handed_off=$3 WHERE site_id=$1",
        [siteId, JSON.stringify(o), !o.sourceRepository && !o.sourceBranch],
      );
      await this.event(
        c,
        p,
        site,
        "site.release.reconcile",
        applied ? "applied" : "restored",
        releaseId,
        unknown.id,
      );
      return { siteId, releaseId, reconciled: true, applied };
    });
  }
  async processOne(): Promise<boolean> {
    const job = await this.store.transaction(async (c) => {
      const row = (
        await c.query(
          "SELECT * FROM platform_static_job WHERE state='queued' ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (row)
        await c.query(
          "UPDATE platform_static_job SET state='running' WHERE id=$1",
          [row.id],
        );
      return row as Job | undefined;
    });
    if (!job) return false;
    const lease = await this.store.pool.connect();
    const key = "managed-site:" + job.site_id;
    await lease.query("SELECT pg_advisory_lock(hashtext($1))", [key]);
    let providerEntered = false;
    try {
      const context = await this.store.transaction(async (c) => {
        const p = await this.store.currentPrincipal(c, job.actor_id);
        requireRole(
          p,
          job.kind === "usage"
            ? "site.costs.refresh"
            : "site.release." + job.kind,
        );
        const site = await this.imported(c, p, job.site_id, false),
          binding = await this.binding(c, site.id);
        if (
          job.handoff &&
          (p.role !== "superadmin" || !this.dependencies.handoffEnabled)
        )
          throw new SiteError("static_handoff_disabled");
        if (
          ["deploy", "rollback"].includes(job.kind) &&
          !this.dependencies.deploymentEnabled
        )
          throw new SiteError("static_deployment_disabled");
        const release = job.release_id
          ? await this.release(c, job.release_id, site.id)
          : null;
        if (
          job.kind !== "usage" &&
          job.kind !== "verify" &&
          site.current_release_id !== job.base_release_id
        )
          throw new SiteError("static_stale_release");
        const previous = job.billing_snapshot as { period?: string };
        job.billing_snapshot = {
          ...(await this.billing(c, site)),
          ...(previous.period ? { period: previous.period } : {}),
        };
        await c.query(
          "UPDATE platform_static_job SET billing_snapshot=$2 WHERE id=$1",
          [job.id, JSON.stringify(job.billing_snapshot)],
        );
        await this.event(
          c,
          p,
          site,
          "site.release." + job.kind,
          "started",
          job.release_id,
          job.id,
          {},
          job.billing_snapshot,
        );
        return { p, site, binding, release };
      });
      const { site, binding: b, release: r, p } = context;
      if (job.kind === "usage") {
        const period = (job.billing_snapshot as { period: string }).period;
        const data = await this.dependencies.provider.usage(b.target, period);
        await this.store.transaction(async (c) => {
          await c.query(
            "INSERT INTO platform_site_cost(site_id,period,observed_date,data) VALUES($1,$2,(now() AT TIME ZONE 'UTC')::date,$3) ON CONFLICT(site_id,period,observed_date) DO UPDATE SET data=excluded.data,collected_at=now()",
            [site.id, period, JSON.stringify(data)],
          );
          await this.finish(c, p, site, job, "done");
        });
      } else {
        const files = await this.files(r!.id);
        if (staticDigest(files) !== r!.artifact_sha256)
          throw new SiteError("static_artifact_mismatch");
        if (job.kind === "verify") {
          const current = await this.dependencies.provider.observe(b.target);
          if (
            current.staged ||
            canonicalJson(current) !== canonicalJson(b.observation) ||
            sha256(canonicalJson(current)) !== r!.observation_sha256
          )
            throw new SiteError("static_production_drift");
          const baselineId = (
            await this.store.pool.query(
              "SELECT id FROM platform_static_release WHERE site_id=$1 AND baseline",
              [site.id],
            )
          ).rows[0].id;
          const baseline = await this.files(baselineId);
          const report = await this.dependencies.verifier.verify(
            files,
            baseline,
            b.serving,
          );
          for (const [name, data] of Object.entries(report.artifacts)) {
            if (
              !/^(?:report\.json|(?:baseline|candidate)-[a-f0-9]{16}-[0-9]+\.png)$/.test(
                name,
              )
            )
              throw new SiteError("static_artifact_invalid");
            await this.dependencies.objects.put(
              "static/releases/" + r!.id + "/artifacts/" + name,
              Buffer.from(data, "base64"),
            );
          }
          const { artifacts, ...stored } = report;
          await this.store.pool.query(
            "UPDATE platform_static_release SET report=$2 WHERE id=$1",
            [r!.id, JSON.stringify(stored)],
          );
          assertStaticReport(report, files, baseline);
          if (!b.handed_off && staticDigest(files) !== staticDigest(baseline))
            throw new SiteError("static_initial_parity_required");
          if (
            canonicalJson(
              await this.dependencies.provider.observe(b.target),
            ) !== canonicalJson(current)
          )
            throw new SiteError("static_production_drift");
          await this.store.transaction(async (c) => {
            await c.query(
              "UPDATE platform_static_release SET state=$2 WHERE id=$1",
              [r!.id, r!.baseline ? "live" : "verified"],
            );
            await this.finish(c, p, site, job, "done");
          });
        } else {
          // Live role/membership check immediately before entering the provider.
          await this.store.transaction(async (c) => {
            const current = await this.store.currentPrincipal(c, job.actor_id);
            requireRole(current, "site.release." + job.kind);
            await this.imported(c, current, site.id, false);
            await this.event(
              c,
              current,
              site,
              "site.release." + job.kind,
              "provider_started",
              r!.id,
              job.id,
              {},
              job.billing_snapshot,
            );
          });
          providerEntered = true;
          const observed = await this.dependencies.provider.deploy({
            target: b.target,
            serving: b.serving,
            files,
            expected: b.observation,
            handoff: job.handoff,
            onDeployment: async (id) => {
              job.provider_deployment_id = id;
              await this.store.pool.query(
                "UPDATE platform_static_job SET provider_deployment_id=$2 WHERE id=$1",
                [job.id, id],
              );
            },
          });
          const capture = await this.dependencies.provider.capture(
            b.target,
            files,
          );
          if (
            canonicalJson(capture) !==
            canonicalJson((b.baseline as any).evidence)
          )
            throw new SiteError("static_delivery_mismatch");
          await this.store.transaction(async (c) => {
            await c.query(
              "UPDATE platform_static_release SET state='live',provider_deployment_id=$2 WHERE id=$1",
              [r!.id, observed.deploymentId],
            );
            await c.query(
              "UPDATE platform_site SET current_release_id=$2 WHERE id=$1",
              [site.id, r!.id],
            );
            await c.query(
              "UPDATE platform_static_binding SET observation=$2,handed_off=true WHERE site_id=$1",
              [site.id, JSON.stringify(observed)],
            );
            await this.finish(c, p, site, job, "done");
          });
        }
      }
    } catch (error) {
      const code =
        error instanceof SiteError ? error.code : "static_operation_failed";
      if (
        providerEntered &&
        ["static_deployment_failed", "static_delivery_mismatch"].includes(code)
      ) {
        try {
          await this.restorePrevious(job, code);
          return true;
        } catch {}
      }
      const beforeMutation = [
        "static_production_drift",
        "static_live_deployment_required",
        "static_handoff_required",
      ];
      const state =
        providerEntered && !beforeMutation.includes(code)
          ? "unknown"
          : "failed";
      await this.store.transaction(async (c) => {
        await c.query(
          "UPDATE platform_static_job SET state=$2,error_code=$3,finished_at=now() WHERE id=$1",
          [job.id, state, code],
        );
        if (job.release_id)
          await c.query(
            "UPDATE platform_static_release SET state=CASE WHEN baseline THEN state ELSE $2 END WHERE id=$1",
            [job.release_id, state === "unknown" ? "unknown" : "failed"],
          );
        if (job.kind === "verify" && job.release_id)
          await c.query(
            "UPDATE platform_static_release SET report=CASE WHEN report IS NULL THEN NULL ELSE jsonb_set(report,'{passed}','false') END WHERE id=$1",
            [job.release_id],
          );
        const site = (
          await c.query("SELECT * FROM platform_site WHERE id=$1", [
            job.site_id,
          ])
        ).rows[0];
        await this.event(
          c,
          { id: job.actor_id, role: "client", testMode: false },
          site,
          "site.release." + job.kind,
          state,
          job.release_id,
          job.id,
          { error: code },
          job.billing_snapshot,
        );
      });
    } finally {
      await lease.query("SELECT pg_advisory_unlock(hashtext($1))", [key]);
      lease.release();
    }
    return true;
  }
  private async restorePrevious(job: Job, error: string) {
    // Automatic recovery is allowed only for this job's positively identified
    // deployment. A competing deployment or ambiguous upload blocks recovery.
    if (!job.base_release_id || !job.provider_deployment_id)
      throw new SiteError("static_reconciliation_required");
    const b = await this.store.transaction((c) => this.binding(c, job.site_id));
    const observed = await this.dependencies.provider.observe(b.target);
    if (
      observed.deploymentId !== job.provider_deployment_id ||
      observed.staged ||
      observed.sourceRepository ||
      observed.sourceBranch ||
      observed.domainsSha256 !== b.observation.domainsSha256 ||
      observed.servingSha256 !== b.observation.servingSha256
    )
      throw new SiteError("static_production_drift");
    const site = (
      await this.store.pool.query("SELECT * FROM platform_site WHERE id=$1", [
        job.site_id,
      ])
    ).rows[0] as Site;
    const previous = (
      await this.store.pool.query(
        "SELECT * FROM platform_static_release WHERE id=$1 AND site_id=$2",
        [job.base_release_id, job.site_id],
      )
    ).rows[0] as Release;
    const files = await this.files(previous.id);
    if (staticDigest(files) !== previous.artifact_sha256)
      throw new SiteError("static_artifact_mismatch");
    const p = { id: job.actor_id, role: "client" as const, testMode: false };
    await this.store.transaction((c) =>
      this.event(
        c,
        p,
        site,
        "site.release.recovery",
        "started",
        previous.id,
        job.id,
        {},
        job.billing_snapshot,
      ),
    );
    const restored = await this.dependencies.provider.deploy({
      target: b.target,
      serving: b.serving,
      files,
      expected: observed,
      handoff: false,
      recovery: true,
      onDeployment: async (id) => {
        await this.store.pool.query(
          "UPDATE platform_static_job SET recovery_deployment_id=$2 WHERE id=$1",
          [job.id, id],
        );
      },
    });
    if (
      canonicalJson(
        await this.dependencies.provider.capture(b.target, files),
      ) !== canonicalJson((b.baseline as any).evidence)
    )
      throw new SiteError("static_delivery_mismatch");
    await this.store.transaction(async (c) => {
      await c.query(
        "UPDATE platform_static_job SET state='failed',error_code=$2,finished_at=now() WHERE id=$1",
        [job.id, error],
      );
      if (job.release_id !== previous.id)
        await c.query(
          "UPDATE platform_static_release SET state='failed' WHERE id=$1",
          [job.release_id],
        );
      await c.query(
        "UPDATE platform_static_release SET state='live',provider_deployment_id=$2 WHERE id=$1",
        [previous.id, restored.deploymentId],
      );
      await c.query(
        "UPDATE platform_site SET current_release_id=$2 WHERE id=$1",
        [site.id, previous.id],
      );
      await c.query(
        "UPDATE platform_static_binding SET observation=$2,handed_off=true WHERE site_id=$1",
        [site.id, JSON.stringify(restored)],
      );
      await this.event(
        c,
        p,
        site,
        "site.release.recovery",
        "restored",
        previous.id,
        job.id,
        {},
        job.billing_snapshot,
      );
    });
  }
  private async finish(
    c: PoolClient,
    p: Principal,
    site: Site,
    job: Job,
    state: string,
  ) {
    await c.query(
      "UPDATE platform_static_job SET state=$2,finished_at=now() WHERE id=$1",
      [job.id, state],
    );
    await this.event(
      c,
      p,
      site,
      "site.release." + job.kind,
      state,
      job.release_id,
      job.id,
      {},
      job.billing_snapshot,
    );
  }
  async recoverInterrupted() {
    await this.store.transaction(async (c) => {
      const rows = (
        await c.query(
          "UPDATE platform_static_job SET state=CASE WHEN kind IN ('deploy','rollback') THEN 'unknown' ELSE 'failed' END,error_code='worker_interrupted',finished_at=now() WHERE state='running' RETURNING *",
        )
      ).rows;
      for (const job of rows) {
        if (job.release_id)
          await c.query(
            "UPDATE platform_static_release SET state=CASE WHEN baseline THEN state ELSE $2 END WHERE id=$1",
            [job.release_id, job.state],
          );
        const site = (
          await c.query("SELECT * FROM platform_site WHERE id=$1", [
            job.site_id,
          ])
        ).rows[0];
        await this.event(
          c,
          { id: job.actor_id, role: "client", testMode: false },
          site,
          "site.worker.recovery",
          job.state,
          job.release_id,
          job.id,
          {},
          job.billing_snapshot,
        );
      }
    });
  }
  async collectDue() {
    const rows = (
      await this.store.pool.query(
        "SELECT s.id,s.owner_id FROM platform_site s WHERE s.kind='imported-static' AND s.lifecycle='active' AND NOT EXISTS(SELECT 1 FROM platform_site_cost c WHERE c.site_id=s.id AND c.observed_date=(now() AT TIME ZONE 'UTC')::date AND c.period=to_char(now() AT TIME ZONE 'UTC','YYYY-MM'))",
      )
    ).rows;
    for (const s of rows) {
      try {
        await this.refresh(s.owner_id, s.id);
      } catch {
        console.error(
          JSON.stringify({ event: "static.costs.collection.unavailable" }),
        );
      }
    }
  }
  async startWorker() {
    const lease = await this.store.pool.connect();
    const lock = "a2aviary-static-worker";
    if (
      !(
        await lease.query(
          "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
          [lock],
        )
      ).rows[0].locked
    ) {
      lease.release();
      return async () => {};
    }
    let running = true;
    lease.on("error", () => {
      running = false;
    });
    await this.recoverInterrupted();
    let nextCollection = 0;
    const loop = (async () => {
      try {
        while (running) {
          try {
            if (Date.now() >= nextCollection) {
              await this.collectDue();
              nextCollection = Date.now() + 60000;
            }
            if (!(await this.processOne()))
              await new Promise((r) => setTimeout(r, 1000));
          } catch {
            console.error(JSON.stringify({ event: "static.worker.failed" }));
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      } finally {
        try {
          await lease.query("SELECT pg_advisory_unlock(hashtext($1))", [lock]);
        } finally {
          lease.release();
        }
      }
    })();
    return async () => {
      running = false;
      await loop;
    };
  }
}
