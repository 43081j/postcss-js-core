import {Node, TaggedTemplateExpression} from '@babel/types';
import {default as traverse, NodePath} from '@babel/traverse';
import {parseScript} from './util.js';
import {
  createPlaceholderFunc,
  computePossiblePosition
} from '../placeholders.js';
import {PlaceholderFunc} from '../types.js';
import {assert} from 'chai';

/**
 * Gets the NodePaths for a given source template
 * @param {string} source Source code
 * @return {Array<NodePath<Expression>>}
 */
function getNodePathsFromTemplate(source: string): Array<NodePath<Node>> {
  const ast = parseScript(source);
  const results: Array<NodePath<Node>> = [];

  traverse(ast, {
    TaggedTemplateExpression: (node: NodePath<TaggedTemplateExpression>) => {
      for (const expr of node.get('quasi').get('expressions')) {
        results.push(expr);
      }
    }
  });

  return results;
}

describe('placeholders', () => {
  describe('computePossiblePosition', () => {
    it('should use block when empty', () => {
      const result = computePossiblePosition('');
      assert.equal(result, 'block');
    });

    it('should be statement if semi-colon encountered', () => {
      const result = computePossiblePosition('.foo { color: hotpink;');
      assert.equal(result, 'statement');
    });

    it('should be default if colon encountered', () => {
      const result = computePossiblePosition('.foo { color:');
      assert.equal(result, 'default');
    });

    it('should be block if closing paren encountered', () => {
      const result = computePossiblePosition('.foo { }');
      assert.equal(result, 'block');
    });

    it('should be statement if opening paren encountered', () => {
      const result = computePossiblePosition('.foo {');
      assert.equal(result, 'statement');
    });

    it('should handle spaces after prefix', () => {
      const result = computePossiblePosition('.foo { ');
      assert.equal(result, 'statement');
    });

    it('should be comment if opening comment encountered', () => {
      const result = computePossiblePosition('.foo {} /* foo ');
      assert.equal(result, 'comment');
    });

    it('should ignore key chars inside comments', () => {
      const result = computePossiblePosition('.foo { /* tricky } comment */');
      assert.equal(result, 'statement');
    });

    it('should handle block position with suffix', () => {
      const result = computePossiblePosition('.foo { }', '.bar { }');
      assert.equal(result, 'block');
    });

    it('should be selector if suffix is open paren & prefix is block', () => {
      const result = computePossiblePosition('.foo { }', '{');
      assert.equal(result, 'selector');
    });

    it('should handle spaces before suffix', () => {
      const result = computePossiblePosition('.foo { }', ' {');
      assert.equal(result, 'selector');
    });

    it('should be statement if suffix is colon & prefix is statement', () => {
      const result = computePossiblePosition('.foo { ', ': hotpink; }');
      assert.equal(result, 'property');
    });
  });

  describe('createPlaceholder', () => {
    let createPlaceholder: PlaceholderFunc;
    let nodes: Array<NodePath<Node>>;

    beforeEach(() => {
      nodes = getNodePathsFromTemplate(`
        css\`
          $\{a & b}
        \`;
      `);
      createPlaceholder = createPlaceholderFunc({
        id: 'foo'
      });
    });

    it('should use default placeholder if no prefix', () => {
      const result = createPlaceholder(808, nodes[0]!);
      assert.equal(result, 'POSTCSS_foo_808');
    });

    it('should resolve expressions which can be confidently evaluated', () => {
      nodes = getNodePathsFromTemplate(`
        const foo = 'pink';
        const bar = foo || 'blue';
        css\`
          $\{bar};
        \`;
      `);
      const result = createPlaceholder(808, nodes[0]!);
      assert.equal(result, 'pink');
    });

    it('should resolve one side of a simple conditional', () => {
      nodes = getNodePathsFromTemplate(`
        css\`
          $\{unknownValue ? otherUnknown : 'b'};
        \`;
      `);
      const result = createPlaceholder(808, nodes[0]!);
      assert.equal(result, 'b');
    });

    it('should accept a custom evaluator', () => {
      createPlaceholder = createPlaceholderFunc(
        {
          id: 'foo'
        },
        {
          evaluator: () => 'whatever'
        }
      );

      nodes = getNodePathsFromTemplate(`
        css\`
          $\{someConstant};
        \`;
      `);
      const result = createPlaceholder(808, nodes[0]!);
      assert.equal(result, 'whatever');
    });

    it('should use block placeholder if empty prefix', () => {
      const result = createPlaceholder(808, nodes[0]!, '');
      assert.equal(result, '/* POSTCSS_foo_808 */');
    });

    describe('default positions', () => {
      it('should use default placeholder', () => {
        const result = createPlaceholder(808, nodes[0]!, '/* some comment */');

        assert.equal(result, 'POSTCSS_foo_808');
      });
    });

    describe('selector positions', () => {
      it('should use default placeholder', () => {
        const result = createPlaceholder(808, nodes[0]!, '.foo {}', ' {}');

        assert.equal(result, 'POSTCSS_foo_808');
      });
    });

    describe('comment positions', () => {
      it('should use default placeholder', () => {
        const result = createPlaceholder(808, nodes[0]!, '/* foo ', ' bar */');

        assert.equal(result, 'POSTCSS_foo_808');
      });
    });

    describe('statement positions', () => {
      it('should use a comment placeholder', () => {
        const result = createPlaceholder(808, nodes[0]!, 'color: hotpink;');

        assert.equal(result, '/* POSTCSS_foo_808 */');
      });
    });

    describe('block positions', () => {
      it('should use a comment placeholder', () => {
        const result = createPlaceholder(808, nodes[0]!, '.foo { }');

        assert.equal(result, '/* POSTCSS_foo_808 */');
      });
    });

    describe('property positions', () => {
      it('should use a variable placeholder', () => {
        const result = createPlaceholder(
          808,
          nodes[0]!,
          '.foo { ',
          ': hotpink; }'
        );

        assert.equal(result, '--POSTCSS_foo_808');
      });
    });
  });
});
