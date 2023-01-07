import {NodePath} from '@babel/traverse';
import {Node} from '@babel/types';
import {PlaceholderFunc, SyntaxOptions} from './types.js';

export type Position =
  | 'block'
  | 'statement'
  | 'default'
  | 'selector'
  | 'property'
  | 'comment';

const whitespacePattern = /\s/;

type PlaceholderFuncWithSyntax = (key: number, syntaxId: string) => string;

const defaultPlaceholder: PlaceholderFuncWithSyntax = (
  key: number,
  syntaxId: string
): string => `POSTCSS_${syntaxId}_${key}`;

const placeholderMapping: Partial<Record<Position, PlaceholderFuncWithSyntax>> =
  {
    block: (key, syntaxId) => `/* POSTCSS_${syntaxId}_${key} */`,
    statement: (key, syntaxId) => `/* POSTCSS_${syntaxId}_${key} */`,
    property: (key, syntaxId) => `--POSTCSS_${syntaxId}_${key}`
  };

/**
 * Finds the first non-space character of a string
 * @param {string} str String to search
 * @return {string|null}
 */
function findFirstNonSpaceChar(str: string): string | null {
  for (let i = 0; i < str.length; i++) {
    const chr = str[i];

    if (chr === undefined) {
      return null;
    }

    if (whitespacePattern.test(chr)) {
      continue;
    }

    return chr;
  }

  return null;
}

/**
 * Computes whether the current position may be block-level or not,
 * such that we can choose a more appropriate placeholder.
 * @param {string} prefix Source prefix to scan
 * @param {string=} suffix Source suffix to scan
 * @return {boolean}
 */
export function computePossiblePosition(
  prefix: string,
  suffix?: string
): Position {
  let possiblyInComment = false;
  let possiblePosition: Position = 'default';
  for (let i = prefix.length; i > 0; i--) {
    const chr = prefix[i];
    if (possiblyInComment) {
      if (chr === '/' && prefix[i + 1] === '*') {
        possiblyInComment = false;
      }
      continue;
    } else {
      if (chr === '/' && prefix[i + 1] === '*') {
        possiblePosition = 'comment';
        break;
      }
    }
    if (chr === '*' && prefix[i + 1] === '/') {
      possiblyInComment = true;
      continue;
    }
    if (chr === ';') {
      possiblePosition = 'statement';
      break;
    }
    if (chr === ':') {
      possiblePosition = 'default';
      break;
    }
    if (chr === '}') {
      possiblePosition = 'block';
      break;
    }
    if (chr === '{') {
      possiblePosition = 'statement';
      break;
    }
  }

  if (suffix) {
    const nextChr = findFirstNonSpaceChar(suffix);

    switch (possiblePosition) {
      case 'block': {
        if (nextChr === '{') {
          possiblePosition = 'selector';
        }
        break;
      }

      case 'statement': {
        if (nextChr === ':') {
          possiblePosition = 'property';
        }
        break;
      }
    }
  }

  return possiblePosition;
}

/**
 * Tries to evaluate an AST node into a string value
 * @param {NodePath<Node>} node Node to evaluate
 * @return {string|undefined}
 */
export function tryEvaluateNode(node: NodePath<Node>): string | undefined {
  // Try to resolve simple conditionals by choosing whichever side of the
  // condition we can resolve.
  // Otherwise, fall through to babel logic.
  if (node.isConditionalExpression()) {
    const left = tryEvaluateNode(node.get('consequent'));
    const right = tryEvaluateNode(node.get('alternate'));

    if (left !== undefined) {
      return left;
    }

    if (right !== undefined) {
      return right;
    }
  }

  const val = node.evaluate();

  if (val.confident) {
    return val.value;
  }

  return undefined;
}

export interface PlaceholderOptions {
  evaluator?: (node: NodePath<Node>) => string | undefined;
}

/**
 * Computes the placeholder for an expression
 * @param {SyntaxOptions} syntax Syntax options
 * @param {PlaceholderOptions=} options Options to configure how placeholders
 * are generated.
 * @return {PlaceholderFunc}
 */
export function createPlaceholderFunc(
  syntax: SyntaxOptions,
  options?: PlaceholderOptions
): PlaceholderFunc {
  return (i, node, before, after) => {
    const value = (options?.evaluator ?? tryEvaluateNode)(node);

    if (value !== undefined) {
      return value;
    }

    if (!before) {
      return defaultPlaceholder(i, syntax.id);
    }

    const position = computePossiblePosition(before, after);

    return (placeholderMapping[position] ?? defaultPlaceholder)(i, syntax.id);
  };
}
