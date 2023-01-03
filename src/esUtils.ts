import {Node} from '@babel/types';
import {NodePath} from '@babel/traverse';

/**
 * Determines if a given ES node contains a particular child
 * @param {NodePath<Node>} node Container node
 * @param {NodePath<Node>} child Child to look for
 * @return {boolean}
 */
export function nodeContainsChild(
  node: NodePath<Node>,
  child: NodePath<Node>
): boolean {
  return (
    node.node.range !== undefined &&
    child.node.range !== undefined &&
    node.node.range[0] < child.node.range[0] &&
    node.node.range[1] > child.node.range[1]
  );
}
