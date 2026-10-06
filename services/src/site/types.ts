export interface Approval { approved: true; approvedAt: string; specSha256: string }
export type Link = { label: string; pageId: string; sectionId?: string } | { label: string; url: string };
export interface Asset { id: string; format: 'webp' | 'jpeg' | 'png'; bytes: number; width: number; height: number; alt: string; sha256: string }
export interface Block { id: string; component: string; variant: string; props: Record<string, unknown> }
export interface Section { id: string; blocks: Block[] }
export interface Seo { title: string; description: string; socialImage?: string }
export interface Page { id: string; path: string; seo: Seo; sections: Section[] }
export interface Tokens { colors: Record<string, string>; fonts: { heading: string; body: string }; spacing: number; radius: number }
export interface Navigation { primary: Link[]; footer: Link[] }
export interface SiteSpec {
  contractVersion: string; planId: string; policyVersion: string;
  pages: Page[]; tokens: Tokens; navigation: Navigation; assets: Asset[];
  cms: { collections: string[] }; approval: Approval;
  preview?: { artifactId: string; sha256: string };
}
export type Operation =
  | { op: 'add-block'; pageId: string; sectionId: string; index: number; block: Block }
  | { op: 'update-block'; pageId: string; sectionId: string; blockId: string; block: Block }
  | { op: 'remove-block'; pageId: string; sectionId: string; blockId: string }
  | { op: 'add-page'; page: Page }
  | { op: 'update-page-seo'; pageId: string; seo: Seo }
  | { op: 'update-tokens'; tokens: Tokens }
  | { op: 'update-navigation'; navigation: Navigation };
export interface ChangeRequest {
  contractVersion: string; planId: string; policyVersion: string; baseSpecSha256: string;
  operations: Operation[]; assets: Asset[]; approval: Approval;
  preview?: { artifactId: string; sha256: string };
}
export interface ValidationError { path: string; rule: string; limit: unknown; suggestion: string; policyPath?: string }
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };
export interface ChangeAccounting { pagesTouched: number; blocksModified: number; globalOperations: number; monthlyRequestsRemaining: number }
/** Trusted caller state, never read from the client request. No reservation is made here. */
export interface ChangeContext { month: string; appliedRequests: number; now: Date }
