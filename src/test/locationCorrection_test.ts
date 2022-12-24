import {expect} from 'chai';
import {Root, Document, Parser, Declaration, Rule} from 'postcss';
import {createParser} from '../parse.js';
import {getSourceForNodeByLoc, getSourceForNodeByRange} from './util.js';

// FYI we use the parser in here rather than the location walker
// directly as we'd otherwise end up basically rewriting the parser
// just for this test (i.e. duplicating code)

describe('locationCorrection', () => {
  let parse: Parser<Root | Document>;

  beforeEach(() => {
    parse = createParser({id: 'foo', tagNames: ['css']});
  });

  describe('locationCorrectionWalker', () => {
    describe('basic locations', () => {
      it('should correct single root', () => {
        const source = `
          css\`
            .foo { color: hotpink; }
          \`;
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;

        expect(root.source!.start).to.deep.equal({
          line: 3,
          column: 11,
          offset: 26
        });
        expect(root.source!.end).to.deep.equal(undefined);
      });

      it('should correct multiple roots', () => {
        const source = `
          css\`
            .foo { color: hotpink; }
          \`;

          css\`
            .bar { color: hotpink; }
          \`;
        `;
        const doc = parse(source);
        const root0 = doc.nodes[0] as Root;
        const root1 = doc.nodes[1] as Root;

        expect(root0.source!.start).to.deep.equal({
          line: 3,
          column: 11,
          offset: 26
        });
        expect(root0.source!.end).to.deep.equal(undefined);
        expect(root1.source!.start).to.deep.equal({
          line: 7,
          column: 11,
          offset: 92
        });
        expect(root1.source!.end).to.deep.equal(undefined);
      });

      it('should account for prefix offsets', () => {
        const source = `
          css\`\t\t
            .foo { color: hotpink; }
          \`;
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;

        expect(root.source!.start).to.deep.equal({
          line: 3,
          column: 11,
          offset: 28
        });
        expect(root.source!.end).to.deep.equal(undefined);
      });

      it('should handle lack of prefix offsets', () => {
        const source = `css\`.foo { color: hotpink; }\`;`;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;

        expect(root.source!.start).to.deep.equal({
          line: 1,
          column: 5,
          offset: 4
        });
        expect(root.source!.end).to.deep.equal(undefined);
      });

      it('should account for base indentation', () => {
        const source = `
          function deeplyIndented() {
            css\`
              .foo { color: hotpink; }
            \`;
          }
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;
        const rule = root.nodes[0] as Rule;

        expect(root.source!.start).to.deep.equal({
          line: 4,
          column: 13,
          offset: 68
        });
        expect(root.source!.end).to.deep.equal(undefined);
        expect(getSourceForNodeByLoc(source, rule)).to.equal(
          '.foo { color: hotpink; }'
        );
        expect(getSourceForNodeByRange(source, rule)).to.equal(
          '.foo { color: hotpink; }'
        );
      });

      it('should account for inconsistent indentation', () => {
        const source = `
          function freakishlyDeindented() {
        css\`
          .foo { color: hotpink; }
            \`;
          }
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;
        const rule = root.nodes[0] as Rule;

        expect(root.source!.start).to.deep.equal({
          line: 4,
          column: 1,
          offset: 58
        });
        expect(root.source!.end).to.deep.equal(undefined);
        expect(getSourceForNodeByLoc(source, rule)).to.equal(
          '.foo { color: hotpink; }'
        );
        expect(getSourceForNodeByRange(source, rule)).to.equal(
          '.foo { color: hotpink; }'
        );
      });
    });

    describe('expressions', () => {
      it('should handle single-line expr on single-line css', () => {
        const source = `
          css\`.foo { $\{expr} } .bar { }\`;
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;
        const rule0 = root.nodes[0] as Rule;
        const rule1 = root.nodes[1] as Rule;

        expect(getSourceForNodeByLoc(source, rule0)).to.equal(
          '.foo { ${expr} }'
        );
        expect(getSourceForNodeByRange(source, rule0)).to.equal(
          '.foo { ${expr} }'
        );
        expect(getSourceForNodeByLoc(source, rule1)).to.equal('.bar { }');
        expect(getSourceForNodeByRange(source, rule1)).to.equal('.bar { }');
      });

      it('should handle multiple single-line expr on single-line css', () => {
        const source = `
          css\`.foo { height: $\{expr}; width: $\{expr}; } .bar { }\`;
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;
        const rule0 = root.nodes[0] as Rule;
        const rule1 = root.nodes[1] as Rule;
        const decl0 = rule0.nodes[0] as Declaration;
        const decl1 = rule0.nodes[1] as Declaration;

        expect(getSourceForNodeByLoc(source, rule0)).to.equal(
          '.foo { height: ${expr}; width: ${expr}; }'
        );
        expect(getSourceForNodeByRange(source, rule0)).to.equal(
          '.foo { height: ${expr}; width: ${expr}; }'
        );
        expect(getSourceForNodeByLoc(source, rule1)).to.equal('.bar { }');
        expect(getSourceForNodeByRange(source, rule1)).to.equal('.bar { }');
        expect(getSourceForNodeByLoc(source, decl0)).to.equal(
          'height: ${expr};'
        );
        expect(getSourceForNodeByRange(source, decl0)).to.equal(
          'height: ${expr};'
        );
        expect(getSourceForNodeByLoc(source, decl1)).to.equal(
          'width: ${expr};'
        );
        expect(getSourceForNodeByRange(source, decl1)).to.equal(
          'width: ${expr};'
        );
      });

      it('should handle one multi-line expr on multi-line css', () => {
        const source = `
          css\`
            .foo {
              height: $\{
                expr
              };
            }
            .bar {
            }
          \`;
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;
        const rule0 = root.nodes[0] as Rule;
        const rule1 = root.nodes[1] as Rule;
        const decl0 = rule0.nodes[0] as Declaration;

        expect(getSourceForNodeByLoc(source, rule0)).to.equal(`.foo {
              height: $\{
                expr
              };
            }`);
        expect(getSourceForNodeByRange(source, rule0)).to.equal(`.foo {
              height: $\{
                expr
              };
            }`);
        expect(getSourceForNodeByLoc(source, rule1)).to.equal(`.bar {
            }`);
        expect(getSourceForNodeByRange(source, rule1)).to.equal(`.bar {
            }`);
        expect(getSourceForNodeByLoc(source, decl0)).to.equal(`height: $\{
                expr
              };`);
        expect(getSourceForNodeByRange(source, decl0)).to.equal(`height: $\{
                expr
              };`);
      });

      it('should handle multiple single-line expr on multi-line css', () => {
        const source = `
          css\`
            .foo {
              height: $\{expr};
              width: $\{expr};
            }
            .bar {
            }
          \`;
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;
        const rule0 = root.nodes[0] as Rule;
        const rule1 = root.nodes[1] as Rule;
        const decl0 = rule0.nodes[0] as Declaration;
        const decl1 = rule0.nodes[1] as Declaration;

        expect(getSourceForNodeByLoc(source, rule0)).to.equal(`.foo {
              height: $\{expr};
              width: $\{expr};
            }`);
        expect(getSourceForNodeByRange(source, rule0)).to.equal(`.foo {
              height: $\{expr};
              width: $\{expr};
            }`);
        expect(getSourceForNodeByLoc(source, rule1)).to.equal(`.bar {
            }`);
        expect(getSourceForNodeByRange(source, rule1)).to.equal(`.bar {
            }`);
        expect(getSourceForNodeByLoc(source, decl0)).to.equal(
          'height: ${expr};'
        );
        expect(getSourceForNodeByRange(source, decl0)).to.equal(
          'height: ${expr};'
        );
        expect(getSourceForNodeByLoc(source, decl1)).to.equal(
          'width: ${expr};'
        );
        expect(getSourceForNodeByRange(source, decl1)).to.equal(
          'width: ${expr};'
        );
      });

      it('should handle multiple multi-line expr on multi-line css', () => {
        const source = `
          css\`
            .foo {
              height: $\{
                expr
              };
              width: $\{
                expr
              };
            }
            .bar {
            }
          \`;
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;
        const rule0 = root.nodes[0] as Rule;
        const rule1 = root.nodes[1] as Rule;
        const decl0 = rule0.nodes[0] as Declaration;
        const decl1 = rule0.nodes[1] as Declaration;

        expect(getSourceForNodeByLoc(source, rule0)).to.equal(`.foo {
              height: $\{
                expr
              };
              width: $\{
                expr
              };
            }`);
        expect(getSourceForNodeByRange(source, rule0)).to.equal(`.foo {
              height: $\{
                expr
              };
              width: $\{
                expr
              };
            }`);
        expect(getSourceForNodeByLoc(source, rule1)).to.equal(`.bar {
            }`);
        expect(getSourceForNodeByRange(source, rule1)).to.equal(`.bar {
            }`);
        expect(getSourceForNodeByLoc(source, decl0)).to.equal(`height: $\{
                expr
              };`);
        expect(getSourceForNodeByRange(source, decl0)).to.equal(`height: $\{
                expr
              };`);
        expect(getSourceForNodeByLoc(source, decl1)).to.equal(`width: $\{
                expr
              };`);
        expect(getSourceForNodeByRange(source, decl1)).to.equal(`width: $\{
                expr
              };`);
      });

      it('should handle locations after multiple expr, same line', () => {
        const source = `
          css\`
            .foo {
              $\{expr}: $\{expr}; height: 4rem;
            }
          \`;
        `;
        const doc = parse(source);
        const root = doc.nodes[0] as Root;
        const rule0 = root.nodes[0] as Rule;
        const decl0 = rule0.nodes[0] as Declaration;
        const decl1 = rule0.nodes[1] as Declaration;

        expect(getSourceForNodeByLoc(source, rule0)).to.equal(`.foo {
              $\{expr}: $\{expr}; height: 4rem;
            }`);
        expect(getSourceForNodeByRange(source, rule0)).to.equal(`.foo {
              $\{expr}: $\{expr}; height: 4rem;
            }`);
        expect(getSourceForNodeByLoc(source, decl0)).to.equal(
          '${expr}: ${expr};'
        );
        expect(getSourceForNodeByRange(source, decl0)).to.equal(
          '${expr}: ${expr};'
        );
        expect(getSourceForNodeByLoc(source, decl1)).to.equal('height: 4rem;');
        expect(getSourceForNodeByRange(source, decl1)).to.equal(
          'height: 4rem;'
        );
      });
    });
  });
});
