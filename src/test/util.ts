import {File} from '@babel/types';
import {parse as babelParse} from '@babel/parser';

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
