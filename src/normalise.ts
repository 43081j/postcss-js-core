import {TaggedTemplateExpression} from '@babel/types';
import {NodePath} from '@babel/traverse';

export interface NormalisedSourceResult {
  result: string;
  values: Map<number, number>;
  prefixOffsets: {
    lines: number;
    offset: number;
  };
}

/**
 * Computes the normalised source (whitespace, padding, etc)
 * @param {string} source Original source
 * @param {NodePath<TaggedTemplateExpression>} node Source node
 * @return {IndentationMapResult}
 */
export function computeNormalisedSource(
  source: string,
  node: NodePath<TaggedTemplateExpression>
): NormalisedSourceResult {
  const result: NormalisedSourceResult = {
    result: '',
    values: new Map<number, number>(),
    prefixOffsets: {
      lines: 0,
      offset: 0
    }
  };
  const quasi = node.get('quasi');
  const baseIndentation = (quasi.node.loc?.end.column ?? 1) - 1;
  const sourceLines = source.split('\n');
  const indentationPattern = new RegExp(`^[ \\t]{${baseIndentation}}`);
  const emptyLinePattern = /^[ \t\r]*$/;
  const deindentedLines: string[] = [];

  if (
    sourceLines.length > 1 &&
    sourceLines[0] !== undefined &&
    emptyLinePattern.test(sourceLines[0])
  ) {
    result.prefixOffsets.lines = 1;
    result.prefixOffsets.offset = sourceLines[0].length + 1;
    sourceLines.shift();
  }

  for (let i = 0; i < sourceLines.length; i++) {
    const sourceLine = sourceLines[i];
    if (sourceLine !== undefined) {
      if (indentationPattern.test(sourceLine)) {
        deindentedLines.push(sourceLine.replace(indentationPattern, ''));
        result.values.set(i + 1, baseIndentation);
        // Roots don't have an end line, so we can't look this up so easily
        // later on. Having a special '-1' key helps here.
        if (i === sourceLines.length - 1) {
          result.values.set(-1, baseIndentation);
        }
      } else {
        deindentedLines.push(sourceLine);
      }
    }
  }

  result.result = deindentedLines.join('\n');

  return result;
}
