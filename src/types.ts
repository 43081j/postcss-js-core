import {ParserOptions as BabelParserOptions} from '@babel/parser';

export type PlaceholderFunc = (
  key: number,
  before?: string,
  after?: string
) => string;

export interface SyntaxOptions {
  stateKey: string;
  tagNames?: string[];
  babelOptions?: BabelParserOptions;
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
