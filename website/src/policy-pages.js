import { publicPages, publicNavigation } from './site-navigation.js';

const repository = 'https://github.com/carlos-olivera/a2aviary';
const contact = '<a href="mailto:hello@a2aviary.io">hello@a2aviary.io</a>';
const pages = {
  terms: {
    title: 'Terms of Service',
    description: 'Terms for a2aviary software subscriptions, usage credits, and human-authorized agent permissions. Basic launches soon.',
    sections: [
      ['Who we are', `<p>a2aviary is an open-source software platform operated by Carlos Olivera Terrazas. These terms describe use of this website and the permissions that govern agent requests to the platform.</p>`],
      ['Software subscriptions', `<p><a href="/pricing">a2aviary Basic</a> is our upcoming software subscription for one basic marketing site. When Basic launches, your agent’s requests will be processed automatically by the software within your plan limits, usage credits, and granted permissions. Website production and hosting through Basic are coming soon. Apps, MCP services, and plugins are coming later.</p><p>Credit amounts, access terms, billing, renewal, cancellation, and refund terms will be published before checkout opens. Payments will be processed by our merchant of record, whose buyer terms also apply.</p>`],
      ['Agent permissions and consent', `<p>A human must authorize their agent, provide materials they have permission to use, and grant the software permissions for the intended actions, destinations, spending limits, and approvals. A valid agent signature authenticates a request; it does not expand those permissions. Only registered signed requests within their grants can initiate supported actions.</p><p>Actions are limited by your plan, your usage credits, and the permissions you grant your agent. Missing inputs, assumptions, or recommendations do not grant additional permissions. The currently available signed-agent capability analyzes website briefs; it does not build or deploy sites.</p>`],
      ['Usage limits and review', `<p>The software may refuse, pause, or stop requests when permissions, inputs, or available credits are insufficient. Plan prices and credit allowances will be disclosed before checkout opens. Internal project operating allowances are separate from subscription credits; monitored provider spending thresholds are not hard billing caps.</p><p>Review AI-assisted findings and outputs before relying on them. We do not guarantee accuracy, uninterrupted availability, business results, rankings, revenue, or other outcomes. Nothing here limits rights or remedies that applicable law requires.</p>`],
      ['Open source and platform access', `<p>The project source and documentation are available under the <a href="${repository}/blob/main/LICENSE">Apache License 2.0</a>. Dependency licenses remain applicable. A software subscription provides hosted platform access and does not replace or restrict those open-source rights. The source license does not include hosted operation or support, grant rights to your assets or third-party trademarks, or approve the explored visual identity.</p>`],
      ['Language, privacy, and contact', `<p>English is the governing language of these pages; translations are for convenience, subject to mandatory legal requirements. See our <a href="/privacy">Privacy Policy</a> and <a href="/refunds">Refund Policy</a>. Questions about terms or agent permissions: ${contact}.</p>`],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How a2aviary handles website requests, support email, and authorized signed-agent data, including retention and privacy requests.',
    sections: [
      ['Who is responsible', `<p>Carlos Olivera Terrazas operates a2aviary. For privacy questions or requests to access, correct, or delete personal data, contact ${contact}. We may need to verify your authority before changing or disclosing records.</p>`],
      ['Marketing website', `<p>This static marketing site has no account registration, contact form, analytics, tracking pixels, or advertising cookies. Fonts and site assets are self-hosted. AWS provides hosting and delivery; serving a request involves network information such as an IP address, requested URL, and browser HTTP headers. Provider security and operational processing is separate from site analytics.</p><p>A mailto link opens your own email application. If you send email, you share your address, message, and any attachments with the recipient and email providers.</p>`],
      ['Support email', `<p>Support email is separate from the signed-agent pipeline. The prepared AWS forwarding configuration routes messages addressed to hello@a2aviary.io to the operator’s inbox, including the original message and attachments. It processes sender and reply addresses, message content, attachments, and delivery metadata for support and privacy requests.</p><p>Under this configuration, repository-controlled support message storage and delivery records expire after seven days, redacted operational logs after thirty days, and failed-delivery queue entries after fourteen days. Expiry is asynchronous. Copies in the operator’s inbox and email-provider retention are separate from these application periods. Forwarding deployment and operation remain pending; this configuration does not establish a retention period for inbox copies.</p>`],
      ['Signed-agent operating foundation', `<p>The agent pipeline handles sender and reply addresses, message metadata and signed payloads, authorization grants and public keys, project/task identifiers, brief materials, task state, results, and operational audit records. These are used to authenticate requests, enforce granted permissions and budgets, analyze briefs, return signed replies, and recover interrupted work.</p><p>AWS stores and processes operational data. OpenAI processes the authorized brief and relevant task context for analysis. Research runs only when authorized and may send relevant queries to research providers; do not submit secrets or materials your permissions do not permit sharing. The agent address is for registered signed requests, not human support.</p>`],
      ['Retention and deletion', `<p>The configured agent application retention is seven days for pending or rejected content, thirty days for accepted content, raw accepted email, and results, and ninety days for redacted audit/replay records. Lifecycle and database TTL expiration are asynchronous, not exact deletion deadlines. Backups and provider retention are separate; application expiry does not guarantee immediate deletion of every provider copy.</p><p>Provider-session cleanup is implemented and its observed behavior is recorded separately. See the <a href="${repository}/blob/main/docs/runbooks.md#private-content-retention">retention runbook</a>, <a href="${repository}/blob/main/docs/operating-foundation.md">operating foundation</a>, and <a href="${repository}/blob/main/docs/release-verification.md">release evidence</a>.</p>`],
      ['Sharing and payments', `<p>We do not sell personal data. Data is shared with service providers as needed for permitted processing, delivery, security, and applicable legal obligations. When payments are enabled, our payment provider will process purchase and payment information under its own privacy notice. Subscription and payment-data handling, including the provider’s privacy notice, will be published before checkout opens.</p>`],
    ],
  },
  refunds: {
    title: 'Refund Policy',
    description: 'a2aviary Basic subscription cancellation, renewal, refund, and unused-credit terms will be published before checkout opens.',
    sections: [
      ['Subscription cancellation and refunds', `<p><a href="/pricing">a2aviary Basic</a> is an upcoming software subscription. Renewal, cancellation, refund eligibility, request procedures, and the treatment of unused credits will be published before checkout opens, so you can review them before subscribing.</p><p>Payments will be processed by our merchant of record, whose buyer terms also apply. Nothing here removes mandatory cancellation rights or remedies required by applicable law.</p>`],
      ['Questions and contact', `<p>For subscription, cancellation, or refund questions, contact ${contact}. Do not email payment-card details.</p>`],
    ],
  },
  pricing: {
    title: 'Pricing — Coming soon',
    description: 'a2aviary Basic: $10/month or $100/year for a software subscription with one basic marketing site. Launching soon; checkout opens when payments are enabled.',
    sections: [
      ['a2aviary Basic', `<div class="basic-plan"><p class="plan-price">$10/month · $100/year</p><p id="basic-status" class="plan-status">Launching soon. Checkout opens when payments are enabled.</p><p>A software subscription for one basic marketing site, built and hosted from the site kit your AI assistant prepares. Website production and hosting through Basic are coming soon.</p><p>When Basic launches:</p><ol class="plan-flow"><li>Subscribe to Basic.</li><li>Your AI assistant submits a site kit containing content, brand, and pages.</li><li>The software validates the kit, builds, deploys, and hosts one basic marketing site.</li><li>Updates from your assistant are applied automatically within monthly usage credits for AI tokens and bandwidth.</li></ol><p>Credit amounts and subscription terms will be published before checkout opens. Actions stay within your plan limits and the permissions you grant your agent.</p><button class="coming-soon" type="button" disabled aria-describedby="basic-status">Coming soon</button></div>`],
      ['Websites first; more coming later', `<p>Websites come first. Apps, MCP services, plugins, and other digital capabilities are coming later.</p>`],
      ['Available now: website brief analysis', `<p>The signed-agent operating foundation supports verified website brief analysis for registered, authorized agents. It identifies goals, audience, suggested page structure, missing inputs, assumptions, and acceptance criteria, with research citations when research is authorized and performed. Brief analysis does not build, deploy, or host a website.</p>`],
      ['Open source and questions', `<p>The <a href="${repository}">source project</a> is available under Apache 2.0; a software subscription does not replace those rights. Our <a href="/costs">operating cost sheet</a> describes project costs and estimates, separate from subscription pricing.</p><p>For questions, contact ${contact}. Read the <a href="/terms">Terms of Service</a>, <a href="/privacy">Privacy Policy</a>, and <a href="/refunds">Refund Policy</a>.</p>`],
    ],
  },
};

const escape = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function renderPolicyPage(path) {
  if (!publicPages.includes(path)) throw new Error('Unknown public page');
  const { title, description, sections } = pages[path];
  const canonical = `https://a2aviary.io/${path}`;
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': canonical + '#page', url: canonical, name: title, description, inLanguage: 'en', isPartOf: { '@id': 'https://a2aviary.io/#website' }, publisher: { '@id': 'https://a2aviary.io/#organization' } },
      { '@type': 'WebSite', '@id': 'https://a2aviary.io/#website', url: 'https://a2aviary.io/', name: 'a2aviary', inLanguage: 'en', publisher: { '@id': 'https://a2aviary.io/#organization' } },
      { '@type': 'Organization', '@id': 'https://a2aviary.io/#organization', name: 'a2aviary', url: 'https://a2aviary.io/', email: 'hello@a2aviary.io', founder: { '@id': 'https://a2aviary.io/#carlos-olivera' } },
      { '@type': 'Person', '@id': 'https://a2aviary.io/#carlos-olivera', name: 'Carlos Olivera Terrazas', jobTitle: 'Founder & Principal Architect' },
    ],
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0B1220">
  <title>${escape(title)} | a2aviary</title>
  <meta name="description" content="${escape(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="a2aviary">
  <meta property="og:locale" content="en_US">
  <meta property="og:title" content="${escape(title)} | a2aviary">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:image" content="https://a2aviary.io/social-preview.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:alt" content="a2aviary. Your agent. Your control. Our build. Created by Carlos Olivera Terrazas, with the complete circuit-inspired bird on charcoal.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:creator" content="@carlos_olivera">
  <meta name="twitter:title" content="${escape(title)} | a2aviary">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="https://a2aviary.io/social-preview.png">
  <meta name="twitter:image:alt" content="a2aviary. Your agent. Your control. Our build. Created by Carlos Olivera Terrazas, with the complete circuit-inspired bird on charcoal.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/policies.css">
  <script type="application/ld+json">${JSON.stringify(graph)}</script>
</head>
<body>
  <a class="skip-link" href="#content">Skip to content</a>
  <div class="page">
    <header><a class="brand" href="/" aria-label="a2aviary homepage">a2aviary</a><a href="/costs">What it costs</a></header>
    <main id="content" tabindex="-1">
      <h1>${escape(title)}</h1>
      <p class="updated">Updated <time datetime="2026-10-05">October 5, 2026</time>.</p>
      ${sections.map(([heading, content]) => `<section><h2>${escape(heading)}</h2>${content}</section>`).join('\n      ')}
    </main>
    <footer>${publicNavigation()}<p>Created by Carlos Olivera Terrazas. <a href="/">Homepage</a> · <a href="${repository}/blob/main/LICENSE">Apache 2.0 source</a></p></footer>
  </div>
</body>
</html>
`;
}
