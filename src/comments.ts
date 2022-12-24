import {NodePath} from '@babel/traverse';
import {TaggedTemplateExpression, Comment} from '@babel/types';
import {SyntaxOptions} from './types.js';

/**
 * Determines if a given comment is a postcss-lit-disable comment
 * @param {Comment} node Node to test
 * @param {SyntaxOptions} options Syntax options
 * @return {boolean}
 */
export function isDisableComment(
  node: Comment,
  options: SyntaxOptions
): boolean {
  return (
    node.type === 'CommentLine' &&
    node.value.includes(`postcss-${options.id}-disable-next-line`)
  );
}

/**
 * Determines if a node has a leading postcss-lit-disable comment
 * @param {NodePath<TaggedTemplateExpression>} path NodePath to test
 * @param {SyntaxOptions} options Syntax options
 * @return {boolean}
 */
export function hasDisableComment(
  path: NodePath<TaggedTemplateExpression>,
  options: SyntaxOptions
): boolean {
  const statement = path.getStatementParent();

  if (statement && statement.node.leadingComments) {
    const comment =
      statement.node.leadingComments[statement.node.leadingComments.length - 1];

    if (comment !== undefined && isDisableComment(comment, options)) {
      return true;
    }
  }

  return false;
}
