import {
  computeReplacedSource,
  SourceReplacementResult
} from '../replacements.js';
import {extractTemplatesFromSource} from '../extract.js';
import {SyntaxOptions} from '../types.js';
import {createPlaceholderFunc} from '../placeholders.js';
import {assert} from 'chai';

const sourceToReplacements = (source: string): SourceReplacementResult[] => {
  const options: SyntaxOptions = {id: 'foo', tagNames: ['css']};
  const extractedStyles = extractTemplatesFromSource(source, options);
  const computePlaceholder = createPlaceholderFunc(options);
  return [...extractedStyles].map((node) =>
    computeReplacedSource(source, node, computePlaceholder)
  );
};

describe('computeReplacedSource', () => {
  it('should return the source if no expressions', () => {
    const source = `
      css\`
        .foo { color: hotpink; }
      \`;
    `;
    const result = sourceToReplacements(source);

    assert.deepEqual(result, [
      {
        result: `
        .foo { color: hotpink; }
      `,
        replacements: []
      }
    ]);
  });

  it('should replace expressions with placeholders', () => {
    const source = `
      css\`
        .foo {
          color: hotpink;

          padding: $\{valueExpr};

          $\{propExpr}: 2rem;
        }

        $\{selectorExpr} {
          padding: 2rem;
        }

        .bar {
          $\{statementExpr}
        }

        $\{blockExpr}
      \`;
    `;
    const result = sourceToReplacements(source);

    assert.deepEqual(result, [
      {
        result: `
        .foo {
          color: hotpink;

          padding: POSTCSS_foo_0;

          --POSTCSS_foo_1: 2rem;
        }

        POSTCSS_foo_2 {
          padding: 2rem;
        }

        .bar {
          /* POSTCSS_foo_3 */
        }

        /* POSTCSS_foo_4 */
      `,
        replacements: [
          {
            source: '${valueExpr}',
            replacement: 'POSTCSS_foo_0'
          },
          {
            source: '${propExpr}',
            replacement: '--POSTCSS_foo_1'
          },
          {
            source: '${selectorExpr}',
            replacement: 'POSTCSS_foo_2'
          },
          {
            source: '${statementExpr}',
            replacement: '/* POSTCSS_foo_3 */'
          },
          {
            source: '${blockExpr}',
            replacement: '/* POSTCSS_foo_4 */'
          }
        ]
      }
    ]);
  });
});
