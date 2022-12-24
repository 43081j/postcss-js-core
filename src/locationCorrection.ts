import {Root, Position, Document, ChildNode, AnyNode} from 'postcss';
import {TaggedTemplateExpression} from '@babel/types';
import {ExtractedStylesheet, SyntaxOptions} from './types.js';

const correctLocation = (
  node: TaggedTemplateExpression,
  loc: Position,
  state?: ExtractedStylesheet
): Position => {
  if (!node.quasi.loc || !node.quasi.range) {
    return loc;
  }

  const baseIndentations = state?.indentationMap;
  const baseIndentation = baseIndentations?.get(loc.line) ?? 0;
  const nodeLoc = node.quasi.loc;
  const nodeOffset = node.quasi.range[0];
  let lineOffset = nodeLoc.start.line - 1;
  let newOffset = loc.offset + nodeOffset + 1;
  let currentLine = 1;
  let columnOffset = nodeLoc.start.column + 1;

  if (state?.prefixOffsets) {
    lineOffset += state.prefixOffsets.lines;
    newOffset += state.prefixOffsets.offset;
  }

  if (baseIndentations) {
    for (let i = 1; i <= loc.line; i++) {
      newOffset += baseIndentations.get(i) ?? 0;
    }
  }

  for (let i = 0; i < node.quasi.expressions.length; i++) {
    const expr = node.quasi.expressions[i];
    const previousQuasi = node.quasi.quasis[i];
    const nextQuasi = node.quasi.quasis[i + 1];
    const replacement = state?.replacements?.[i];

    if (
      expr &&
      expr.loc &&
      expr.range &&
      nextQuasi &&
      previousQuasi &&
      previousQuasi.loc &&
      nextQuasi.loc &&
      previousQuasi.range &&
      nextQuasi.range &&
      previousQuasi.range[1] < newOffset &&
      replacement
    ) {
      const placeholderSize = replacement.replacement.length;
      const exprSize =
        nextQuasi.range[0] - previousQuasi.range[1] - placeholderSize;
      const exprStartLine = previousQuasi.loc.end.line;
      const exprEndLine = nextQuasi.loc.start.line;
      newOffset += exprSize;
      lineOffset += exprEndLine - exprStartLine;

      if (currentLine !== exprEndLine) {
        currentLine = exprEndLine;
        if (exprStartLine === exprEndLine) {
          columnOffset = exprSize;
        } else {
          columnOffset =
            nextQuasi.loc.start.column -
            previousQuasi.loc.end.column -
            placeholderSize;
        }
      } else {
        columnOffset += exprSize;
      }
    }
  }

  loc.line += lineOffset;
  if (loc.line === currentLine) {
    loc.column += columnOffset;
  }
  loc.column += baseIndentation;
  loc.offset = newOffset;

  return loc;
};

/**
 * Computes the before/after strings from the original source for
 * restoration later when stringifying.
 * @param {Document|Root|ChildNode} node Node to compute strings for
 * @param {SyntaxOptions} options Options for custom syntax
 * @param {ExtractedStylesheet=} state Internal lit css state
 * @return {void}
 */
function computeBeforeAfter(
  node: Document | Root | ChildNode,
  options: SyntaxOptions,
  state?: ExtractedStylesheet
): void {
  if (
    node.raws['before'] &&
    (node.raws['before'].includes('\n') || node.parent?.type === 'root') &&
    node.source?.start
  ) {
    const numBeforeLines = node.raws['before'].split('\n').length - 1;
    const corrected = computeCorrectedString(
      node.raws['before'],
      node.source.start.line - numBeforeLines,
      state
    );
    node.raws[`${options.id}:before`] = corrected;
  }

  if (
    node.raws.after &&
    node.raws.after.includes('\n') &&
    (node.type === 'root' || node.source?.end)
  ) {
    const numAfterLines = node.raws.after.split('\n').length - 1;
    const line =
      node.type === 'root'
        ? node.nodes[node.nodes.length - 1]?.source?.end?.line
        : node.source?.end?.line;
    if (line !== undefined) {
      const corrected = computeCorrectedString(
        node.raws.after,
        line - numAfterLines,
        state
      );
      node.raws[`${options.id}:after`] = corrected;
    }
  }

  if (
    node.raws.between &&
    node.raws.between.includes('\n') &&
    node.source?.start
  ) {
    const corrected = computeCorrectedString(
      node.raws.between,
      node.source.start.line,
      state
    );

    node.raws[`${options.id}:between`] = corrected;
  }

  if (node.type === 'rule' && node.selector.includes('\n')) {
    const rawValue = computeCorrectedRawValue(node, 'selector', state);

    if (rawValue !== null) {
      node.raws[`${options.id}:selector`] = rawValue;
    }
  }

  if (node.type === 'decl' && node.value.includes('\n')) {
    const rawValue = computeCorrectedRawValue(node, 'value', state);

    if (rawValue !== null) {
      node.raws[`${options.id}:value`] = rawValue;
    }
  }

  if (node.type === 'atrule' && node.params.includes('\n')) {
    const rawValue = computeCorrectedRawValue(node, 'params', state);

    if (rawValue !== null) {
      node.raws[`${options.id}:params`] = rawValue;
    }
  }
}

/**
 * Computes the re-indented string of a given string on a given line
 * @param {string} value Value to re-indent
 * @param {number} lineNumber Current line number of the value
 * @param {ExtractedStylesheet=} state Internal lit css state
 * @return {string}
 */
function computeCorrectedString(
  value: string,
  lineNumber: number,
  state?: ExtractedStylesheet
): string {
  if (!value.includes('\n')) {
    const baseIndentation = state?.indentationMap?.get(lineNumber);
    if (baseIndentation !== undefined) {
      return ' '.repeat(baseIndentation) + value;
    }
    return value;
  }

  const lines = value.split('\n');
  const rawLines: string[] = [];

  if (lines[0] !== undefined) {
    rawLines.push(lines[0]);
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined) {
      const currentLineNumber = lineNumber + i;
      const baseIndentation = state?.indentationMap?.get(currentLineNumber);

      if (baseIndentation !== undefined) {
        rawLines.push(' '.repeat(baseIndentation) + line);
      } else {
        rawLines.push(line);
      }
    }
  }

  return rawLines.join('\n');
}

/**
 * Computes the re-indented value of a given node's raw value
 * @param {T} node Node to re-indent raw value of
 * @param {string} key Raw value key to re-indent
 * @param {ExtractedStylesheet=} state Internal lit css state
 * @return {string|null}
 */
function computeCorrectedRawValue<T extends AnyNode>(
  node: T,
  key: keyof T,
  state?: ExtractedStylesheet
): string | null {
  const value = node[key];

  if (typeof value !== 'string' || !node.source?.start) {
    return null;
  }

  return computeCorrectedString(value, node.source.start.line, state);
}

/**
 * Creates an AST walker/visitor for correcting PostCSS AST locations to
 * those in the original JavaScript document.
 * @param {TaggedTemplateExpression} expr Expression the original source came
 * from
 * @param {SyntaxOptions} options Options for custom syntax
 * @return {Function}
 */
export function locationCorrectionWalker(
  expr: TaggedTemplateExpression,
  options: SyntaxOptions
): (node: Document | Root | ChildNode) => void {
  return (node: Document | Root | ChildNode): void => {
    const root = node.root();
    const state = root.raws[options.id] as ExtractedStylesheet | undefined;

    computeBeforeAfter(node, options, state);

    if (node.source?.start) {
      node.source.start = correctLocation(expr, node.source.start, state);
    }
    if (node.source?.end) {
      node.source.end = correctLocation(expr, node.source.end, state);
    }
  };
}
