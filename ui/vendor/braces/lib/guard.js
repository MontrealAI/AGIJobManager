'use strict';

const { MAX_LENGTH } = require('./constants');
const MAX_NESTING = 128;
const MAX_NODES = 2 * MAX_LENGTH + 3;

const fail = reason => {
  const error = new SyntaxError(`Brace expression exceeds safe complexity: ${reason}`);
  error.code = 'ERR_BRACES_COMPLEXITY';
  throw error;
};

// Parent/prev links are normal parser backreferences. Traverse children once,
// then check parent chains separately because expand follows those links.
const validateAst = ast => {
  const pending = [{ node: ast, depth: 0 }];
  const seen = new Set();
  while (pending.length) {
    const { node, depth } = pending.pop();
    if (!node || typeof node !== 'object' || Array.isArray(node)) fail('invalid AST node');
    if (node.value !== undefined && typeof node.value !== 'string') fail('non-string AST value');
    for (const field of ['ranges', 'commas']) {
      if (node[field] !== undefined && typeof node[field] !== 'number') fail('non-numeric AST count');
    }
    if (depth > MAX_NESTING + 1 || seen.has(node)) fail('AST nesting, cycle or shared child');
    seen.add(node);
    if (seen.size > MAX_NODES) fail('AST size');
    if (node.nodes !== undefined) {
      if (!Array.isArray(node.nodes) || node.nodes.length > MAX_NODES) fail('invalid AST children');
      if (seen.size + pending.length + node.nodes.length > MAX_NODES) fail('AST size');
      for (const child of node.nodes) pending.push({ node: child, depth: depth + 1 });
    }
    const parents = new Set([node]);
    let parent = node.parent;
    while (parent !== undefined && parent !== null) {
      if (typeof parent !== 'object' || Array.isArray(parent) || parents.has(parent)) fail('parent cycle');
      parents.add(parent);
      if (parents.size > MAX_NESTING + 3) fail('parent nesting');
      parent = parent.parent;
    }
  }
};

module.exports = { MAX_NESTING, MAX_NODES, fail, validateAst };
