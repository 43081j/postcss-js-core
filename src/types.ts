import {ParserOptions as BabelParserOptions} from '@babel/parser';
import {Node} from '@babel/types';
import {NodePath} from '@babel/traverse';
import {Parser, Document, Root, Builder} from 'postcss';
import Stringifier from 'postcss/lib/stringifier.js';

interface StringifierConstructor {
  new (builder: Builder): Stringifier;
}

export type PlaceholderFunc = (
  key: number,
  node: NodePath<Node>,
  before?: string,
  after?: string
) => string;

export interface SyntaxOptions {
  id: string;
  tagNames?: string[];
  babelOptions?: BabelParserOptions;
  placeholder?: PlaceholderFunc;
  parser?: Parser<Document | Root>;
  stringifier?: StringifierConstructor;
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
