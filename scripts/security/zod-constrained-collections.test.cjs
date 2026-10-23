const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(process.env.ZOD_FIXTURE_PATH || path.join(__dirname, '../../ui/vendor/zod'));
const entries = [['CJS root', 'index.cjs'], ['CJS v3', 'v3/index.cjs'], ['ESM root', 'index.js'], ['ESM v3', 'v3/index.js']];
for (const [name, entry] of entries) {
  const loaded = entry.endsWith('.cjs') ? Promise.resolve(require(path.join(root, entry))) : import(pathToFileURL(path.join(root, entry)).href);
  for (const [kind, bound, values] of [['array', 'max', [1, 2, 3]], ['array', 'length', [1, 2, 3]], ['set', 'max', new Set([1, 2, 3])], ['set', 'size', new Set([1, 2, 3])]]) {
    for (const async of [false, true]) test(`${name}: ${kind}.${bound} ${async ? 'async' : 'sync'} rejects before element/refinement work`, async () => {
      const z = await loaded;
      let elements = 0, refinements = 0;
      const check = (_value, ctx) => { elements++; ctx.addIssue({ code: 'custom', message: 'element was visited' }); };
      const element = z.any().superRefine(async ? async (...args) => check(...args) : check);
      const schema = z[kind](element)[bound](2, 'declared cap').refine(() => { refinements++; return true; });
      const result = async ? await schema.safeParseAsync(values) : schema.safeParse(values);
      assert.equal(result.success, false);
      assert.deepEqual(result.error.issues.map(({ code, path, message }) => ({ code, path, message })), [{ code: 'too_big', path: [], message: 'declared cap' }]);
      assert.equal(elements, 0);
      assert.equal(refinements, 0);
    });
  }
  test(`${name}: nested zero maximum keeps path/message and does no element work`, async () => {
    const z = await loaded;
    let calls = 0;
    const element = z.any().transform(value => { calls++; return value; });
    const result = z.object({ list: z.array(element).max(0, 'empty only') }).safeParse({ list: ['one'] });
    assert.equal(result.success, false);
    assert.deepEqual(result.error.issues.map(({ code, path, message }) => ({ code, path, message })), [{ code: 'too_big', path: ['list'], message: 'empty only' }]);
    assert.equal(calls, 0);
  });
  test(`${name}: equal/below-cap values retain transformations and set behavior`, async () => {
    const z = await loaded;
    assert.deepEqual(z.array(z.string().transform(value => value.toUpperCase())).max(2).parse(['a', 'b']), ['A', 'B']);
    assert.deepEqual([...z.set(z.number().transform(value => value * 2)).size(2).parse(new Set([1, 2]))], [2, 4]);
    assert.deepEqual(z.array(z.number()).max(0).parse([]), []);
    assert.deepEqual([...z.set(z.number()).max(0).parse(new Set())], []);
  });
  test(`${name}: async below-cap transformations still execute`, async () => {
    const z = await loaded;
    let calls = 0;
    const element = z.number().transform(async value => { calls++; return value + 1; });
    assert.deepEqual(await z.array(element).length(2).parseAsync([1, 2]), [2, 3]);
    assert.equal(calls, 2);
    assert.deepEqual([...(await z.set(element).max(2).parseAsync(new Set([3, 4])))], [4, 5]);
    assert.equal(calls, 4);
  });
  test(`${name}: below-cap failures retain all element diagnostics`, async () => {
    const z = await loaded;
    const result = z.array(z.string()).max(2).safeParse([1, 2]);
    assert.equal(result.success, false);
    assert.deepEqual(result.error.issues.map(({ code, path }) => ({ code, path })), [{ code: 'invalid_type', path: [0] }, { code: 'invalid_type', path: [1] }]);
    const set = z.set(z.string()).max(2).safeParse(new Set([1, 2]));
    assert.deepEqual(set.error.issues.map(({ code, path }) => ({ code, path })), result.error.issues.map(({ code, path }) => ({ code, path })));
  });
  test(`${name}: too-small exact bounds and minimum-only checks keep traversal`, async () => {
    const z = await loaded;
    const exact = z.array(z.string()).length(2).safeParse([1]);
    assert.deepEqual(exact.error.issues.map(issue => issue.code), ['too_small', 'invalid_type']);
    const smallSet = z.set(z.string()).size(2).safeParse(new Set([1]));
    assert.deepEqual(smallSet.error.issues.map(issue => issue.code), ['too_small', 'invalid_type']);
    let calls = 0;
    const element = z.any().superRefine((_value, ctx) => { calls++; ctx.addIssue({ code: 'custom' }); });
    assert.equal(z.array(element).min(1).safeParse([1, 2, 3]).error.issues.length, 3);
    assert.equal(z.set(element).min(1).safeParse(new Set([1, 2, 3])).error.issues.length, 3);
    assert.equal(calls, 6);
  });
  test(`${name}: unbounded array/set/map aggregation remains explicitly unchanged`, async () => {
    const z = await loaded;
    let calls = 0;
    const element = z.any().superRefine((_value, ctx) => { calls++; ctx.addIssue({ code: 'custom' }); });
    assert.equal(z.array(element).safeParse([1, 2, 3]).error.issues.length, 3);
    assert.equal(z.set(element).safeParse(new Set([1, 2, 3])).error.issues.length, 3);
    const map = z.map(z.string(), element);
    assert.equal(typeof map.max, 'undefined');
    assert.equal(typeof map.size, 'undefined');
    assert.equal(map.safeParse(new Map([['a', 1], ['b', 2], ['c', 3]])).error.issues.length, 3);
    assert.equal(calls, 9);
  });
  test(`${name}: preprocess, explicit fallback and wrong-type handling stay supported`, async () => {
    const z = await loaded;
    assert.deepEqual(z.preprocess(value => value.slice(0, 1), z.array(z.number()).max(1)).parse([1, 2, 3]), [1]);
    assert.deepEqual(z.array(z.number()).max(1).catch([]).parse([1, 2]), []);
    const result = z.array(z.number()).max(1).safeParse('not an array');
    assert.equal(result.error.issues[0].code, 'invalid_type');
    assert.equal(result.error.issues[0].expected, 'array');
    assert.equal(z.array(z.number()).max(1).optional().parse(undefined), undefined);
  });
}
