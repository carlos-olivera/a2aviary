import { publicPages, publicNavigation } from './site-navigation.js';

const repository = 'https://github.com/carlos-olivera/a2aviary';
const contact = '<a href="mailto:hello@a2aviary.io">hello@a2aviary.io</a>';
const pages = {
  terms: {
    title: 'Terms of Service',
    description: 'Terms for the a2aviary website and authorized agent work, with commercial services still unavailable.',
    sections: [
      ['Who we are', `<p>a2aviary is a project operated by Carlos Olivera Terrazas. We are building a digital services agency for websites, applications, and other digital services. These terms describe use of this website and the mandate for authorized service work.</p>`],
      ['Current status and commercial services', `<p>The signed-email operating foundation can analyze a website brief for registered, authorized agents. Website generation and broader production services remain future work. Nothing is for sale on this site: there is no live checkout, and Paddle is not yet our merchant of record.</p><p>If commercial services are offered later, their scope, price, and purchase terms will be disclosed separately. Paddle would act as merchant of record only when enabled and approved; its applicable buyer terms would also govern purchases made through Paddle.</p>`],
      ['Human mandate and consent', `<p>A human must authorize their agent to act for them, share materials they have permission to use, and define the permitted scope, destinations, budget, and approvals. A valid agent signature authenticates a request; it does not create authority beyond that mandate. Only registered signed requests within their grants can create work.</p><p>Brief analysis is discovery, not permission to build, publish, deploy, spend beyond an agreed limit, or contact third parties. Missing inputs, assumptions, or recommendations do not authorize more work. Execution and revisions require their own agreed scope and authorization.</p>`],
      ['Budgets and review', `<p>Work is bounded by the authorized task and operating limits. Work may be refused, paused, or stopped if authorization, inputs, or budget are insufficient. Monitored provider spending thresholds are not hard billing caps. Any future commercial fees must be agreed before paid work starts; internal operating allowances are not customer prices.</p><p>Review AI-assisted findings and deliverables before relying on them or authorizing execution. We do not guarantee accuracy, uninterrupted availability, business results, rankings, revenue, or other outcomes. Nothing here limits rights or remedies that applicable law requires.</p>`],
      ['Open source and separate services', `<p>The project source and documentation are available under the <a href="${repository}/blob/main/LICENSE">Apache License 2.0</a>. Dependency licenses remain applicable. That license does not grant rights to client assets or third-party trademarks, approve the explored visual identity, or include commercial operation, support, or deliverables. Any future commercial service is sold separately.</p>`],
      ['Language, privacy, and contact', `<p>English is the governing language of these pages; translations are for convenience, subject to mandatory legal requirements. See our <a href="/privacy">Privacy Policy</a> and <a href="/refunds">Refund Policy</a>. Questions about terms or authorization: ${contact}.</p>`],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    description: 'How a2aviary handles marketing-site requests and authorized signed-email brief data, including retention and privacy requests.',
    sections: [
      ['Who is responsible', `<p>Carlos Olivera Terrazas operates a2aviary. For privacy questions or requests to access, correct, or delete personal data, contact ${contact}. We may need to verify your authority before changing or disclosing records.</p>`],
      ['Marketing website', `<p>This static marketing site has no account registration, contact form, analytics, tracking pixels, or advertising cookies. Fonts and site assets are self-hosted. AWS provides hosting and delivery; serving a request involves network information such as an IP address, requested URL, and browser HTTP headers. Provider security and operational processing is separate from site analytics.</p><p>A mailto link opens your own email application. If you send email, you share your address, message, and any attachments with the recipient and email providers. Human support mailbox delivery and forwarding have not yet been verified.</p>`],
      ['Signed-email operating foundation', `<p>The agent pipeline is separate from human support. It handles sender and reply addresses, message metadata and signed payloads, authorization grants and public keys, project/task identifiers, brief materials, task state, results, and operational audit records. These are used to authenticate requests, enforce the human mandate and budget, analyze briefs, return signed replies, and recover interrupted work.</p><p>AWS stores and processes operational data. OpenAI processes the authorized brief and relevant task context for analysis. Research runs only when authorized and may send relevant queries to research providers; do not submit secrets or materials your mandate does not permit sharing. The agent address is for registered signed requests, not human support.</p>`],
      ['Retention and deletion', `<p>The configured application retention is seven days for pending or rejected content, thirty days for accepted content, raw accepted email, and results, and ninety days for redacted audit/replay records. Lifecycle and database TTL expiration are asynchronous, not exact deletion deadlines. Backups and provider retention are separate; application expiry does not guarantee immediate deletion of every provider copy.</p><p>Provider-session cleanup is implemented and its observed behavior is recorded separately. See the <a href="${repository}/blob/main/docs/runbooks.md#private-content-retention">retention runbook</a>, <a href="${repository}/blob/main/docs/operating-foundation.md">operating foundation</a>, and <a href="${repository}/blob/main/docs/release-verification.md">release evidence</a>. These agent-pipeline periods do not establish a retention schedule for a future human support mailbox.</p>`],
      ['Sharing and future payments', `<p>We do not sell personal data. Data is shared with service providers as needed for authorized work, delivery, security, and applicable legal obligations. There is no live checkout and Paddle is not yet our merchant of record. If enabled later, Paddle will process purchase and payment information under its own <a href="https://www.paddle.com/legal/privacy">privacy notice</a>; payment-data handling will be disclosed before sales open.</p>`],
    ],
  },
  refunds: {
    title: 'Refund Policy',
    description: 'Refund rules for future a2aviary commercial work and unused prepaid credit; purchases are not currently available.',
    sections: [
      ['No purchases yet', `<p>Nothing is currently for sale. There is no live checkout, prepaid credit offering, or payment operation, and Paddle is not yet our merchant of record. The rules below describe the intended policy for future commercial services and do not imply that purchases are available today.</p>`],
      ['Unused credit and cancellation', `<p>Unused prepaid credit will be refundable on request. Cancel before authorized work starts to request a refund of the unused payment. If part of a balance has been used, the unused remainder will be refundable. No prepaid balance is currently offered.</p>`],
      ['Work already started or delivered', `<p>Authorized work already started or delivered remains payable for the portion performed under the agreed scope and price; cancelling does not make that portion unused credit. Discovery and execution are separate authorizations. We will explain the work performed and remaining balance when reviewing a request.</p><p>This does not remove mandatory cancellation rights or remedies for defective, misdescribed, or undelivered services. If work did not start or an authorized service cannot be delivered, any unused payment remains refundable.</p>`],
      ['Requests and future Paddle purchases', `<p>Send a refund or cancellation request to ${contact}, identifying the relevant order or project and what you want cancelled. Do not email payment-card details.</p><p>When Paddle is enabled as merchant of record, approved payment refunds will be processed through Paddle, subject to its <a href="https://www.paddle.com/legal/buyer-terms">buyer terms</a> and applicable law. Billing disputes and chargebacks for Paddle purchases will be handled through Paddle and the relevant payment provider. Statutory rights and Paddle's applicable buyer protections take precedence over conflicting provisions here. No Paddle refund or chargeback process is active for a2aviary today.</p>`],
    ],
  },
  pricing: {
    title: 'Pricing — not for sale yet',
    description: 'a2aviary discovery and future digital services: no published prices, live checkout, or merchant of record yet.',
    sections: [
      ['Not for sale yet', `<p>There is no Paddle catalog yet and nothing is for sale. No live checkout is available, Paddle is not yet our merchant of record, and proposed prices are not available. Commercial prices and checkout will be published when Paddle is approved and the catalog and service terms are ready.</p>`],
      ['Discovery: website brief analysis', `<p>The signed-email operating foundation has verified brief analysis for registered, authorized agents. Its capability is <code>website.brief.analyze</code>. A bounded analysis report identifies goals, audience, suggested page structure, missing inputs, assumptions, and acceptance criteria. Research citations are included when research is authorized and performed.</p><p>This is discovery: it does not build or deliver a website and does not authorize execution. A commercial discovery offering is not available yet. Existing internal model allowances and project operating costs are not selling prices.</p>`],
      ['Future digital services', `<p>The agency vision extends to website production, applications, and other digital services, with previews, revisions, and delivery within a human mandate. These capabilities remain future work. Their scope, acceptance criteria, budgets, and prices will be agreed separately before any paid execution; they are not available to purchase here.</p>`],
      ['Open source and questions', `<p>The <a href="${repository}">open-source project</a> is available under Apache 2.0; commercial services, when offered, will be separate. Our <a href="/costs">operating cost sheet</a> describes project costs and estimates, not customer pricing.</p><p>For questions, contact ${contact}. Read the <a href="/terms">Terms of Service</a>, <a href="/privacy">Privacy Policy</a>, and <a href="/refunds">Refund Policy</a>.</p>`],
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
  <meta property="og:image:alt" content="a2aviary. Your agent. Our agency. Created by Carlos Olivera Terrazas, with the complete circuit-inspired bird on charcoal.">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:creator" content="@carlos_olivera">
  <meta name="twitter:title" content="${escape(title)} | a2aviary">
  <meta name="twitter:description" content="${escape(description)}">
  <meta name="twitter:image" content="https://a2aviary.io/social-preview.png">
  <meta name="twitter:image:alt" content="a2aviary. Your agent. Our agency. Created by Carlos Olivera Terrazas, with the complete circuit-inspired bird on charcoal.">
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
      <p class="updated">Updated <time datetime="2026-10-05">October 5, 2026</time>. Commercial services are not yet offered.</p>
      ${sections.map(([heading, content]) => `<section><h2>${escape(heading)}</h2>${content}</section>`).join('\n      ')}
    </main>
    <footer>${publicNavigation()}<p>Created by Carlos Olivera Terrazas. <a href="/">Homepage</a> · <a href="${repository}/blob/main/LICENSE">Apache 2.0 source</a></p></footer>
  </div>
</body>
</html>
`;
}
