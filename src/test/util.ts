import {File} from '@babel/types';
import {parse as babelParse} from '@babel/parser';
import {Node} from 'postcss';

/**
 * Parses some javascript/typescript via babel
 * @param {string} source Source to parse
 * @return {File}
 */
export function parseScript(source: string): File {
  const ast = babelParse(source, {
    sourceType: 'unambiguous',
    ranges: true
  });

  return ast;
}

/**
 * Gets the source for a given node using its location
 * @param {string} source Source code
 * @param {Node} node Node to retrieve
 * @return {string}
 */
export function getSourceForNodeByLoc(source: string, node: Node): string {
  const loc = node.source;

  if (!loc || !loc.start || !loc.end) {
    return '';
  }

  const lines = source.split(/\r\n|\n/);
  const result: string[] = [];
  const startLineIndex = loc.start.line - 1;
  const endLineIndex = loc.end.line - 1;

  for (let i = startLineIndex; i < loc.end.line; i++) {
    const line = lines[i];
    if (line !== undefined) {
      let offsetStart = 0;
      let offsetEnd = line.length;

      if (i === startLineIndex) {
        offsetStart = loc.start.column - 1;
      }

      if (i === endLineIndex) {
        offsetEnd = loc.end.column;
      }

      result.push(line.substring(offsetStart, offsetEnd));
    }
  }

  return result.join('\n');
}

/**
 * Gets the source for a given node by using its range
 * @param {string} source Source code
 * @param {Node} node Node to retrieve
 * @return {string}
 */
export function getSourceForNodeByRange(source: string, node: Node): string {
  if (!node.source || !node.source.start || !node.source.end) {
    return '';
  }

  return source.substring(node.source.start.offset, node.source.end.offset + 1);
}
