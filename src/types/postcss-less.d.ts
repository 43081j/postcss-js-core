declare module 'postcss-less' {
  import {Syntax} from 'postcss';

  const syntax: Syntax;

  export = syntax;
}

declare module 'postcss-less/lib/LessStringifier.js' {
  import Stringifier from 'postcss/lib/stringifier.js';

  const stringifier: typeof Stringifier;

  export = stringifier;
}
