import {
  Stringifier as StringifierFn,
  Root,
  Document,
  AnyNode,
  Builder
} from 'postcss';
import Stringifier from 'postcss/lib/stringifier';
import {ExtractedStylesheet, SyntaxOptions} from './types.js';

interface IJavaScriptStringifier {
  new (builder: Builder, options: SyntaxOptions): Stringifier;
}

/**
 * Stringifies PostCSS nodes while taking interpolated expressions
 * into account.
 *
 * @param {object} cls Base class
 * @return {object}
 */
function createStringifierClass(
  cls: typeof Stringifier
): IJavaScriptStringifier {
  return class JavaScriptStringifier extends cls {
    protected _parseOptions: SyntaxOptions;

    /** @inheritdoc */
    public constructor(builder: Builder, options: SyntaxOptions) {
      const wrappedBuilder: Builder = (
        str: string,
        node?: AnyNode,
        type?: 'start' | 'end'
      ): void => {
        // We purposely ignore the root node since the only thing we should
        // be stringifying here is already JS (before/after raws) so likely
        // already contains backticks on purpose.
        //
        // Similarly, if there is no node, we're probably stringifying
        // pure JS which never contained any CSS. Or something really weird
        // we don't want to touch anyway.
        //
        // For everything else, we want to escape backticks.
        if (!node || node?.type === 'root') {
          builder(str, node, type);
        } else {
          const state = node?.root()?.raws[this._parseOptions.id] as
            | ExtractedStylesheet
            | undefined;
          if (state) {
            let processedString = str
              .replace(/\\/g, '\\\\')
              .replace(/`/g, '\\`');

            for (const {source, replacement} of state.replacements) {
              processedString = processedString.replace(replacement, source);
            }

            builder(processedString, node, type);
          } else {
            builder(str, node, type);
          }
        }
      };
      super(wrappedBuilder);
      this._parseOptions = options;
    }

    /** @inheritdoc */
    public override document(node: Document): void {
      if (node.nodes.length === 0) {
        this.builder(node.source?.input.css ?? '');
      } else {
        super.document(node);
      }
    }

    /** @inheritdoc */
    public override root(node: Root): void {
      const raws = node.raws[this._parseOptions.id] as
        | ExtractedStylesheet
        | undefined;

      if (raws && raws.isNested) {
        return;
      }

      this.builder(node.raws.codeBefore ?? '', node, 'start');

      this.body(node);

      // Here we want to recover any previously removed JS indentation
      // if possible. Otherwise, we use the `after` string as-is.
      const afterKey = `${this._parseOptions.id}:after`;
      const after = node.raws[afterKey] ?? node.raws.after;
      if (after) {
        this.builder(after);
      }

      this.builder(node.raws.codeAfter ?? '', node, 'end');
    }

    /** @inheritdoc */
    public override raw(
      node: AnyNode,
      own: string,
      detect: string | undefined
    ): string {
      const beforeKey = `${this._parseOptions.id}:before`;
      const afterKey = `${this._parseOptions.id}:after`;
      const betweenKey = `${this._parseOptions.id}:between`;
      if (own === 'before' && node.raws['before'] && node.raws[beforeKey]) {
        return node.raws[beforeKey];
      }
      if (own === 'after' && node.raws['after'] && node.raws[afterKey]) {
        return node.raws[afterKey];
      }
      if (own === 'between' && node.raws['between'] && node.raws[betweenKey]) {
        return node.raws[betweenKey];
      }
      return super.raw(node, own, detect);
    }

    /** @inheritdoc */
    public override rawValue(node: AnyNode, prop: string): string {
      const rawKey = `${this._parseOptions.id}:${prop}`;
      if (Object.prototype.hasOwnProperty.call(node.raws, rawKey)) {
        return `${node.raws[rawKey]}`;
      }

      return super.rawValue(node, prop);
    }
  };
}

/**
 * Creates a css-in-js stringifier
 * @param {SyntaxOptions} options Syntax options
 * @return {StringifyFn}
 */
export function createStringifier(options: SyntaxOptions): StringifierFn {
  const cls = createStringifierClass(options.stringifier ?? Stringifier);

  return (node: AnyNode, builder: Builder): void => {
    // eslint-disable-next-line new-cap
    const str = new cls(builder, options);
    str.stringify(node);
  };
}
