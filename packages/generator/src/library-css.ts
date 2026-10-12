// Small balanced CSS grammar. Values remain property-by-property allowlisted.
const colors = String.raw`(?:var\(--color-(?:background|surface|text|muted|primary|accent|border)\)|transparent|currentColor)`;
const num = String.raw`(?:0|[0-9]{1,3}(?:\.[0-9]{1,3})?)`;
const unit = String.raw`(?:0|(?:[0-9]{1,3}(?:\.[0-9]{1,3})?)(?:px|rem|em|ch|%|vh|vw|svh|svw)|var\(--space(?:-(?:4|8|12|16|24|32|48|64|96))?\))`;
const length = String.raw`(?:-?${unit})`;
const colorMix = String.raw`color-mix\(in srgb,\s*${colors}(?: (?:[0-9]{1,2}|100)%)?,\s*${colors}(?: (?:[0-9]{1,2}|100)%)?\)`;
const color = `(?:${colors}|${colorMix})`;
const properties: Record<string, RegExp> = {
  display: /^(grid|block|inline-block|flex|none)$/,
  'grid-template-columns':
    /^repeat\(auto-fit,minmax\(min\(240px,100%\),1fr\)\)$/,
  gap: new RegExp(`^${unit}$`),
  padding: new RegExp(`^${unit}(?: ${unit}){0,3}$`),
  'list-style': /^none$/,
  cursor: /^pointer$/,
  color: new RegExp(`^${color}$`),
  'font-family': /^var\(--font-(heading|body|mono)\)$/,
  'border-radius': /^var\(--radius\)$/,
  position: /^(relative|absolute|sticky)$/,
  'z-index': /^(?:0|[1-9][0-9]?)$/,
  opacity: /^(?:0(?:\.[0-9]{1,3})?|1(?:\.0{1,3})?)$/,
  inset: new RegExp(`^(?:auto|${length})(?: (?:auto|${length})){0,3}$`),
  'transform-style': /^(flat|preserve-3d)$/,
  'backface-visibility': /^(visible|hidden)$/,
  perspective: new RegExp(`^(?:none|${unit})$`),
  filter: /^(?:none|blur\((?:[0-9]|[1-5][0-9]|64)(?:\.[0-9]{1,2})?px\))$/,
  'aspect-ratio': /^(?:auto|[1-9][0-9]?\s*\/\s*[1-9][0-9]?)$/,
  'animation-timeline': /^(auto|none|view\(\))$/,
  'animation-range':
    /^(normal|entry (?:[0-9]{1,2}|100)% cover (?:[0-9]{1,2}|100)%)$/,
  'animation-duration': /^(?:[0-9]|[1-5][0-9]|60)(?:\.[0-9]{1,3})?s$/,
  'animation-delay': /^(?:[0-9]|[1-5][0-9]|60)(?:\.[0-9]{1,3})?s$/,
  'animation-iteration-count': /^(?:infinite|[1-9]|[1-9][0-9])$/,
  'animation-direction': /^(normal|reverse|alternate|alternate-reverse)$/,
  'animation-fill-mode': /^(none|forwards|backwards|both)$/,
  'animation-play-state': /^(running|paused)$/,
  'animation-timing-function': /^(linear|ease|ease-in|ease-out|ease-in-out)$/,
  content: /^(?:""|none)$/,
  'pointer-events': /^(none|auto)$/,
};
Object.assign(properties, {
  'grid-area': /^1 \/ 1$/,
  'align-items': /^(start|center|stretch)$/,
  'justify-content': /^(start|center|space-between)$/,
  'flex-wrap': /^wrap$/,
  'flex-direction': /^(row|column)$/,
  'text-align': /^(start|center)$/,
  'font-size': /^(?:[1-9]|[1-6][0-9])(?:\.[0-9]{1,2})?(?:rem|px|em)$/,
  'font-weight': /^(400|500|600|700)$/,
  'line-height': /^(1|1\.[0-9]{1,2}|2)$/,
  overflow: /^(hidden|visible|clip)$/,
  'overflow-wrap': /^(anywhere|break-word)$/,
  visibility: /^(visible|hidden)$/,
  'object-fit': /^(cover|contain)$/,
  'transform-origin': /^(center|top|bottom|left|right)$/,
  'clip-path':
    /^inset\((?:0|(?:[0-9]{1,2}|100)%)(?: (?:0|(?:[0-9]{1,2}|100)%)){0,3}\)$/,
  'animation-timing-function':
    /^(linear|ease|ease-in|ease-out|ease-in-out|steps\((?:[1-9]|[1-9][0-9]|1[01][0-9]|120)(?:, (?:start|end))?\))$/,
});
properties.margin = new RegExp(
  `^(?:auto|${length})(?: (?:auto|${length})){0,3}$`,
);
for (const p of [
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
])
  properties[p] = new RegExp(`^(?:auto|none|${unit})$`);
for (const p of ['border', 'outline'])
  properties[p] = new RegExp(
    `^(?:none|(?:[0-9]|1[0-6])px (?:solid|dashed|dotted) ${color})$`,
  );
properties['outline-offset'] = /^(?:0|[0-9]px)$/;
properties.transform = new RegExp(
  `^(?:none|(?:translate[XY]?\\(${length}(?:,\\s*${length})?\\)|rotate[XY]?\\(-?${num}deg\\)|scale\\((?:0(?:\\.[0-9]{1,3})?|[1-3](?:\\.[0-9]{1,3})?)\\))(?: (?:translate[XY]?\\(${length}(?:,\\s*${length})?\\)|rotate[XY]?\\(-?${num}deg\\)|scale\\((?:0(?:\\.[0-9]{1,3})?|[1-3](?:\\.[0-9]{1,3})?)\\)))*)$`,
);
const stop = `${color}(?: (?:[0-9]{1,2}|100)%)?`;
const gradient = `(?:linear-gradient\\((?:-?${num}deg,\\s*)?${stop}(?:,\\s*${stop}){1,7}\\)|radial-gradient\\((?:circle,\\s*)?${stop}(?:,\\s*${stop}){1,7}\\)|conic-gradient\\((?:from -?${num}deg,\\s*)?${stop}(?:,\\s*${stop}){1,7}\\))`;
for (const p of ['background', 'background-image'])
  properties[p] = new RegExp(
    `^(?:none|${color}|${gradient}|${gradient} padding-box, ${gradient} border-box)$`,
  );
export const cssPrefix = (id: string) => 'pkg-' + id.replaceAll(':', '--');
export function validateVariantCss(
  css: string,
  id: string,
  kind: 'variant' | 'effect' = 'variant',
  behaviorProperties: Record<
    string,
    { unit: string; min: number; max: number; initial: number }
  > = {},
): void {
  const fail = (why: string): never => {
    throw Error('Invalid library CSS: ' + id + ': ' + why);
  };
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?::[a-z][a-z0-9]*(?:-[a-z0-9]+)*)?$/.test(
      id,
    )
  )
    fail('id');
  if (/[\\]|\/\*|!important|url\s*\(|@import/i.test(css))
    fail('forbidden token');
  const scope = kind === 'variant' ? `[data-v="${id}"]` : `[data-fx~="${id}"]`,
    prefix = cssPrefix(id);
  const name = new RegExp('^' + prefix + '-[a-z][a-z0-9-]*$');
  const animated = new Map<string, Set<string>>(),
    reduced = new Map<string, Set<string>>(),
    keyframes = new Set<string>(),
    usedNames = new Set<string>();
  const custom = new Map<string, string>(
    Object.entries(behaviorProperties).map(([key, p]) => [
      key,
      p.unit === 'deg'
        ? 'angle'
        : p.unit === 'px'
          ? 'length'
          : p.unit === '%'
            ? 'percentage'
            : 'number',
    ]),
  );
  function rules(
    text: string,
    reduce = false,
    conditions: string[] = [],
  ): void {
    let rest = text.trim();
    while (rest) {
      const start = rest.indexOf('{');
      if (start < 1) fail('rule');
      let depth = 1,
        end = start + 1;
      for (; end < rest.length && depth; end++) {
        if (rest[end] === '{') depth++;
        if (rest[end] === '}') depth--;
      }
      if (depth) fail('unbalanced');
      const head = rest.slice(0, start).trim(),
        body = rest.slice(start + 1, end - 1);
      rest = rest.slice(end).trim();
      if (head.startsWith('@')) {
        if (head === '@media (prefers-reduced-motion: reduce)') {
          if (reduce) fail('nested reduction');
          rules(body, true, conditions);
        } else if (
          /^@media \((?:min|max)-width: (?:[1-9][0-9]{1,2}|1[0-9]{3}|2000)px\)$/.test(
            head,
          ) ||
          /^@supports (?:not )?\(animation-timeline: view\(\)\)$/.test(head)
        ) {
          rules(body, reduce, [...conditions, head]);
        } else if (head.startsWith('@keyframes ')) {
          const n = head.slice(11);
          if (!name.test(n) || keyframes.has(n)) fail('keyframe namespace');
          keyframes.add(n);
          let frames = body.trim();
          while (frames) {
            const m =
              /^((?:from|to|(?:[0-9]{1,2}|100)%)(?:,\s*(?:from|to|(?:[0-9]{1,2}|100)%))*)\s*\{([^{}]*)\}/.exec(
                frames,
              );
            if (!m) fail('keyframe');
            declarations(m![2], [], false, [], true);
            frames = frames.slice(m![0].length).trim();
          }
        } else if (head.startsWith('@property --' + prefix + '-')) {
          const n = head.slice(10);
          if (
            !new RegExp('^--' + prefix + '-[a-z][a-z0-9-]*$').test(n) ||
            custom.has(n)
          )
            fail('property namespace');
          const m =
            /^\s*syntax:\s*"<(angle|percentage|length|number)>";\s*inherits:\s*false;\s*initial-value:\s*([^;{}]+);?\s*$/.exec(
              body,
            );
          if (!m) fail('property grammar');
          const tests: Record<string, RegExp> = {
            angle: /^-?[0-9]{1,3}deg$/,
            percentage: /^(?:[0-9]{1,2}|100)%$/,
            length: new RegExp('^' + unit + '$'),
            number: /^-?[0-9]{1,3}(?:\.[0-9]{1,3})?$/,
          };
          if (!tests[m![1]].test(m![2])) fail('property initial value');
          custom.set(n, m![1]);
        } else fail('at-rule');
      } else {
        const selectors = head.split(',').map((x) => x.trim());
        for (const s of selectors) {
          if (!s.startsWith(scope)) fail('scope');
          const tail = s.slice(scope.length);
          if (
            tail &&
            !/^(?:(?::hover|:focus-visible|:focus-within|::before|::after|:nth-child\((?:[1-9]|[1-3][0-9]|40)\)|\.[a-zA-Z][a-zA-Z0-9_-]*)| (?:\.[a-zA-Z][a-zA-Z0-9_-]*|header|div|span|button|h[123]|p|ul|ol|li|details|summary|img|a)(?::hover|:focus-visible|:focus-within|::before|::after|:nth-child\((?:[1-9]|[1-3][0-9]|40)\)|\.[a-zA-Z][a-zA-Z0-9_-]*)?)*$/.test(
              tail,
            )
          )
            fail('selector');
        }
        declarations(body, selectors, reduce, conditions, false);
      }
    }
  }
  function declarations(
    body: string,
    selectors: string[],
    reduce: boolean,
    conditions: string[],
    frame: boolean,
  ) {
    const ds = body.split(';');
    if (!ds.at(-1)?.trim()) ds.pop();
    if (!ds.length) fail('empty declarations');
    for (const d of ds) {
      const m = /^\s*([a-z-]+)\s*:\s*(.*?)\s*$/.exec(d);
      if (!m) fail('declaration');
      const [, p, raw] = m!;
      const duration = raw.replace(
        /calc\(var\(--motion-duration\) \* ([1-8])\)/g,
        (_all, n) => String(Number((0.6 * Number(n)).toFixed(1))) + 's',
      );
      const v = duration
        .replaceAll('var(--motion-distance)', '16px')
        .replaceAll('var(--motion-angle)', '360deg')
        .replace(/var\((--pkg-[a-z0-9-]+)\)/g, (_all, key) => {
          const t = custom.get(key);
          if (!t) fail('undeclared custom property');
          return t === 'angle'
            ? '0deg'
            : t === 'length'
              ? '0px'
              : t === 'percentage'
                ? '0%'
                : '0';
        });
      let valid = properties[p]?.test(v) ?? false;
      if (
        ['animation-duration', 'animation-delay'].includes(p) &&
        v === 'var(--motion-duration)'
      )
        valid = true;
      if (p === 'animation-name') {
        valid = v === 'none' || name.test(v);
        if (v !== 'none') usedNames.add(v);
      }
      if (p === 'animation') {
        const timing = v.replaceAll('var(--motion-duration)', '0s');
        valid =
          v === 'none' ||
          new RegExp(
            '^(' +
              prefix +
              '-[a-z][a-z0-9-]*) (?:[0-9]|[1-5][0-9]|60)(?:\\.[0-9]{1,3})?s (?:linear|ease|ease-in|ease-out|ease-in-out)(?: (?:infinite|[1-9]))?(?: (?:normal|reverse|alternate|alternate-reverse))?(?: (?:none|forwards|backwards|both))?$',
          ).test(timing);
        if (v !== 'none') usedNames.add(v.split(' ')[0]);
      }
      if (p === 'transition')
        valid =
          v === 'none' ||
          /^(opacity|transform|filter|background-color) (?:0|[1-5])(?:\.[0-9]{1,3})?s (linear|ease|ease-in|ease-out|ease-in-out)$/.test(
            v.replaceAll('var(--motion-duration)', '0s'),
          );
      if (p.startsWith('--' + prefix + '-') && custom.has(p)) {
        const t = custom.get(p);
        valid =
          t === 'angle'
            ? /^-?[0-9]{1,3}deg$/.test(v)
            : t === 'percentage'
              ? /^(?:[0-9]{1,2}|100)%$/.test(v)
              : t === 'length'
                ? new RegExp('^' + unit + '$').test(v)
                : /^-?[0-9]{1,3}(?:\.[0-9]{1,3})?$/.test(v);
      }
      if (!valid) fail('value ' + p + ': ' + v);
      if (
        frame &&
        !(
          p === 'opacity' ||
          p === 'transform' ||
          p === 'filter' ||
          p === 'clip-path' ||
          p.startsWith('--' + prefix + '-')
        )
      )
        fail('keyframe property');
      if (p === 'animation' || p === 'animation-name' || p === 'transition')
        for (const s of selectors) {
          const key = s + '\n' + conditions.join('\n'),
            category = p.startsWith('animation') ? 'animation' : 'transition';
          const map = reduce ? reduced : animated;
          if (!reduce && v === 'none') continue;
          if (reduce && v !== 'none')
            fail('reduced override must disable motion');
          if (!map.has(key)) map.set(key, new Set());
          map.get(key)!.add(category);
        }
    }
  }
  rules(css);
  for (const n of usedNames)
    if (!keyframes.has(n)) fail('missing keyframe ' + n);
  for (const [key, categories] of animated)
    for (const c of categories)
      if (
        !reduced.get(key)?.has(c) &&
        !reduced.get(key.split('\n')[0] + '\n')?.has(c)
      )
        fail('missing reduced-motion override');
}
