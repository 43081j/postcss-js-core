import stylelint = require('stylelint');
import {Parser, Stringifier, Root, Document} from 'postcss';
import {assert} from 'chai';
import {createParser} from '../parse.js';
import {createStringifier} from '../stringify.js';

describe('stylelint', () => {
  let parse: Parser<Root | Document>;
  let stringify: Stringifier;

  beforeEach(() => {
    parse = createParser({
      id: 'foo',
      tagNames: ['css']
    });
    stringify = createStringifier({
      id: 'foo',
      tagNames: ['css']
    });
  });

  it('should be lintable by stylelint', async () => {
    const source = `
      css\`
        .foo { width: 100nanoacres; }
      \`;
    `;
    const result = await stylelint.lint({
      customSyntax: {parse, stringify},
      code: source,
      codeFilename: 'foo.js',
      config: {
        rules: {
          'unit-no-unknown': true
        }
      }
    });

    assert.equal(result.errored, true);

    const fooResult = result.results[0]!;
    assert.deepEqual(fooResult.warnings, [
      {
        line: 3,
        column: 26,
        endColumn: 35,
        endLine: 3,
        rule: 'unit-no-unknown',
        severity: 'error',
        text: 'Unexpected unknown unit "nanoacres" (unit-no-unknown)'
      }
    ]);
  });

  it('should be fixable by stylelint', async () => {
    const source = `
      css\`
        .foo { color: hotpink;; }
      \`;
    `;
    const result = await stylelint.lint({
      customSyntax: {parse, stringify},
      code: source,
      codeFilename: 'foo.js',
      fix: true,
      config: {
        rules: {
          'no-extra-semicolons': true
        }
      }
    });

    assert.equal(
      result.output,
      `
      css\`
        .foo { color: hotpink; }
      \`;
    `
    );
  });

  it('should be fixable by stylelint with expressions', async () => {
    const source = `
      css\`
        .foo { $\{expr}color: hotpink;; }
      \`;
    `;
    const result = await stylelint.lint({
      customSyntax: {parse, stringify},
      code: source,
      codeFilename: 'foo.js',
      fix: true,
      config: {
        rules: {
          'no-extra-semicolons': true
        }
      }
    });

    assert.equal(
      result.output,
      `
      css\`
        .foo { $\{expr}color: hotpink; }
      \`;
    `
    );
  });

  it('should be fixable by stylelint with multi-line expressions', async () => {
    const source = `
      css\`
        $\{
          expr1
        }
        .foo { $\{expr2}color: hotpink;; }
      \`;
    `;
    const result = await stylelint.lint({
      customSyntax: {parse, stringify},
      code: source,
      codeFilename: 'foo.js',
      fix: true,
      config: {
        rules: {
          'no-extra-semicolons': true
        }
      }
    });

    assert.equal(
      result.output,
      `
      css\`
        $\{
          expr1
        }
        .foo { $\{expr2}color: hotpink; }
      \`;
    `
    );
  });

  it('should be compatible with indentation rule', async () => {
    const source = `
      css\`
        .foo {
          width: 100px;
        }
      \`;
    `;
    const result = await stylelint.lint({
      customSyntax: {parse, stringify},
      code: source,
      codeFilename: 'foo.js',
      config: {
        rules: {
          indentation: 2
        }
      }
    });

    assert.equal(result.errored, false);
  });
});
