import {
  parse as parseCSS,
  Root,
  Document,
  Input,
  CssSyntaxError
} from 'postcss';
import {locationCorrectionWalker} from './locationCorrection.js';
import {extractTemplatesFromSource} from './extract.js';
import {computeReplacedSource} from './replacements.js';
import {computeNormalisedSource} from './normalise.js';
import {SyntaxOptions, ExtractedStylesheet} from './types.js';
import {createPlaceholder} from './placeholders.js';

/**
 * Parses the styles from a JS/TS source
 * @param {string} source Source to parse
 * @param {SyntaxOptions} options Parsing options
 * @return {Root}
 */
export function parseStyles(
  source: string,
  options: SyntaxOptions
): Document {
  const extractedStyles = extractTemplatesFromSource(
    source,
    options
  );
  const computePlaceholder =
    options.placeholder ?? createPlaceholder;

  const doc = new Document();
  let currentOffset = 0;

  for (const node of extractedStyles) {
    if (!node.quasi.range) {
      continue;
    }

    const startIndex = node.quasi.range[0] + 1;

    const replacedSource = computeReplacedSource(
      source,
      node,
      computePlaceholder
    );

    const normalisedSource = computeNormalisedSource(
      replacedSource.result,
      node
    );

    const extractedStylesheet: ExtractedStylesheet = {
      replacements: replacedSource.replacements,
      source: normalisedSource.result,
      prefixOffsets: normalisedSource.prefixOffsets,
      indentationMap: normalisedSource.values
    };

    let root: Root;

    try {
      root = parseCSS(extractedStylesheet.source, {
        ...options?.postcssOptions,
        map: false
      }) as Root;
    } catch (err) {
      if (err instanceof CssSyntaxError) {
        const line = node.loc ? ` (Line ${node.loc.start.line})` : '';

        console.warn(
          '[postcss-lit]',
          `Skipping template${line}` +
            ' as it included either invalid syntax or complex' +
            ' expressions the plugin could not interpret. Consider using a' +
            ' "// postcss-lit-disable-next-line" comment to disable' +
            ' this message'
        );
      }
      // skip this template since it included invalid
      // CSS or overly complex interpolations presumably
      continue;
    }

    root.raws[options.stateKey] = extractedStylesheet;

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

    const walker = locationCorrectionWalker(node, options);
    walker(root);
    root.walk(walker);
    doc.nodes.push(root);

    currentOffset = node.quasi.range[1] - 1;
  }

  if (doc.nodes.length > 0) {
    const last = doc.nodes[doc.nodes.length - 1];
    if (last) {
      last.raws.codeAfter = source.slice(currentOffset);
    }
  }

  doc.source = {
    input: new Input(source, options?.postcssOptions),
    start: {
      line: 1,
      column: 1,
      offset: 0
    }
  };

  return doc;
}