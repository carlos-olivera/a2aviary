// A closed language over owned DOM references, not a denylist or JS sandbox.
// Acorn is supplied by the build-tool host; package code is never evaluated here.
export function validateBehavior(
  source: string,
  parse: (s: string, o: any) => any,
): string {
  const fail = (why: string): never => {
    throw Error('Invalid library behavior: ' + why);
  };
  const program = parse(source, { ecmaVersion: 2022, sourceType: 'module' });
  if (
    program.body.length !== 1 ||
    program.body[0].type !== 'ExportDefaultDeclaration'
  )
    fail('one default initializer required');
  const fn = program.body[0].declaration;
  if (
    fn.type !== 'ArrowFunctionExpression' ||
    fn.async ||
    fn.params.length !== 2 ||
    fn.params[0].name !== 'element' ||
    fn.params[1].name !== 'context' ||
    fn.body.type !== 'BlockStatement'
  )
    fail('expected (element, context) => block');
  type Kind =
    | 'element'
    | 'elements'
    | 'context'
    | 'event'
    | 'classList'
    | 'scalar';
  const methods: Record<string, [Kind, number, number]> = {
    querySelector: ['element', 1, 1],
    querySelectorAll: ['elements', 1, 1],
    getAttribute: ['scalar', 1, 1],
    setAttribute: ['scalar', 2, 2],
    removeAttribute: ['scalar', 1, 1],
    focus: ['scalar', 0, 0],
    addEventListener: ['scalar', 2, 2],
  };
  const selector =
    /^(?:\.[a-zA-Z][a-zA-Z0-9_-]*|button|span|div|details|summary|li|p)$/;
  const attr =
    /^(?:aria-(?:expanded|pressed|hidden|controls|label)|hidden|inert)$/;
  const literal = (n: any): string =>
    n?.type === 'Literal' && typeof n.value === 'string'
      ? n.value
      : fail('literal required');
  function expr(n: any, env: Map<string, Kind>): Kind {
    if (!n) return fail('missing expression');
    if (
      (n.type === 'Literal' &&
        ['string', 'number', 'boolean'].includes(typeof n.value)) ||
      (n.type === 'Literal' && n.value === null)
    )
      return 'scalar';
    if (n.type === 'Identifier')
      return env.get(n.name) ?? fail('unknown identifier ' + n.name);
    if (
      n.type === 'UnaryExpression' &&
      ['!', '+', '-', 'typeof'].includes(n.operator)
    ) {
      expr(n.argument, env);
      return 'scalar';
    }
    if (
      ['BinaryExpression', 'LogicalExpression'].includes(n.type) &&
      [
        '===',
        '!==',
        '<',
        '>',
        '<=',
        '>=',
        '+',
        '-',
        '*',
        '/',
        '&&',
        '||',
        '??',
      ].includes(n.operator)
    ) {
      expr(n.left, env);
      expr(n.right, env);
      return 'scalar';
    }
    if (n.type === 'ConditionalExpression') {
      expr(n.test, env);
      const a = expr(n.consequent, env),
        b = expr(n.alternate, env);
      if (a !== b) fail('mixed references');
      return a;
    }
    if (n.type === 'MemberExpression') {
      if (n.computed || n.optional) fail('dynamic member');
      const k = expr(n.object, env),
        p = n.property.name;
      if (k === 'element' && p === 'classList') return 'classList';
      if (k === 'element' && ['hidden', 'inert', 'textContent'].includes(p))
        return 'scalar';
      if (k === 'context' && p === 'reducedMotion') return 'scalar';
      if (k === 'event' && ['key', 'code'].includes(p)) return 'scalar';
      if (k === 'elements' && p === 'length') return 'scalar';
      return fail('member ' + p);
    }
    if (n.type === 'AssignmentExpression' && n.operator === '=') {
      if (
        n.left.type !== 'MemberExpression' ||
        n.left.computed ||
        expr(n.left.object, env) !== 'element' ||
        !['hidden', 'inert', 'textContent'].includes(n.left.property.name)
      )
        fail('assignment');
      if (expr(n.right, env) !== 'scalar') fail('scalar assignment');
      return 'scalar';
    }
    if (
      n.type === 'CallExpression' &&
      !n.optional &&
      n.callee.type === 'MemberExpression' &&
      !n.callee.computed
    ) {
      const k = expr(n.callee.object, env),
        p = n.callee.property.name;
      if (k === 'element' && Object.hasOwn(methods, p)) {
        const [out, min, max] = methods[p];
        if (n.arguments.length < min || n.arguments.length > max)
          fail('arguments');
        if (
          p.startsWith('querySelector') &&
          !selector.test(literal(n.arguments[0]))
        )
          fail('owned simple selector required');
        if (
          ['getAttribute', 'setAttribute', 'removeAttribute'].includes(p) &&
          !attr.test(literal(n.arguments[0]))
        )
          fail('attribute');
        if (p === 'addEventListener') {
          if (
            !['click', 'keydown', 'keyup', 'focus', 'blur'].includes(
              literal(n.arguments[0]),
            )
          )
            fail('event');
          callback(n.arguments[1], env, 'event');
        } else
          for (const a of n.arguments)
            if (expr(a, env) !== 'scalar') fail('scalar argument');
        return out;
      }
      if (
        k === 'classList' &&
        ['add', 'remove', 'toggle', 'contains'].includes(p)
      ) {
        if (
          n.arguments.length !== 1 ||
          !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(literal(n.arguments[0]))
        )
          fail('class');
        return 'scalar';
      }
      if (k === 'elements' && p === 'forEach' && n.arguments.length === 1) {
        callback(n.arguments[0], env, 'element');
        return 'scalar';
      }
      if (k === 'event' && p === 'preventDefault' && !n.arguments.length)
        return 'scalar';
      return fail('call ' + p);
    }
    return fail('syntax ' + n.type);
  }
  function callback(n: any, env: Map<string, Kind>, kind: Kind) {
    if (
      n.type !== 'ArrowFunctionExpression' ||
      n.async ||
      n.params.length !== 1 ||
      n.params[0].type !== 'Identifier'
    )
      fail('callback');
    if (env.has(n.params[0].name)) fail('shadowed reference');
    const child = new Map(env);
    child.set(n.params[0].name, kind);
    if (n.body.type === 'BlockStatement') block(n.body, child);
    else expr(n.body, child);
  }
  function block(n: any, inherited: Map<string, Kind>) {
    const env = new Map(inherited);
    for (const s of n.body) {
      if (s.type === 'VariableDeclaration' && s.kind === 'const') {
        for (const d of s.declarations) {
          if (d.id.type !== 'Identifier' || env.has(d.id.name)) fail('binding');
          env.set(d.id.name, expr(d.init, env));
        }
      } else if (s.type === 'ExpressionStatement') expr(s.expression, env);
      else if (s.type === 'IfStatement') {
        expr(s.test, env);
        statement(s.consequent, env);
        if (s.alternate) statement(s.alternate, env);
      } else if (s.type === 'ReturnStatement' && !s.argument) continue;
      else if (s.type === 'BlockStatement') block(s, env);
      else fail('statement ' + s.type);
    }
  }
  function statement(n: any, env: Map<string, Kind>) {
    block(n.type === 'BlockStatement' ? n : { body: [n] }, env);
  }
  block(
    fn.body,
    new Map([
      ['element', 'element'],
      ['context', 'context'],
    ]),
  );
  return source.slice(fn.start, fn.end);
}
