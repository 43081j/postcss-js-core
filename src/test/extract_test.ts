import {assert} from 'chai';
import {extractTemplatesFromSource} from '../extract.js';

describe('extract', () => {
  describe('extractTemplatesFromSource', () => {
    it('should be empty if no tag names (default)', () => {
      const result = extractTemplatesFromSource('', {
        id: 'foo'
      });
      assert.equal(result.size, 0);
    });

    it('should detect template tags', () => {
      const source = `
        css\`.foo {}\`;
        css\`.bar {}\`;
        nonsense\`.baz {}\`;
        const x = 5;
      `;
      const result = extractTemplatesFromSource(source, {
        id: 'foo',
        tagNames: ['css']
      });
      assert.equal(result.size, 2);
    });

    it('should detect wildcard tags', () => {
      const source = `
        css.one\`.foo {}\`;
        css.two\`.bar {}\`;
        nonsense\`.baz {}\`;
        css\`.bleh {}\`;
        const x = 5;
      `;
      const result = extractTemplatesFromSource(source, {
        id: 'foo',
        tagNames: ['css.*']
      });
      assert.equal(result.size, 2);
    });

    it('should parse typescript', () => {
      const source = `
        const x: number = 5;
        css\`.foo {}\`;
      `;
      const result = extractTemplatesFromSource(source, {
        id: 'foo',
        tagNames: ['css']
      });
      assert.equal(result.size, 1);
    });

    it('should parse jsx', () => {
      const source = `
        const x = (<div></div>);
        css\`.foo {}\`;
      `;
      const result = extractTemplatesFromSource(source, {
        id: 'foo',
        tagNames: ['css']
      });
      assert.equal(result.size, 1);
    });

    it('should respect disable comments', () => {
      const source = `
        // postcss-foo-disable-next-line
        css\`.foo {}\`;
      `;
      const result = extractTemplatesFromSource(source, {
        id: 'foo',
        tagNames: ['css']
      });
      assert.equal(result.size, 0);
    });

    it('should parse decorators', () => {
      const source = `
        @someDecorator()
        class Foo {}

        css\`.foo {}\`;
      `;
      const result = extractTemplatesFromSource(source, {
        id: 'foo',
        tagNames: ['css']
      });
      assert.equal(result.size, 1);
    });

    it('should respect babel options', () => {
      const source = `
        css\`.foo {}\`;
      `;
      const result = extractTemplatesFromSource(source, {
        id: 'foo',
        tagNames: ['css'],
        babelOptions: {
          plugins: []
        }
      });
      assert.equal(result.size, 1);
    });
  });
});
