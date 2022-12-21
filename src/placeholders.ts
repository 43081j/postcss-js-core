import {PlaceholderFunc} from './types.js';

type Position =
  | 'block'
  | 'statement'
  | 'default'
  | 'selector'
  | 'property'
  | 'comment';

const whitespacePattern = /\s/;

const defaultPlaceholder: PlaceholderFunc =
  (key) => `POSTCSS_LIT_${key}`;

const placeholderMapping: Partial<Record<Position, PlaceholderFunc>> =
  {
    block: (key) => `/* POSTCSS_LIT_${key} */`,
    statement: (key) => `/* POSTCSS_LIT_${key} */`,
    property: (key) => `--POSTCSS_LIT_${key}`
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
function computePossiblePosition(prefix: string, suffix?: string): Position {
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
 * Computes the placeholder for an expression
 * @param {number} i Expression index
 * @param {string=} prefix Source prefix so far
 * @param {string=} suffix Source suffix
 * @return {string}
 */
export function createPlaceholder(
  i: number,
  prefix?: string,
  suffix?: string
): string {
  if (!prefix) {
    return defaultPlaceholder(i);
  }

  const position = computePossiblePosition(prefix, suffix);

  return (placeholderMapping[position] ?? defaultPlaceholder)(i);
}
