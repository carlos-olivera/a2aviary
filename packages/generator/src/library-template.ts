// Core-owned grammar and interpreter. Packages supply data, never executable code.
export type Fields = Record<string, { kind: string; required?: boolean }>;
export type TemplateNode =
  | { type: 'literal'; value: string; target?: string }
  | { type: 'text' | 'helper'; field: string; helper?: string }
  | { type: 'if' | 'each'; field: string; children: TemplateNode[] };
export interface LibraryVariant {
  component: string;
  ast: TemplateNode[];
  css: string;
  behaviors?: string[];
  targets?: import('../../../services/src/site/library.ts').LibraryPackage['targets'];
}
const tags = new Set([
  'button',
  'span',
  'header',
  'div',
  'h1',
  'h2',
  'h3',
  'p',
  'ul',
  'ol',
  'li',
  'details',
  'summary',
]);
const scalar = new Set(['heading', 'shortCopy', 'text']);
const items: Record<string, Fields> = {
  textItems: { heading: { kind: 'heading' }, text: { kind: 'shortCopy' } },
  linkItems: {
    heading: { kind: 'heading' },
    text: { kind: 'shortCopy' },
    link: { kind: 'link' },
  },
  faqItems: { question: { kind: 'heading' }, answer: { kind: 'shortCopy' } },
  imageItems: { this: { kind: 'image' } },
  links: { this: { kind: 'link' } },
};
const helpers: Record<string, string[]> = {
  image: ['image'],
  link: ['link'],
  links: ['links'],
  richText: ['richText'],
  collection: [
    'catalogCollection',
    'blogCollection',
    'announcementsCollection',
  ],
};
const invalid = (reason: string): never => {
  throw new Error('Invalid library template: ' + reason);
};
export function parseTemplate(
  source: string,
  fields: Fields,
  ownerCopy = false,
): TemplateNode[] {
  // Reject everything outside this small, balanced language; no browser error recovery.
  const tokens = source.trim().match(/{{[\s\S]*?}}|<[^>]*>|[^<{]+|[<{]/g) ?? [];
  let index = 0;
  const fieldKind = (field: string, scope: Fields) => {
    if (
      !/^(?:[a-zA-Z][a-zA-Z0-9]*|this)$/.test(field) ||
      ['constructor', 'prototype', '__proto__'].includes(field) ||
      !Object.hasOwn(scope, field)
    )
      invalid('unknown field ' + field);
    return scope[field].kind;
  };
  function parse(scope: Fields, close?: string): TemplateNode[] {
    const nodes: TemplateNode[] = [],
      stack: string[] = [];
    while (index < tokens.length) {
      const token = tokens[index++];
      if (token.startsWith('{{')) {
        const expression = token.slice(2, -2).trim();
        if (expression.startsWith('/')) {
          if (!close || expression !== '/' + close || stack.length)
            invalid('unbalanced block');
          return nodes;
        }
        const block = /^(#each|#if) ([a-zA-Z][a-zA-Z0-9]*)$/.exec(expression);
        if (block) {
          const type = block[1].slice(1) as 'if' | 'each',
            field = block[2],
            kind = fieldKind(field, scope);
          if (type === 'each' && !Object.hasOwn(items, kind))
            invalid('each requires a list');
          nodes.push({
            type,
            field,
            children: parse(type === 'each' ? items[kind] : scope, type),
          });
        } else {
          const helper = /^> ([a-zA-Z]+) ([a-zA-Z][a-zA-Z0-9]*)$/.exec(
            expression,
          );
          const field = helper ? helper[2] : expression,
            kind = fieldKind(field, scope);
          if (helper) {
            if (
              !Object.hasOwn(helpers, helper[1]) ||
              !helpers[helper[1]].includes(kind)
            )
              invalid('helper type mismatch');
            if (
              helper[1] === 'collection' &&
              (!Object.hasOwn(fields, 'emptyText') ||
                fields.emptyText.kind !== 'shortCopy')
            )
              invalid('collection requires emptyText');
            nodes.push({ type: 'helper', field, helper: helper[1] });
          } else {
            if (!scalar.has(kind)) invalid('interpolation requires text');
            nodes.push({ type: 'text', field });
          }
        }
      } else if (token.startsWith('<')) {
        const match =
          /^<(\/)?([a-z][a-z0-9]*)(?: class="([a-zA-Z][a-zA-Z0-9_-]*(?: [a-zA-Z][a-zA-Z0-9_-]*)*)")?>$/.exec(
            token,
          );
        if (!match || !tags.has(match[2]) || (match[1] && match[3]))
          invalid('tag or attribute not allowed');
        if (match![1]) {
          if (stack.pop() !== match![2]) invalid('unbalanced tag');
        } else stack.push(match![2]);
        nodes.push({ type: 'literal', value: token });
      } else {
        if (ownerCopy && token.trim()) invalid('literal package copy');
        if (token.includes('{')) invalid('unsupported expression');
        nodes.push({ type: 'literal', value: token });
      }
    }
    if (close || stack.length) invalid('unclosed block or tag');
    return nodes;
  }
  return parse(fields);
}
export const escapeHtml = (value: unknown) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export function interpretTemplate(
  nodes: TemplateNode[],
  props: Record<string, unknown>,
  helper: (name: string, value: unknown, field: string) => string,
  decorate: (tag: string, role: string) => string = (tag) => tag,
): string {
  const read = (scope: unknown, field: string): unknown =>
    field === 'this'
      ? scope
      : scope !== null &&
          typeof scope === 'object' &&
          Object.hasOwn(scope, field)
        ? (scope as Record<string, unknown>)[field]
        : undefined;
  const render = (list: TemplateNode[], scope: unknown): string =>
    list
      .map((node) => {
        if (node.type === 'literal')
          return node.target ? decorate(node.value, node.target) : node.value;
        const value = read(scope, node.field);
        if (node.type === 'if')
          return value ? render(node.children, scope) : '';
        if (node.type === 'each') {
          if (!Array.isArray(value))
            throw new Error('Invalid library list value');
          return value.map((item) => render(node.children, item)).join('');
        }
        if (value === undefined || value === null)
          throw new Error('Missing library field: ' + node.field);
        if (node.type === 'helper')
          return helper(node.helper!, value, node.field);
        if (typeof value !== 'string')
          throw new Error('Invalid library text value');
        return escapeHtml(value);
      })
      .join('');
  return render(nodes, props);
}
