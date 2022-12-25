import {assert} from 'chai';
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

      assert.deepEqual(root.source!.start, {
        line: 3,
        column: 9,
        offset: 22
      });
      assert.equal(root.source!.end, undefined);
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

      assert.deepEqual(root0.source!.start, {
        line: 3,
        column: 9,
        offset: 22
      });
      assert.equal(root0.source!.end, undefined);
      assert.deepEqual(root1.source!.start, {
        line: 7,
        column: 9,
        offset: 82
      });
      assert.equal(root1.source!.end, undefined);
    });

    it('should account for prefix offsets', () => {
      const source = `
        css\`\t\t
          .foo { color: hotpink; }
        \`;
      `;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;

      assert.deepEqual(root.source!.start, {
        line: 3,
        column: 9,
        offset: 24
      });
      assert.equal(root.source!.end, undefined);
    });

    it('should handle lack of prefix offsets', () => {
      const source = `css\`.foo { color: hotpink; }\`;`;
      const doc = parse(source);
      const root = doc.nodes[0] as Root;

      assert.deepEqual(root.source!.start, {
        line: 1,
        column: 5,
        offset: 4
      });
      assert.equal(root.source!.end, undefined);
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

      assert.deepEqual(root.source!.start, {
        line: 4,
        column: 11,
        offset: 62
      });
      assert.equal(root.source!.end, undefined);
      assert.equal(
        getSourceForNodeByLoc(source, rule),
        '.foo { color: hotpink; }'
      );
      assert.equal(
        getSourceForNodeByRange(source, rule),
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

      assert.deepEqual(root.source!.start, {
        line: 4,
        column: 1,
        offset: 54
      });
      assert.equal(root.source!.end, undefined);
      assert.equal(
        getSourceForNodeByLoc(source, rule),
        '.foo { color: hotpink; }'
      );
      assert.equal(
        getSourceForNodeByRange(source, rule),
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

      assert.equal(getSourceForNodeByLoc(source, rule0), '.foo { ${expr} }');
      assert.equal(getSourceForNodeByRange(source, rule0), '.foo { ${expr} }');
      assert.equal(getSourceForNodeByLoc(source, rule1), '.bar { }');
      assert.equal(getSourceForNodeByRange(source, rule1), '.bar { }');
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

      assert.equal(
        getSourceForNodeByLoc(source, rule0),
        '.foo { height: ${expr}; width: ${expr}; }'
      );
      assert.equal(
        getSourceForNodeByRange(source, rule0),
        '.foo { height: ${expr}; width: ${expr}; }'
      );
      assert.equal(getSourceForNodeByLoc(source, rule1), '.bar { }');
      assert.equal(getSourceForNodeByRange(source, rule1), '.bar { }');
      assert.equal(getSourceForNodeByLoc(source, decl0), 'height: ${expr};');
      assert.equal(getSourceForNodeByRange(source, decl0), 'height: ${expr};');
      assert.equal(getSourceForNodeByLoc(source, decl1), 'width: ${expr};');
      assert.equal(getSourceForNodeByRange(source, decl1), 'width: ${expr};');
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

      assert.equal(
        getSourceForNodeByLoc(source, rule0),
        `.foo {
            height: $\{
              expr
            };
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule0),
        `.foo {
            height: $\{
              expr
            };
          }`
      );
      assert.equal(
        getSourceForNodeByLoc(source, rule1),
        `.bar {
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule1),
        `.bar {
          }`
      );
      assert.equal(
        getSourceForNodeByLoc(source, decl0),
        `height: $\{
              expr
            };`
      );
      assert.equal(
        getSourceForNodeByRange(source, decl0),
        `height: $\{
              expr
            };`
      );
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

      assert.equal(
        getSourceForNodeByLoc(source, rule0),
        `.foo {
            height: $\{expr};
            width: $\{expr};
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule0),
        `.foo {
            height: $\{expr};
            width: $\{expr};
          }`
      );
      assert.equal(
        getSourceForNodeByLoc(source, rule1),
        `.bar {
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule1),
        `.bar {
          }`
      );
      assert.equal(getSourceForNodeByLoc(source, decl0), 'height: ${expr};');
      assert.equal(getSourceForNodeByRange(source, decl0), 'height: ${expr};');
      assert.equal(getSourceForNodeByLoc(source, decl1), 'width: ${expr};');
      assert.equal(getSourceForNodeByRange(source, decl1), 'width: ${expr};');
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

      assert.equal(
        getSourceForNodeByLoc(source, rule0),
        `.foo {
            height: $\{
              expr
            };
            width: $\{
              expr
            };
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule0),
        `.foo {
            height: $\{
              expr
            };
            width: $\{
              expr
            };
          }`
      );
      assert.equal(
        getSourceForNodeByLoc(source, rule1),
        `.bar {
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule1),
        `.bar {
          }`
      );
      assert.equal(
        getSourceForNodeByLoc(source, decl0),
        `height: $\{
              expr
            };`
      );
      assert.equal(
        getSourceForNodeByRange(source, decl0),
        `height: $\{
              expr
            };`
      );
      assert.equal(
        getSourceForNodeByLoc(source, decl1),
        `width: $\{
              expr
            };`
      );
      assert.equal(
        getSourceForNodeByRange(source, decl1),
        `width: $\{
              expr
            };`
      );
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

      assert.equal(
        getSourceForNodeByLoc(source, rule0),
        `.foo {
            $\{expr}: $\{expr}; height: 4rem;
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule0),
        `.foo {
            $\{expr}: $\{expr}; height: 4rem;
          }`
      );
      assert.equal(getSourceForNodeByLoc(source, decl0), '${expr}: ${expr};');
      assert.equal(getSourceForNodeByRange(source, decl0), '${expr}: ${expr};');
      assert.equal(getSourceForNodeByLoc(source, decl1), 'height: 4rem;');
      assert.equal(getSourceForNodeByRange(source, decl1), 'height: 4rem;');
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

      assert.equal(
        getSourceForNodeByLoc(source, rule0),
        `.foo {
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule0),
        `.foo {
          }`
      );
      assert.equal(getSourceForNodeByLoc(source, comment0), '${expr}');
      assert.equal(getSourceForNodeByRange(source, comment0), '${expr}');
      assert.equal(
        getSourceForNodeByLoc(source, rule1),
        `.bar {
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule1),
        `.bar {
          }`
      );
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

      assert.equal(
        getSourceForNodeByLoc(source, rule0),
        `.foo {
            color: hotpink;

            $\{expr}

            color: blue;
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule0),
        `.foo {
            color: hotpink;

            $\{expr}

            color: blue;
          }`
      );
      assert.equal(getSourceForNodeByLoc(source, decl0), 'color: hotpink;');
      assert.equal(getSourceForNodeByRange(source, decl0), 'color: hotpink;');
      assert.equal(getSourceForNodeByLoc(source, decl2), 'color: blue;');
      assert.equal(getSourceForNodeByRange(source, decl2), 'color: blue;');
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

      assert.equal(
        getSourceForNodeByLoc(source, rule1),
        `$\{expr} {
            color: blue;
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule1),
        `$\{expr} {
            color: blue;
          }`
      );
      assert.equal(getSourceForNodeByLoc(source, decl0), 'color: blue;');
      assert.equal(getSourceForNodeByRange(source, decl0), 'color: blue;');
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

      assert.equal(
        getSourceForNodeByLoc(source, rule0),
        `.foo {
            $\{expr}: 2px;
            color: hotpink;
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule0),
        `.foo {
            $\{expr}: 2px;
            color: hotpink;
          }`
      );
      assert.equal(getSourceForNodeByLoc(source, decl0), '${expr}: 2px;');
      assert.equal(getSourceForNodeByRange(source, decl0), '${expr}: 2px;');
      assert.equal(getSourceForNodeByLoc(source, decl1), 'color: hotpink;');
      assert.equal(getSourceForNodeByRange(source, decl1), 'color: hotpink;');
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

      assert.equal(
        getSourceForNodeByLoc(source, rule0),
        `.foo {
            /* comment $\{expr} */
            color: hotpink;
          }`
      );
      assert.equal(
        getSourceForNodeByRange(source, rule0),
        `.foo {
            /* comment $\{expr} */
            color: hotpink;
          }`
      );
      assert.equal(
        getSourceForNodeByLoc(source, comment0),
        '/* comment ${expr} */'
      );
      assert.equal(
        getSourceForNodeByRange(source, comment0),
        '/* comment ${expr} */'
      );
      assert.equal(getSourceForNodeByLoc(source, decl0), 'color: hotpink;');
      assert.equal(getSourceForNodeByRange(source, decl0), 'color: hotpink;');
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

      assert.equal(rule.raws['foo:before'], '          ');
      assert.equal(decl.raws['foo:before'], '\n            ');
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

      assert.equal(root.raws['foo:after'], '\n        ');
      assert.equal(rule.raws['foo:after'], '\n          ');
      assert.equal(decl.raws['foo:after'], undefined);
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

      assert.equal(decl.raws['foo:between'], ':\n              ');
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

      assert.equal(decl.raws['foo:between'], undefined);
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

      assert.equal(rule.raws['foo:selector'], '.foo,\n          .bar');
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

      assert.equal(rule.raws['foo:selector'], undefined);
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

      assert.equal(decl.raws['foo:value'], '2px\n              2px');
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

      assert.equal(decl.raws['foo:value'], undefined);
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

      assert.equal(
        rule.raws['foo:params'],
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

      assert.equal(rule.raws['foo:params'], undefined);
    });
  });
});
