import {parse} from '@babel/parser';
import {default as traverse, NodePath} from '@babel/traverse';
import {TaggedTemplateExpression} from '@babel/types';
import {default as generate} from '@babel/generator';
import {SyntaxOptions} from './types.js';

/**
 * Creates a transform which extracts the HTML templates from a given
 * JS source code string.
 * @param {SyntaxOptions} options Syntax options
 * @return {Function}
 */
export function createTailwindTransform(
  options: SyntaxOptions
): (content: string) => string {
  return (content: string): string => {
    const tagNames = options.tagNames;

    if (!tagNames || tagNames.length === 0) {
      return content;
    }

    const ast = parse(content, {
      sourceType: 'unambiguous',
      plugins: ['typescript', ['decorators', {decoratorsBeforeExport: true}]],
      ranges: true
    });

    traverse(ast, {
      TaggedTemplateExpression: (
        path: NodePath<TaggedTemplateExpression>
      ): void => {
        if (
          path.node.tag.type === 'Identifier' &&
          tagNames.includes(path.node.tag.name)
        ) {
          path.remove();
        }
      }
    });

    const {code} = generate(ast);

    return code;
  };
}
