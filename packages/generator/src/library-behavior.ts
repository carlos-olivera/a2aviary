// A closed language over owned DOM references, not a denylist or JS sandbox.
// Acorn is supplied by the build-tool host; package code is never evaluated here.
export function validateBehavior(
  source: string,
  parse: (s: string, o: any) => any,
  id = '',
  properties: Record<
    string,
    { unit: string; min: number; max: number; initial: number }
  > = {},
  ownerCopy = false,
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
    | 'scalar'
    | 'content'
    | 'number'
    | 'rect'
    | 'style'
    | 'pointerEvent';
  const edits: { start: number; end: number; text: string }[] = [];
  const scalar = (k: Kind) =>
    k === 'scalar' || k === 'number' || k === 'content';
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
    /^(?:\.[a-zA-Z][a-zA-Z0-9_-]*|button|span|div|details|summary|li|p|a)$/;
  const attr =
    /^(?:aria-(?:expanded|pressed|hidden|controls|label)|hidden|inert)$/;
  const literal = (n: any): string =>
    n?.type === 'Literal' && typeof n.value === 'string'
      ? n.value
      : fail('literal required');
  function expr(n: any, env: Map<string, Kind>): Kind {
    if (!n) return fail('missing expression');
    if (
      n.type === 'Literal' &&
      typeof n.value === 'number' &&
      Number.isFinite(n.value)
    )
      return 'number';
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
      const kind = expr(n.argument, env);
      return ['+', '-'].includes(n.operator) && kind === 'number'
        ? 'number'
        : 'scalar';
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
      const left = expr(n.left, env),
        right = expr(n.right, env);
      return ['+', '-', '*', '/'].includes(n.operator) &&
        left === 'number' &&
        right === 'number'
        ? 'number'
        : 'scalar';
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
      if (k === 'element' && p === 'style') return 'style';
      if (
        k === 'rect' &&
        [
          'x',
          'y',
          'top',
          'left',
          'right',
          'bottom',
          'width',
          'height',
        ].includes(p)
      )
        return 'number';
      if (k === 'pointerEvent' && ['clientX', 'clientY'].includes(p))
        return 'number';
      if (k === 'context' && p === 'motionIntensity') return 'number';
      if (k === 'context' && p === 'finePointer') return 'scalar';
      if (k === 'element' && p === 'classList') return 'classList';
      if (k === 'element' && p === 'textContent' && ownerCopy) return 'content';
      if (k === 'element' && ['hidden', 'inert', 'textContent'].includes(p))
        return 'scalar';
      if (k === 'context' && p === 'reducedMotion') return 'scalar';
      if (['event', 'pointerEvent'].includes(k) && ['key', 'code'].includes(p))
        return 'scalar';
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
      if (!scalar(expr(n.right, env))) fail('scalar assignment');
      if (
        ownerCopy &&
        n.left.property.name === 'textContent' &&
        expr(n.right, env) !== 'content' &&
        !(n.right.type === 'Literal' && n.right.value === '')
      )
        fail('owner-supplied text required');
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
      if (
        k === 'element' &&
        p === 'getBoundingClientRect' &&
        n.callee.object.type === 'Identifier' &&
        n.callee.object.name === 'element' &&
        !n.arguments.length
      )
        return 'rect';
      if (k === 'style' && p === 'setProperty') {
        if (n.arguments.length !== 2) fail('style arguments');
        const key = literal(n.arguments[0]),
          rule = properties[key],
          value = n.arguments[1];
        if (!rule || !key.startsWith('--pkg-' + id + '-'))
          fail('style namespace');
        let number = value;
        if (rule.unit) {
          if (
            value.type !== 'BinaryExpression' ||
            value.operator !== '+' ||
            literal(value.right) !== rule.unit
          )
            fail('fixed style unit');
          number = value.left;
        }
        if (expr(number, env) !== 'number') fail('numeric style value');
        edits.push({
          start: n.start,
          end: n.end,
          text:
            'context.setProperty(' +
            source.slice(
              n.callee.object.object.start,
              n.callee.object.object.end,
            ) +
            ',' +
            JSON.stringify(key) +
            ',' +
            source.slice(number.start, number.end) +
            ')',
        });
        return 'scalar';
      }
      if (k === 'context' && p === 'copyText') {
        if (
          n.arguments.length !== 3 ||
          expr(n.arguments[0], env) !== 'element' ||
          !scalar(expr(n.arguments[1], env))
        )
          fail('copy arguments');
        if (ownerCopy && expr(n.arguments[1], env) !== 'content')
          fail('owner-supplied copy label required');
        callback(n.arguments[2], env, 'scalar');
        return 'scalar';
      }
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
        if (
          ownerCopy &&
          p === 'setAttribute' &&
          literal(n.arguments[0]) === 'aria-label' &&
          expr(n.arguments[1], env) !== 'content'
        )
          fail('owner-supplied accessible label required');
        if (p === 'addEventListener') {
          if (
            ![
              'click',
              'keydown',
              'keyup',
              'focus',
              'blur',
              'pointermove',
              'pointerleave',
            ].includes(literal(n.arguments[0]))
          )
            fail('event');
          callback(
            n.arguments[1],
            env,
            literal(n.arguments[0]).startsWith('pointer')
              ? 'pointerEvent'
              : 'event',
          );
          edits.push({
            start: n.callee.start,
            end: n.arguments[0].start,
            text:
              'context.listen(' +
              source.slice(n.callee.object.start, n.callee.object.end) +
              ',',
          });
        } else
          for (const a of n.arguments)
            if (!scalar(expr(a, env))) fail('scalar argument');
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
  let output = source.slice(fn.start, fn.end);
  for (const edit of edits.sort((a, b) => b.start - a.start))
    output =
      output.slice(0, edit.start - fn.start) +
      edit.text +
      output.slice(edit.end - fn.start);
  return output;
}
