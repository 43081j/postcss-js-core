import {createStringifier} from '../stringify.js';
import {assert} from 'chai';
import {createParser} from '../parse.js';
import {Parser, Root, Document, Stringifier, Rule, Declaration} from 'postcss';

describe('createStringifier', () => {
  let parse: Parser<Root | Document>;
  let stringify: Stringifier;

  beforeEach(() => {
    parse = createParser({id: 'foo', tagNames: ['css']});
    stringify = createStringifier({id: 'foo', tagNames: ['css']});
  });

  it('should handle basic css', () => {
    const source = `
      css\`
        .foo { color: hotpink; }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output corrected codeBefore of roots', () => {
    const source = `
      const xyz = 808;

      css\`
        .foo { color: hotpink; }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output corrected afters of roots', () => {
    const source = `
      css\`
        .foo { color: hotpink; }


      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output regular afters of roots', () => {
    const source = `
      css\`
        .foo { color: hotpink; }    \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output corrected codeAfter of roots', () => {
    const source = `
      css\`
        .foo { color: hotpink; }
      \`;

      const xyz = 303;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output corrected befores', () => {
    const source = `
      css\`
        .foo {


          color: hotpink;
        }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output corrected afters', () => {
    const source = `
      css\`
        .foo {
          color: hotpink;


        }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output corrected betweens', () => {
    const source = `
      css\`
        .foo {
          color:
            hotpink;
        }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output corrected selectors', () => {
    const source = `
      css\`
        .foo,
        .bar {
          color: hotpink;
        }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output corrected at-rule params', () => {
    const source = `
      css\`
        @foo (
          a and b
        ) {
          .foo {
            color: hotpink;
          }
        }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should output corrected decl values', () => {
    const source = `
      css\`
        .foo {
          padding: 2em
            2rem
            2px
            2vw;
        }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  describe('expressions', () => {
    it('should replace block level expressions', () => {
      const source = `
        css\`
          .foo {
            color: hotpink;
          }

          $\{expr}

          .bar {}
        \`;
      `;
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });

    it('should replace statement level expressions', () => {
      const source = `
        css\`
          .foo {
            color: hotpink;
            $\{expr}
            padding: 2rem;
          }
        \`;
      `;
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });

    it('should replace selector expressions', () => {
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
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });

    it('should replace partial selector expressions', () => {
      const source = `
        css\`
          .foo {
            color: hotpink;
          }

          .foo, $\{expr} {
            color: blue;
          }

          $\{expr}, .foo {
            color: red;
          }
        \`;
      `;
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });

    it('should replace property expressions', () => {
      const source = `
        css\`
          .foo {
            $\{expr}: hotpink;
          }
        \`;
      `;
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });

    it('should replace partial property expressions', () => {
      const source = `
        css\`
          .foo {
            padding-$\{expr}: 2rem;
          }
        \`;
      `;
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });

    it('should replace comment expressions', () => {
      const source = `
        css\`
          .foo {
            /* some $\{expr} comment */
            color: hotpink;
          }
        \`;
      `;
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });

    it('should replace multiple expressions in one line', () => {
      const source = `
        css\`
          .foo {
            padding: $\{expr} 2em $\{expr};
          }
        \`;
      `;
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });

    it('should replace multiple expressions in multiple lines', () => {
      const source = `
        css\`
          .foo {
            padding: $\{expr};
            $\{expr}: red;
          }
        \`;
      `;
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });

    it('should replace expressions across multiple lines', () => {
      const source = `
        css\`
          .foo {
            padding: $\{
              expr
            };
          }
        \`;
      `;
      const ast = parse(source);
      const output = ast.toString({stringify});

      assert.equal(output, source);
    });
  });

  it('should handle multiple documents', () => {
    const source = `
      css\`
        .foo {
          color: hotpink;
        }
      \`;

      css\`
        .bar {
          color: hotpink;
        }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should handle deleted state', () => {
    const source = `
      css\`
        .foo {
          color: $\{expr};
        }
      \`;
    `;
    const ast = parse(source);
    const root = ast.nodes[0]!;
    root.raws['foo'] = undefined;
    const output = ast.toString({stringify});

    assert.equal(
      output,
      `
      css\`
        .foo {
          color: POSTCSS_foo_0;
        }
      \`;
    `
    );
  });

  it('should handle multi-line varied indentation', () => {
    const source = `
      css\`
        .foo,
          .bar,
            .baz {
          color: hotpink;
        }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should deal with unusual between values', () => {
    const source = `
      css\`
        .foo {
          margin
            :
              10px;
        }
      \`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should deal with unusual before values', () => {
    const source = `
      css\`
        .foo {
          margin: 10px;
          ;
          margin: 20px;
        }
      \`;
    `;

    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should deal with unusual after values', () => {
    const source = `
      css\`
        .foo {
          margin:
            1px
            2px;
          ;
        }
      \`;
    `;

    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should stringify non-css JS', () => {
    const source = `
      const a = 5;
      const b = 303;
    `;

    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should stringify empty CSS', () => {
    const source = `
      css\`\`;
    `;

    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should stringify single-line CSS', () => {
    const source = `
      css\`.foo { color: hotpink; }\`;
    `;

    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(output, source);
  });

  it('should escape backticks', () => {
    const source = `
      css\`.foo { color: hotpink; }\`;
    `;

    const ast = parse(source);
    const root = ast.nodes[0] as Root;
    const rule = root.nodes[0] as Rule;
    const colour = rule.nodes[0] as Declaration;

    colour.raws.between = ': /*comment with `backticks`*/';

    const output = ast.toString({stringify});
    assert.equal(
      output,
      `
      css\`.foo { color: /*comment with \\\`backticks\\\`*/hotpink; }\`;
    `
    );
  });

  it('should not escape unrelated backticks', () => {
    const source = `
      html\`<div></div>\`;
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(
      output,
      `
      html\`<div></div>\`;
    `
    );
  });

  it('should not escape unrelated backslashes', () => {
    const source = `
      const foo = 'abc\\def';
    `;
    const ast = parse(source);
    const output = ast.toString({stringify});

    assert.equal(
      output,
      `
      const foo = 'abc\\def';
    `
    );
  });

  it('should escape backslashes', () => {
    const source = `
      css\`.foo { color: hotpink; }\`;
    `;

    const ast = parse(source);
    const root = ast.nodes[0] as Root;
    const rule = root.nodes[0] as Rule;

    rule.selector = '.foo\\:bar';

    const output = ast.toString({stringify});
    assert.equal(
      output,
      `
      css\`.foo\\\\:bar { color: hotpink; }\`;
    `
    );
  });
});
