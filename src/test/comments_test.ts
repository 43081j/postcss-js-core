import {assert} from 'chai';
import {isDisableComment, hasDisableComment} from '../comments.js';
import {SyntaxOptions} from '../types.js';
import {parseScript} from './util.js';
import {default as traverse, NodePath} from '@babel/traverse';
import {TaggedTemplateExpression} from '@babel/types';

const opts: SyntaxOptions = {
  id: 'foo'
};

describe('comments', () => {
  describe('isDisableComment', () => {
    it('should be true for disable comments', () => {
      const ast = parseScript(`
        // postcss-foo-disable-next-line
        const foo = css\`\`;
      `);

      const comment = ast.comments![0]!;

      assert.equal(isDisableComment(comment, opts), true);
    });

    it('should be false for unrelated comments', () => {
      const ast = parseScript(`
        // totally unrelated
        const foo = css\`\`;
      `);

      const comment = ast.comments![0]!;

      assert.equal(isDisableComment(comment, opts), false);
    });
  });

  describe('hasDisableComment', () => {
    it('should be true when disable comment exists', () => {
      const ast = parseScript(`
        // postcss-foo-disable-next-line
        const foo = css\`\`;
      `);

      let path: NodePath<TaggedTemplateExpression> | undefined;

      traverse(ast, {
        TaggedTemplateExpression: (p) => {
          path = p;
        }
      });

      assert.equal(hasDisableComment(path!, opts), true);
    });

    it('should be true in nested places', () => {
      const ast = parseScript(`
        // postcss-foo-disable-next-line
        const foo = css\`foo $\{css\`xyz\`} bar\`;
      `);

      const paths: Array<NodePath<TaggedTemplateExpression>> = [];

      traverse(ast, {
        TaggedTemplateExpression: (p) => {
          paths.push(p);
        }
      });

      assert.equal(paths.length, 2);
      assert.equal(
        paths.every((p) => hasDisableComment(p, opts)),
        true
      );
    });

    it('should be false if no comments', () => {
      const ast = parseScript(`
        const foo = css\`foo bar\`;
      `);

      const paths: Array<NodePath<TaggedTemplateExpression>> = [];

      traverse(ast, {
        TaggedTemplateExpression: (p) => {
          paths.push(p);
        }
      });

      assert.equal(paths.length, 1);
      assert.equal(
        paths.every((p) => hasDisableComment(p, opts)),
        false
      );
    });

    it('should be false if unrelated comments', () => {
      const ast = parseScript(`
        // some other comment
        const foo = css\`foo bar\`;
      `);

      const paths: Array<NodePath<TaggedTemplateExpression>> = [];

      traverse(ast, {
        TaggedTemplateExpression: (p) => {
          paths.push(p);
        }
      });

      assert.equal(paths.length, 1);
      assert.equal(
        paths.every((p) => hasDisableComment(p, opts)),
        false
      );
    });
  });
});
