export const publicPages = ['terms', 'privacy', 'refunds', 'pricing'];

export function publicNavigation() {
  return `<nav class="policy-links" aria-label="Policies and contact"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refunds">Refunds</a><a href="/pricing">Pricing</a><a href="/#contact">Contact</a><a href="/costs">What it costs</a><a href="/architecture">Architecture</a></nav>`;
}
