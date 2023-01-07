import {TaggedTemplateExpression} from '@babel/types';
import {NodePath} from '@babel/traverse';
import {ExpressionReplacement, PlaceholderFunc} from './types.js';

export interface SourceReplacementResult {
  result: string;
  replacements: ExpressionReplacement[];
}

/**
 * Computes the source with all expressions replaced
 * @param {string} source Original source text
 * @param {NodePath<TaggedTemplateExpression>} node Node to traverse
 * @param {Function} computePlaceholder Function used to compute the
 * placeholder for a given expression
 * @return {SourceReplacement}
 */
export function computeReplacedSource(
  source: string,
  node: NodePath<TaggedTemplateExpression>,
  computePlaceholder: PlaceholderFunc
): SourceReplacementResult {
  const result: SourceReplacementResult = {
    replacements: [],
    result: ''
  };

  const quasi = node.get('quasi');
  const quasis = quasi.get('quasis');
  const expressions = quasi.get('expressions');

  for (let i = 0; i < quasis.length; i++) {
    const template = quasis[i];
    const expr = expressions[i];
    const nextTemplate = quasis[i + 1];

    if (template) {
      result.result += template.node.value.raw;

      if (
        expr &&
        nextTemplate &&
        nextTemplate.node.range &&
        template.node.range
      ) {
        const exprText = source.slice(
          template.node.range[1],
          nextTemplate.node.range[0]
        );
        const placeholder = computePlaceholder(
          i,
          node,
          result.result,
          nextTemplate.node.value.raw
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
