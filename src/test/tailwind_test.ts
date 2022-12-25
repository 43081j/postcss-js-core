import {createTailwindTransform} from '../tailwind.js';
import {expect} from 'chai';

describe('createTailwindTransform', () => {
  it('should do nothing if no tag names specified', () => {
    const source = `
      html\`
        <div>Foo</div>
      \`;
      css\`
        .foo { color: blue; }
      \`;
    `;
    const transform = createTailwindTransform({
      id: 'foo'
    });

    expect(transform(source)).to.equal(source);
  });

  it('should strip any specified tags by name', () => {
    const source = `
      html\`
        <div>Foo</div>
      \`;
      css\`
        .foo { color: blue; }
      \`;
    `;
    const expected = `html\`
        <div>Foo</div>
      \`;`;
    const transform = createTailwindTransform({
      id: 'foo',
      tagNames: ['css']
    });

    expect(transform(source)).to.equal(expected);
  });

  it('should strip CSS templates containing expressions', () => {
    const source = `
      css\`
        :host { background: cyan; }
      \`;
      css\`.foo { color: $\{expr}; }\`;
      html\`
        <div>$\{foo}</div>
        <p>$\{
          bar
        \}</p>
      \`;
    `;
    const expected = `html\`
        <div>$\{foo}</div>
        <p>$\{bar\}</p>
      \`;`;
    const transform = createTailwindTransform({
      id: 'foo',
      tagNames: ['css']
    });
    expect(transform(source)).to.equal(expected);
  });
});
