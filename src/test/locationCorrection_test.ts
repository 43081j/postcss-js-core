import {expect} from 'chai';
import {
  Root,
  Document,
  Parser,
  Declaration,
  Rule,
  Comment,
  AtRule
} from 'postcss';
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
        column: 9,
        offset: 22
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
        column: 9,
        offset: 22
      });
      expect(root0.source!.end).to.deep.equal(undefined);
      expect(root1.source!.start).to.deep.equal({
        line: 7,
        column: 9,
        offset: 82
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
        column: 9,
        offset: 24
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
        column: 11,
        offset: 62
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
        offset: 54
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

      expect(getSourceForNodeByLoc(source, rule0)).to.equal('.foo { ${expr} }');
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
      expect(getSourceForNodeByLoc(source, decl0)).to.equal('height: ${expr};');
      expect(getSourceForNodeByRange(source, decl0)).to.equal(
        'height: ${expr};'
      );
      expect(getSourceForNodeByLoc(source, decl1)).to.equal('width: ${expr};');
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
      expect(getSourceForNodeByLoc(source, decl0)).to.equal('height: ${expr};');
      expect(getSourceForNodeByRange(source, decl0)).to.equal(
        'height: ${expr};'
      );
      expect(getSourceForNodeByLoc(source, decl1)).to.equal('width: ${expr};');
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
      expect(getSourceForNodeByRange(source, decl1)).to.equal('height: 4rem;');
    });
  });

  describe('expression positions', () => {
    it('should handle block positions', () => {
      const source = `
        css\`
          .foo {
          }

          $\{expr}

          .bar {
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule0 = root.nodes[0] as Rule;
      const comment0 = root.nodes[1] as Comment;
      const rule1 = root.nodes[2] as Rule;

      expect(getSourceForNodeByLoc(source, rule0)).to.equal(`.foo {
          }`);
      expect(getSourceForNodeByRange(source, rule0)).to.equal(`.foo {
          }`);
      expect(getSourceForNodeByLoc(source, comment0)).to.equal('${expr}');
      expect(getSourceForNodeByRange(source, comment0)).to.equal('${expr}');
      expect(getSourceForNodeByLoc(source, rule1)).to.equal(`.bar {
          }`);
      expect(getSourceForNodeByRange(source, rule1)).to.equal(`.bar {
          }`);
    });

    it('should handle statement positions', () => {
      const source = `
        css\`
          .foo {
            color: hotpink;

            $\{expr}

            color: blue;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule0 = root.nodes[0] as Rule;
      const decl0 = rule0.nodes[0] as Declaration;
      const decl2 = rule0.nodes[2] as Declaration;

      expect(getSourceForNodeByLoc(source, rule0)).to.equal(`.foo {
            color: hotpink;

            $\{expr}

            color: blue;
          }`);
      expect(getSourceForNodeByRange(source, rule0)).to.equal(`.foo {
            color: hotpink;

            $\{expr}

            color: blue;
          }`);
      expect(getSourceForNodeByLoc(source, decl0)).to.equal('color: hotpink;');
      expect(getSourceForNodeByRange(source, decl0)).to.equal(
        'color: hotpink;'
      );
      expect(getSourceForNodeByLoc(source, decl2)).to.equal('color: blue;');
      expect(getSourceForNodeByRange(source, decl2)).to.equal('color: blue;');
    });

    it('should handle selector positions', () => {
      const source = `
        css\`
          .foo {
            color: hotpink;
          }

          $\{expr} {
            color: blue;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule1 = root.nodes[1] as Rule;
      const decl0 = rule1.nodes[0] as Declaration;

      expect(getSourceForNodeByLoc(source, rule1)).to.equal(`$\{expr} {
            color: blue;
          }`);
      expect(getSourceForNodeByRange(source, rule1)).to.equal(`$\{expr} {
            color: blue;
          }`);
      expect(getSourceForNodeByLoc(source, decl0)).to.equal('color: blue;');
      expect(getSourceForNodeByRange(source, decl0)).to.equal('color: blue;');
    });

    it('should handle property positions', () => {
      const source = `
        css\`
          .foo {
            $\{expr}: 2px;
            color: hotpink;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule0 = root.nodes[0] as Rule;
      const decl0 = rule0.nodes[0] as Declaration;
      const decl1 = rule0.nodes[1] as Declaration;

      expect(getSourceForNodeByLoc(source, rule0)).to.equal(`.foo {
            $\{expr}: 2px;
            color: hotpink;
          }`);
      expect(getSourceForNodeByRange(source, rule0)).to.equal(`.foo {
            $\{expr}: 2px;
            color: hotpink;
          }`);
      expect(getSourceForNodeByLoc(source, decl0)).to.equal('${expr}: 2px;');
      expect(getSourceForNodeByRange(source, decl0)).to.equal('${expr}: 2px;');
      expect(getSourceForNodeByLoc(source, decl1)).to.equal('color: hotpink;');
      expect(getSourceForNodeByRange(source, decl1)).to.equal(
        'color: hotpink;'
      );
    });

    it('should handle comment positions', () => {
      const source = `
        css\`
          .foo {
            /* comment $\{expr} */
            color: hotpink;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule0 = root.nodes[0] as Rule;
      const comment0 = rule0.nodes[0] as Comment;
      const decl0 = rule0.nodes[1] as Declaration;

      expect(getSourceForNodeByLoc(source, rule0)).to.equal(`.foo {
            /* comment $\{expr} */
            color: hotpink;
          }`);
      expect(getSourceForNodeByRange(source, rule0)).to.equal(`.foo {
            /* comment $\{expr} */
            color: hotpink;
          }`);
      expect(getSourceForNodeByLoc(source, comment0)).to.equal(
        '/* comment ${expr} */'
      );
      expect(getSourceForNodeByRange(source, comment0)).to.equal(
        '/* comment ${expr} */'
      );
      expect(getSourceForNodeByLoc(source, decl0)).to.equal('color: hotpink;');
      expect(getSourceForNodeByRange(source, decl0)).to.equal(
        'color: hotpink;'
      );
    });
  });

  describe('raws', () => {
    it('should compute corrected before', () => {
      const source = `
        css\`
          .foo {
            color: hotpink;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as Rule;
      const decl = rule.nodes[0] as Declaration;

      expect(rule.raws['foo:before']).to.equal('          ');
      expect(decl.raws['foo:before']).to.equal('\n            ');
    });

    it('should compute corrected after', () => {
      const source = `
        css\`
          .foo {
            color: hotpink;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as Rule;
      const decl = rule.nodes[0] as Declaration;

      expect(root.raws['foo:after']).to.equal('\n        ');
      expect(rule.raws['foo:after']).to.equal('\n          ');
      expect(decl.raws['foo:after']).to.equal(undefined);
    });

    it('should compute corrected between with newlines', () => {
      const source = `
        css\`
          .foo {
            color:
              hotpink;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as Rule;
      const decl = rule.nodes[0] as Declaration;

      expect(decl.raws['foo:between']).to.equal(':\n              ');
    });

    it('should not compute corrected between if no newlines', () => {
      const source = `
        css\`
          .foo {
            color: hotpink;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as Rule;
      const decl = rule.nodes[0] as Declaration;

      expect(decl.raws['foo:between']).to.equal(undefined);
    });

    it('should compute corrected selector', () => {
      const source = `
        css\`
          .foo,
          .bar {
            color: hotpink;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as Rule;

      expect(rule.raws['foo:selector']).to.equal('.foo,\n          .bar');
    });

    it('should not compute corrected selector if no newlines', () => {
      const source = `
        css\`
          .foo, .bar {
            color: hotpink;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as Rule;

      expect(rule.raws['foo:selector']).to.equal(undefined);
    });

    it('should compute corrected declaration values', () => {
      const source = `
        css\`
          .foo {
            padding: 2px
              2px;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as Rule;
      const decl = rule.nodes[0] as Declaration;

      expect(decl.raws['foo:value']).to.equal('2px\n              2px');
    });

    it('should not compute corrected values if no newlines', () => {
      const source = `
        css\`
          .foo {
            padding: 2px 2px;
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as Rule;
      const decl = rule.nodes[0] as Declaration;

      expect(decl.raws['foo:value']).to.equal(undefined);
    });

    it('should compute corrected at-rule params', () => {
      const source = `
        css\`
          @foo (
            a:5 and b:6
          ) {
            .foo {
              color: hotpink;
            }
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as AtRule;

      expect(rule.raws['foo:params']).to.equal(
        '(\n            a:5 and b:6\n          )'
      );
    });

    it('should not compute corrected at-rule params if no newlines', () => {
      const source = `
        css\`
          @foo (a:5 and b:6) {
            .foo {
              color: hotpink;
            }
          }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;
      const rule = root.nodes[0] as AtRule;

      expect(rule.raws['foo:params']).to.equal(undefined);
    });
  });
});
