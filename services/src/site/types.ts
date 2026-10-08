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
  cms: { collections: string[] };
}
export interface ValidationError { path: string; rule: string; limit: unknown; suggestion: string; policyPath?: string; actual?: unknown; operationIndex?: number }
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };
export interface ChangeAccounting { pagesTouched: number; blocksModified: number; globalOperations: number; monthlyRequestsRemaining: number }
/** Trusted caller state, never read from the client request. No reservation is made here. */
export interface ChangeContext { month: string; appliedRequests: number; now: Date }
