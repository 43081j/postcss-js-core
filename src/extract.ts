import {TaggedTemplateExpression} from '@babel/types';
import {parse as babelParse} from '@babel/parser';
import {default as traverse, NodePath} from '@babel/traverse';
import {SyntaxOptions} from './types.js';
import {hasDisableComment} from './comments.js';

/**
 * Determines if a given tag is one of the supported tags
 * @param {string} tag Tag to test
 * @param {string[]} supported Supported tags
 * @return {boolean}
 */
function isSupportedTag(tag: string, supported: string[]): boolean {
  for (const supportedTag of supported) {
    if (supportedTag === tag) {
      return true;
    }

    if (
      supportedTag.endsWith('*') &&
      tag.startsWith(supportedTag.slice(0, -1))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts stylesheets from a given source string
 * @param {string} source Source to parse
 * @param {SyntaxOptions} options Extraction options
 * @return {Set<TaggedTemplateExpression>}
 */
export function extractTemplatesFromSource(
  source: string,
  options: SyntaxOptions
): Set<NodePath<TaggedTemplateExpression>> {
  const extractedStyles = new Set<NodePath<TaggedTemplateExpression>>();
  const tagNames = options?.tagNames;

  // Return early if there's no tag names to look for
  if (!tagNames) {
    return extractedStyles;
  }

  const ast = babelParse(source, {
    sourceType: 'unambiguous',
    plugins: [
      'typescript',
      ['decorators', {decoratorsBeforeExport: true}],
      'jsx'
    ],
    ranges: true,
    ...options?.babelOptions
  });

  traverse(ast, {
    TaggedTemplateExpression: (
      path: NodePath<TaggedTemplateExpression>
    ): void => {
      const tagNode = path.get('tag');
      if (tagNode.node.start !== null && tagNode.node.end !== null) {
        const tag = tagNode.toString();

        if (
          isSupportedTag(tag, tagNames) &&
          !hasDisableComment(path, options)
        ) {
          extractedStyles.add(path);
        }
      }
    }
  });

  return extractedStyles;
}
