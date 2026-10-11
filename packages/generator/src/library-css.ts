// Deliberately small CSS language for the initial catalog, not a general CSS sanitizer.
const properties: Record<string, RegExp> = {
  display: /^(grid|block)$/,
  'grid-template-columns':
    /^repeat\(auto-fit,minmax\(min\(240px,100%\),1fr\)\)$/,
  gap: /^var\(--space-[0-9]+\)$/,
  padding: /^(0|var\(--space-[0-9]+\))$/,
  'list-style': /^none$/,
  'max-width': /^100%$/,
  height: /^auto$/,
  cursor: /^pointer$/,
  color:
    /^var\(--color-(background|surface|text|muted|primary|accent|border)\)$/,
  background:
    /^var\(--color-(background|surface|text|muted|primary|accent|border)\)$/,
  'font-family': /^var\(--font-(heading|body)\)$/,
  'border-radius': /^var\(--radius\)$/,
};
export function validateVariantCss(css: string, id: string): void {
  const fail = () => {
    throw new Error('Invalid library CSS: ' + id);
  };
  if (!/^[a-z][a-z-]*:[a-z][a-z-]*$/.test(id)) fail();
  let remaining = css.trim();
  const scope = '[data-v="' + id + '"]';
  while (remaining) {
    const rule = /^([^{}]+)\{([^{}]*)\}/.exec(remaining);
    if (!rule) return fail();
    for (const selector of rule[1].split(',')) {
      const s = selector.trim();
      if (!s.startsWith(scope)) fail();
      const tail = s.slice(scope.length);
      // Descendants only: no siblings, parent selectors, nesting, escapes or pseudo functions.
      if (
        tail &&
        !/^(?: (?:\.[a-zA-Z][a-zA-Z0-9_-]*|header|div|h[123]|p|ul|ol|li|details|summary|img|a))+$/.test(
          tail,
        )
      )
        fail();
    }
    const declarations = rule[2].split(';');
    if (declarations.at(-1)?.trim() === '') declarations.pop();
    if (!declarations.length) fail();
    for (const declaration of declarations) {
      const m = /^\s*([a-z-]+)\s*:\s*(.*?)\s*$/.exec(declaration);
      if (
        !m ||
        !Object.hasOwn(properties, m[1]) ||
        !properties[m[1]].test(m[2])
      )
        fail();
      const token = m?.[2].match(/--space-([0-9]+)/)?.[1];
      if (
        token &&
        !['4', '8', '12', '16', '24', '32', '48', '64', '96'].includes(token)
      )
        fail();
    }
    remaining = remaining.slice(rule[0].length).trim();
  }
}
