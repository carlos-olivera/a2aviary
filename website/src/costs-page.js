import { publicNavigation } from './site-navigation.js';

const repository = 'https://github.com/carlos-olivera/a2aviary/blob/main/';

function escape(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

// Link only explicit provider URLs and repository paths; keep the source text intact.
function sourceLinks(source) {
  return source.split(/(https?:\/\/[^\s;]+|(?:docs|infra)\/[\w./-]+\.(?:md|ts))/g).map(part => {
    const href = /^https?:\/\//.test(part) ? part : /^(?:docs|infra)\//.test(part) ? repository + part : null;
    return href ? `<a href="${escape(href)}">${escape(part)}</a>` : escape(part);
  }).join('');
}

export function formatUsd(amount) {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 20 });
}

function amount(item) {
  if (item.amountUsd != null) return formatUsd(item.amountUsd);
  if (item.amountUsdMin != null && item.amountUsdMax != null) {
    return `${formatUsd(item.amountUsdMin)}–${formatUsd(item.amountUsdMax)}`;
  }
  return 'Not yet known / no dollar figure recorded';
}

export function renderCosts(data) {
  const { totals } = data;
  const rows = data.items.map(item => `<tr id="${escape(item.id)}">
    <th scope="row">${escape(item.name)}</th>
    <td>${escape(item.provider)}</td>
    <td>${escape(item.kind)}<br><span class="period">${escape(item.period)}</span></td>
    <td class="amount">${escape(amount(item))}</td>
    <td><span class="status">${escape(item.status)}</span></td>
    <td class="source">${sourceLinks(item.source)}${item.note ? `<p class="note">${escape(item.note)}</p>` : ''}</td>
  </tr>`).join('\n');
  const exclusions = totals.spentToDateExcludes.map(id => {
    const item = data.items.find(item => item.id === id);
    return `<li><a href="#${escape(id)}">${escape(item?.name ?? id)}</a> (<code>${escape(id)}</code>)</li>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0B1220">
  <title>What a2aviary costs</title>
  <meta name="description" content="Known a2aviary costs, estimates, allowances, sources, and amounts still to confirm.">
  <link rel="canonical" href="https://a2aviary.io/costs">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/costs.css">
</head>
<body>
  <a class="skip-link" href="#cost-sheet">Skip to the cost sheet</a>
  <div class="page">
    <header>
      <a class="brand" href="/" aria-label="a2aviary homepage"><img src="/brand/a2aviary-logo-inverse.svg" width="1923" height="456" alt="a2aviary"></a>
      <nav aria-label="Cost resources"><a href="${repository}COSTS.md">Repository cost sheet</a><a href="/costs.json">Raw JSON</a></nav>
    </header>
    <main>
      <h1>What a2aviary costs</h1>
      <p class="updated">Updated <time datetime="${escape(data.updatedAt)}">${escape(data.updatedAt)}</time> (${escape(data.currency)}, excluding taxes). Draft for owner review.</p>
      <p>Provider invoices are the authority. Token counts and ledger amounts from launch tests are not a monthly bill. We have no traffic, analytics or tracking figures, and we don't publish any.</p>
      <details class="legend" open>
        <summary>How to read the statuses</summary>
        <dl>
          <dt>confirmed</dt><dd>Fixed by configuration plus published pricing, or confirmed by the owner.</dd>
          <dt>estimated</dt><dd>Calculated from published prices and assumptions; token counts can be measured while dollars are estimated.</dd>
          <dt>measured</dt><dd>Reported by a provider for real usage; measured tokens do not establish a dollar bill.</dd>
          <dt>budgeted</dt><dd>An allowance, reservation, or ceiling, not spend. AWS budget notifications are alerts, not spending caps.</dd>
          <dt>to-confirm</dt><dd>Requires an invoice or billing dashboard check.</dd>
        </dl>
      </details>
      <section aria-labelledby="cost-sheet">
        <h2 id="cost-sheet" tabindex="-1">Cost sheet</h2>
        <p id="table-help">Amounts are in ${escape(data.currency)}. Scroll the table horizontally on small screens to read all columns.</p>
        <div class="table-scroll" role="region" aria-label="Cost sheet table" aria-describedby="table-help" tabindex="0">
          <table>
            <caption>Known costs and their evidence</caption>
            <thead><tr><th scope="col">Item</th><th scope="col">Provider</th><th scope="col">Type / period</th><th scope="col">Amount (${escape(data.currency)})</th><th scope="col">Status</th><th scope="col">Source / evidence and notes</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="totals">
        <h2 id="totals">Totals</h2>
        <p>These are not invoices. The totals below are supplied estimates and targets; they are not a sum of all rows.</p>
        <dl class="totals">
          <dt>Paid or committed to date, known amounts</dt><dd>${escape(formatUsd(totals.spentOrCommittedToDateKnownUsd))}</dd>
          <dt>Expected monthly run-rate, project only</dt><dd>${escape(formatUsd(totals.monthlyRunRateProjectUsd.min))}–${escape(formatUsd(totals.monthlyRunRateProjectUsd.max))}<p class="note">${escape(totals.monthlyRunRateProjectUsd.basis)}</p></dd>
          <dt>Monthly run-rate including shared tools at their full amount</dt><dd>${escape(formatUsd(totals.monthlyRunRateIncludingSharedToolsUsd.min))}–${escape(formatUsd(totals.monthlyRunRateIncludingSharedToolsUsd.max))}</dd>
          <dt>Configured monthly operating target</dt><dd>${escape(formatUsd(totals.configuredCeilingMonthlyUsd.operatingTarget))}, plus ${escape(formatUsd(totals.configuredCeilingMonthlyUsd.plusDomainAmortized))} domain amortization<p class="note">${escape(totals.configuredCeilingMonthlyUsd.note)}</p></dd>
        </dl>
        <h3>Excluded from the paid or committed total</h3>
        <ul>${exclusions}</ul>
      </section>
      <section aria-labelledby="honesty">
        <h2 id="honesty">Honesty notes</h2>
        <ul>
          <li>Estimates use published prices and the assumptions in <a href="${repository}docs/costs.md">docs/costs.md</a>. Replace them with invoice amounts once available.</li>
          <li>Token counts are provider-reported. Dollar figures next to them are conservative application ledger estimates, not invoices.</li>
          <li>Held reservations are ceilings for usage the provider has not reported yet. They are not refunds or spend, and they are released only against provider billing evidence.</li>
          <li>The ChatGPT Pro plan is Carlos's personal subscription, not a project-only expense. Its full amount is shown because no usage hours are available to split it.</li>
          <li>The supplied figures, statuses, sources, and notes are preserved, including the domain note that still asks for confirmation despite its confirmed status and source.</li>
        </ul>
      </section>
    </main>
    <footer><a href="/">Return to the homepage →</a>${publicNavigation()}<span>Open source. Building in public.</span></footer>
  </div>
</body>
</html>
`;
}
