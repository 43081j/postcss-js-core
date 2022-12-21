import {TaggedTemplateExpression} from '@babel/types';
import {ExpressionReplacement, PlaceholderFunc} from './types.js';

export interface SourceReplacementResult {
  result: string;
  replacements: ExpressionReplacement[];
}

/**
 * Computes the source with all expressions replaced
 * @param {string} source Original source text
 * @param {TaggedTemplateExpression} node Node to traverse
 * @param {Function} computePlaceholder Function used to compute the
 * placeholder for a given expression
 * @return {SourceReplacement}
 */
export function computeReplacedSource(
  source: string,
  node: TaggedTemplateExpression,
  computePlaceholder: PlaceholderFunc
): SourceReplacementResult {
  const result: SourceReplacementResult = {
    replacements: [],
    result: ''
  };

  for (let i = 0; i < node.quasi.quasis.length; i++) {
    const template = node.quasi.quasis[i];
    const expr = node.quasi.expressions[i];
    const nextTemplate = node.quasi.quasis[i + 1];

    if (template) {
      result.result += template.value.raw;

      if (expr && nextTemplate && nextTemplate.range && template.range) {
        const exprText = source.slice(
          template.range[1],
          nextTemplate.range[0]
        );
        const placeholder = computePlaceholder(
          i,
          result.result,
          nextTemplate?.value.raw
        );
        result.replacements.push({
          source: exprText,
          replacement: placeholder
        });
        result.result += placeholder;
      }
    }
  }

  return result;
}
