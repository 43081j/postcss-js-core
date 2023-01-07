import {
  parse as parseCSS,
  Root,
  Document,
  Input,
  CssSyntaxError,
  Parser,
  ProcessOptions
} from 'postcss';
import {Node, TaggedTemplateExpression} from '@babel/types';
import {NodePath} from '@babel/traverse';
import {locationCorrectionWalker} from './locationCorrection.js';
import {extractTemplatesFromSource} from './extract.js';
import {computeReplacedSource} from './replacements.js';
import {computeNormalisedSource} from './normalise.js';
import {SyntaxOptions, ExtractedStylesheet} from './types.js';
import {createPlaceholderFunc} from './placeholders.js';
import {nodeContainsChild} from './esUtils.js';

export type PostcssParseOptions = Pick<ProcessOptions, 'map' | 'from'>;

/**
 * Parses the styles from a JS/TS source
 * @param {string} source Source to parse
 * @param {SyntaxOptions} options Parsing options
 * @param {PostcssParseOptions=} postcssOptions PostCSS parse options
 * @return {Root}
 */
function parseStyles(
  source: string,
  options: SyntaxOptions,
  postcssOptions?: PostcssParseOptions
): Document {
  const extractedStyles = extractTemplatesFromSource(source, options);
  const computePlaceholder =
    options.placeholder ?? createPlaceholderFunc(options);

  const doc = new Document();
  let lastExtractedStyle: {
    endOffset: number;
    root?: Root;
    node?: NodePath<Node>;
  } = {
    endOffset: 0
  };
  let previousExtractedStyle: NodePath<TaggedTemplateExpression> | undefined;

  for (const path of extractedStyles) {
    const quasi = path.get('quasi');

    if (!quasi.node.range) {
      continue;
    }

    const startIndex = quasi.node.range[0] + 1;

    const replacedSource = computeReplacedSource(
      source,
      path,
      computePlaceholder
    );

    const normalisedSource = computeNormalisedSource(
      replacedSource.result,
      path
    );

    // The last seen stylesheet contains this one
    const isNested =
      previousExtractedStyle !== undefined &&
      nodeContainsChild(previousExtractedStyle, path);

    const extractedStylesheet: ExtractedStylesheet = {
      replacements: replacedSource.replacements,
      source: normalisedSource.result,
      prefixOffsets: normalisedSource.prefixOffsets,
      indentationMap: normalisedSource.values,
      isNested
    };

    let root: Root;
    const parser: Parser<Document | Root> = options.parser ?? parseCSS;

    try {
      root = parser(extractedStylesheet.source, {
        ...postcssOptions,
        map: false
      }) as Root;
    } catch (err) {
      if (err instanceof CssSyntaxError) {
        const file = postcssOptions?.from ?? 'unknown';
        const line = path.node.loc?.start.line ?? 'unknown';

        console.warn(
          `[postcss (${options.id})]`,
          `Skipping template (file: ${file}, line: ${line})` +
            ' as it included either invalid syntax or complex' +
            ' expressions the plugin could not interpret. Consider using a' +
            ` "// postcss-${options.id}-disable-next-line" comment to disable` +
            ' this message'
        );
      }
      // skip this template since it included invalid
      // CSS or overly complex interpolations presumably
      continue;
    }

    root.raws[options.id] = extractedStylesheet;

    // TODO (43081j): remove this if stylelint/stylelint#5767 ever gets fixed,
    // or they drop the indentation rule. Their indentation rule depends on
    // `beforeStart` existing as they unsafely try to call `endsWith` on it.
    if (!root.raws['beforeStart']) {
      root.raws['beforeStart'] = '';
    }

    // TODO (43081j): YOU WERE HERE!
    // you need to somehow figure out that the prev offset in the case of
    // a nested template is actually the start of the containing expression,
    // which itself is actually the end of the preceding quasi
    const previousExtractedStyleOffset = previousExtractedStyle?.node.quasi
      .range
      ? previousExtractedStyle.node.quasi.range[1] - 1
      : 0;

    root.raws.codeBefore = source.slice(
      previousExtractedStyleOffset,
      startIndex + extractedStylesheet.prefixOffsets.offset
    );

    root.parent = doc;

    // TODO (43081j): stylelint relies on this existing, really unsure why.
    // it could just access root.parent to get the document...
    (root as Root & {document: Document}).document = doc;

    const walker = locationCorrectionWalker(path, options);
    walker(root);
    root.walk(walker);
    doc.nodes.push(root);

    const currentExtractedStyleOffset = quasi.node.range[1] - 1;

    // We track this so we can know the last template in the file, in
    // terms of source offset (since nested nodes are visited after their
    // parents)
    if (lastExtractedStyle.endOffset < currentExtractedStyleOffset) {
      lastExtractedStyle = {
        endOffset: currentExtractedStyleOffset,
        root,
        node: path
      };
    }

    previousExtractedStyle = path;
  }

  if (doc.nodes.length > 0) {
    if (lastExtractedStyle.root) {
      lastExtractedStyle.root.raws.codeAfter = source.slice(
        lastExtractedStyle.endOffset
      );
    }
  }

  doc.source = {
    input: new Input(source, postcssOptions),
    start: {
      line: 1,
      column: 1,
      offset: 0
    }
  };

  return doc;
}

/**
 * Creates a css-in-js parser
 * @param {ParseOptions} options Syntax options
 * @return {Parser<Root | Document>}
 */
export function createParser(options: SyntaxOptions): Parser<Root | Document> {
  return (
    source: string | {toString(): string},
    postcssOptions?: PostcssParseOptions
  ): Root | Document => {
    const sourceAsString = source.toString();

    return parseStyles(sourceAsString, options, postcssOptions);
  };
}
