import * as hanbi from 'hanbi';
import {createParser} from '../parse.js';
import {assert} from 'chai';
import {ExtractedStylesheet} from '../types.js';
import {Root, Document, Declaration} from 'postcss';
import {parse as lessParser} from 'postcss-less';
import {parse as scssParser} from 'postcss-scss';

describe('parse', () => {
  afterEach(() => {
    hanbi.restore();
  });

  describe('createParser', () => {
    it('should be an empty doc if no templates', () => {
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const doc = parse('const x = 5;');
      assert.equal(doc.nodes.length, 0);
    });

    it('should support nested templates', () => {
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const doc = parse(`
        css\`
          $\{css\`
            color: hotpink;
          \`}
          color: blue;
        \`;
      `);
      const root0 = doc.nodes[0] as Root;
      const root1 = doc.nodes[1] as Root;

      assert.equal(doc.nodes.length, 2);
      assert.equal(root0.nodes.length, 2);
      assert.equal(root1.nodes.length, 1);
    });

    it('should skip and log invalid templates', () => {
      const stub = hanbi.stubMethod(console, 'warn');
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const doc = parse('css`.foo {`;', {from: 'somefile'});

      assert.equal(doc.nodes.length, 0);
      assert.equal(stub.called, true);
      assert.ok(
        stub.calledWith(
          '[postcss (foo)]',
          'Skipping template (file: somefile, line: 1)' +
            ' as it included either invalid syntax or complex' +
            ' expressions the plugin could not interpret. Consider using a' +
            ' "// postcss-foo-disable-next-line" comment to disable' +
            ' this message'
        )
      );
    });

    it('should populate raws', () => {
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const source = `
        const x = 5;

        css\`
          .foo { color: hotpink; }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0]!;
      const state = root.raws['foo'] as ExtractedStylesheet;
      assert.equal(state.replacements.length, 0);
      assert.equal(state.source, '  .foo { color: hotpink; }\n');
      assert.deepEqual(state.prefixOffsets, {
        lines: 1,
        offset: 1
      });
      assert.deepEqual(
        [...state.indentationMap],
        [
          [1, 8],
          [2, 8],
          [-1, 8]
        ]
      );
      assert.equal(
        root.raws.codeBefore,
        '\n        const x = 5;\n\n        css`\n'
      );
      assert.equal(root.raws.codeAfter, '`;\n      ');
      assert.equal(root.raws['beforeStart'], '');
      assert.equal(root.parent, doc);
      assert.equal((root as Root & {document: Document}).document, doc);
      assert.deepEqual(doc.source!.start, {
        line: 1,
        column: 1,
        offset: 0
      });
    });

    it('should only set code after of last root', () => {
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const source = `
        css\`
          .foo { color: hotpink; }
        \`;

        css\`
          .bar { color: hotpink; }
        \`;
      `;
      const doc = parse(source);
      const root0 = doc.nodes[0]!;
      const root1 = doc.nodes[1]!;
      assert.equal(root0.raws.codeAfter, undefined);
      assert.equal(root1.raws.codeAfter, '`;\n      ');
    });

    it('should parse basic stylesheet', () => {
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const source = `
        css\`
          .foo { color: hotpink; }
        \`;

        css\`
          .bar { color: hotpink; }
        \`;
      `;
      const doc = parse(source);

      assert.equal(doc.nodes.length, 2);

      const root0 = doc.nodes[0] as Root;
      const root1 = doc.nodes[1] as Root;

      assert.equal(root0.nodes.length, 1);
      assert.equal(root1.nodes.length, 1);
    });

    it('should populate locations', () => {
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const source = `
        css\`
          .foo {
            color: hotpink;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const decl = root.nodes[0] as Declaration;
      assert.deepEqual(root.source!.start, {
        offset: 22,
        column: 9,
        line: 3
      });
      assert.deepEqual(decl.source!.start, {
        offset: 24,
        column: 11,
        line: 3
      });
      assert.deepEqual(decl.source!.end, {
        offset: 69,
        column: 11,
        line: 5
      });
    });

    it('should use default placeholders if none set', () => {
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const source = `
        css\`
          .foo { $\{expr} }
        \`;
      `;
      const doc = parse(source);

      assert.equal(doc.toString(), '  .foo { /* POSTCSS_foo_0 */ }\n');
    });

    it('should support custom sub-parsers (less)', () => {
      const parse = createParser({
        id: 'foo',
        tagNames: ['css'],
        parser: lessParser!
      });
      const source = `
        css\`
          .foo {
            color: hotpink;
            .bordered();
          }
        \`;
      `;
      const doc = parse(source);

      assert.equal(
        doc.toString(),
        `  .foo {
    color: hotpink;
    @bordered();
  }
`
      );
    });

    it('should support custom sub-parsers (sass)', () => {
      const parse = createParser({
        id: 'foo',
        tagNames: ['css'],
        parser: scssParser
      });
      const source = `
        css\`
          @mixin theme($theme: hotpink) {
            color: $theme;
            box-shadow: 0 0 1px rgba($theme, .25);
          }

          .foo {
            @include theme;
          }
        \`;
      `;
      const doc = parse(source);

      assert.equal(
        doc.toString(),
        `  @mixin theme($theme: hotpink) {
    color: $theme;
    box-shadow: 0 0 1px rgba($theme, .25);
  }

  .foo {
    @include theme;
  }
`
      );
    });
  });
});
