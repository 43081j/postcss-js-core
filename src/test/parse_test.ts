import * as hanbi from 'hanbi';
import {createParser} from '../parse.js';
import {expect} from 'chai';
import {ExtractedStylesheet} from '../types.js';
import {Root, Document, Declaration} from 'postcss';

describe('parse', () => {
  afterEach(() => {
    hanbi.restore();
  });

  describe('createParser', () => {
    it('should be an empty doc if no templates', () => {
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const doc = parse('const x = 5;');
      expect(doc.nodes.length).to.equal(0);
    });

    it('should skip and log invalid templates', () => {
      const stub = hanbi.stubMethod(console, 'warn');
      const parse = createParser({id: 'foo', tagNames: ['css']});
      const doc = parse('css`.foo {`;');

      expect(doc.nodes.length).to.equal(0);
      expect(stub.called).to.equal(true);
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
      expect(state.replacements.length).to.equal(0);
      expect(state.source).to.equal('  .foo { color: hotpink; }\n');
      expect(state.prefixOffsets).to.deep.equal({
        lines: 1,
        offset: 1
      });
      expect([...state.indentationMap]).to.deep.equal([
        [1, 8],
        [2, 8],
        [-1, 8]
      ]);
      expect(root.raws.codeBefore).to.equal(
        '\n        const x = 5;\n\n        css`\n'
      );
      expect(root.raws.codeAfter).to.equal('`;\n      ');
      expect(root.raws['beforeStart']).to.equal('');
      expect(root.parent).to.equal(doc);
      expect((root as Root & {document: Document}).document).to.equal(doc);
      expect(doc.source!.start).to.deep.equal({
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
      expect(root0.raws.codeAfter).to.equal(undefined);
      expect(root1.raws.codeAfter).to.equal('`;\n      ');
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

      expect(doc.nodes.length).to.equal(2);

      const root0 = doc.nodes[0] as Root;
      const root1 = doc.nodes[1] as Root;

      expect(root0.nodes.length).to.equal(1);
      expect(root1.nodes.length).to.equal(1);
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
      expect(root.source!.start).to.deep.equal({
        offset: 22,
        column: 9,
        line: 3
      });
      expect(decl.source!.start).to.deep.equal({
        offset: 24,
        column: 11,
        line: 3
      });
      expect(decl.source!.end).to.deep.equal({
        offset: 69,
        column: 11,
        line: 5
      });
    });
  });
});
