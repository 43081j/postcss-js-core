import {
  ParserOptions as BabelParserOptions
} from '@babel/parser';
import {
  ProcessOptions
} from 'postcss';

export type PlaceholderFunc =
  (key: number, before?: string, after?: string) => string;

export interface SyntaxOptions {
  stateKey: string;
  tagNames?: string[];
  babelOptions?: BabelParserOptions;
  postcssOptions?: Pick<ProcessOptions, 'map' | 'from'>;
  placeholder?: PlaceholderFunc;
}

export interface ExpressionReplacement {
  source: string;
  replacement: string;
}

export interface ExtractedStylesheet {
  replacements: ExpressionReplacement[];
  source: string;
  prefixOffsets: {
    lines: number;
    offset: number;
  };
  indentationMap: Map<number, number>;
}
