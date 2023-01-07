import {
  parse as parseCSS,
  Root,
  Document,
  Input,
  CssSyntaxError,
  Parser,
  ProcessOptions
} from 'postcss';
import {locationCorrectionWalker} from './locationCorrection.js';
import {extractTemplatesFromSource} from './extract.js';
import {computeReplacedSource} from './replacements.js';
import {computeNormalisedSource} from './normalise.js';
import {SyntaxOptions, ExtractedStylesheet} from './types.js';
import {createPlaceholderFunc} from './placeholders.js';

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
  let currentOffset = 0;

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

    const extractedStylesheet: ExtractedStylesheet = {
      replacements: replacedSource.replacements,
      source: normalisedSource.result,
      prefixOffsets: normalisedSource.prefixOffsets,
      indentationMap: normalisedSource.values
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

    root.raws.codeBefore = source.slice(
      currentOffset,
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

    currentOffset = quasi.node.range[1] - 1;
  }

  if (doc.nodes.length > 0) {
    const last = doc.nodes[doc.nodes.length - 1];
    if (last) {
      last.raws.codeAfter = source.slice(currentOffset);
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
