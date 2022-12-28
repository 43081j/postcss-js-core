# postcss-js-core

`postcss-js-core` provides common functionality needed by various css-in-js
custom PostCSS syntaxes.

Many css-in-js syntaxes do much of the same work, with slight variations on
what they support and how they work. This module aims to provide the basic
building blocks for those situations.

## Usage

Let's say your syntax makes use of tagged template literals named `css`.

You can create your PostCSS syntax like so:

```ts
import {
  createParser,
  createStringifier
} from 'postcss-js-core';

const options = {
  id: 'my-syntax',
  tagNames: ['css']
};

export = {
  parse: createParser(opts),
  stringify: createStringifier(opts)
};
```

If you then use this as a PostCSS/stylelint custom syntax, it will parse
the following code:

```ts
const foo = css`
  div { color: blue; }
`;
```

## Options

When creating a parser/stringifier, you can specify some options. These are
as follows:

```ts
{
  // Required - an identifier for your syntax
  id: 'my-syntax',

  // Tagged templates to look for
  tagNames: ['css'],

  // Custom sub-parser
  parser: lessSyntax.parse,

  // Custom sub-stringifier _class_
  stringifier: require('postcss-less/lib/LessStringifier.js')
}
```

### Tag names

We currently only support CSS in tagged template literals. The tags we consider
as stylesheets are specified by `tagNames` in the options object.

Any tagged templates using these names will have their contents treated
as CSS and extracted into PostCSS.

Two forms are supported:

- Exact tag names (e.g. `['css']`)
- Tag name prefixes (e.g. `['css.*']` would match `css.foo`, it is _not_ a
RegExp)

### Sub-syntax

You may want to support a "syntax within a syntax". For example, LESS sources
inside your JavaScript files.

In order to do this, you must pass the syntax's parser and stringifier _class_
in your options.

For example:

```ts
createParser({
  // ...
  parser: require('postcss-less').parse,
  stringifer: require('postcss-less/lib/LessStringifier.js')
});
```

**Importantly, you must pass the _class_ of the stringifier rather than the
stringify function.** This is so we can correctly extend it.

Two common ones are (at time of writing this) located at:

* SCSS - `postcss-scss/lib/scss-stringifier.js`
* LESS - `postcss-less/lib/LessStringifier.js`
