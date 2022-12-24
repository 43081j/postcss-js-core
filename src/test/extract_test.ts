import {expect} from 'chai';
import {extractTemplatesFromSource} from '../extract.js';

describe('extract', () => {
  describe('extractTemplatesFromSource', () => {
    it('should be empty if no tag names (default)', () => {
      const result = extractTemplatesFromSource('', {
        id: 'foo'
      });
      expect(result.size).to.equal(0);
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
      expect(result.size).to.equal(2);
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
      expect(result.size).to.equal(1);
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
      expect(result.size).to.equal(1);
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
      expect(result.size).to.equal(0);
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
      expect(result.size).to.equal(1);
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
      expect(result.size).to.equal(1);
    });
  });
});
