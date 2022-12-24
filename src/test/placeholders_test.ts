import {
  createPlaceholderFunc,
  computePossiblePosition
} from '../placeholders.js';
import {PlaceholderFunc} from '../types.js';
import {expect} from 'chai';

describe('placeholders', () => {
  describe('computePossiblePosition', () => {
    it('should use default when empty', () => {
      const result = computePossiblePosition('');
      expect(result).to.equal('default');
    });

    it('should be statement if semi-colon encountered', () => {
      const result = computePossiblePosition('.foo { color: hotpink;');
      expect(result).to.equal('statement');
    });

    it('should be default if colon encountered', () => {
      const result = computePossiblePosition('.foo { color:');
      expect(result).to.equal('default');
    });

    it('should be block if closing paren encountered', () => {
      const result = computePossiblePosition('.foo { }');
      expect(result).to.equal('block');
    });

    it('should be statement if opening paren encountered', () => {
      const result = computePossiblePosition('.foo {');
      expect(result).to.equal('statement');
    });

    it('should handle spaces after prefix', () => {
      const result = computePossiblePosition('.foo { ');
      expect(result).to.equal('statement');
    });

    it('should be comment if opening comment encountered', () => {
      const result = computePossiblePosition('.foo {} /* foo ');
      expect(result).to.equal('comment');
    });

    it('should ignore key chars inside comments', () => {
      const result = computePossiblePosition('.foo { /* tricky } comment */');
      expect(result).to.equal('statement');
    });

    it('should handle block position with suffix', () => {
      const result = computePossiblePosition('.foo { }', '.bar { }');
      expect(result).to.equal('block');
    });

    it('should be selector if suffix is open paren & prefix is block', () => {
      const result = computePossiblePosition('.foo { }', '{');
      expect(result).to.equal('selector');
    });

    it('should handle spaces before suffix', () => {
      const result = computePossiblePosition('.foo { }', ' {');
      expect(result).to.equal('selector');
    });

    it('should be statement if suffix is colon & prefix is statement', () => {
      const result = computePossiblePosition('.foo { ', ': hotpink; }');
      expect(result).to.equal('property');
    });
  });

  describe('createPlaceholder', () => {
    let createPlaceholder: PlaceholderFunc;

    beforeEach(() => {
      createPlaceholder = createPlaceholderFunc({
        id: 'foo'
      });
    });

    it('should use default placeholder if no prefix', () => {
      const result = createPlaceholder(808);
      expect(result).to.equal('POSTCSS_foo_808');
    });

    describe('default positions', () => {
      it('should use default placeholder', () => {
        const result = createPlaceholder(808, '/* some comment */');

        expect(result).to.equal('POSTCSS_foo_808');
      });
    });

    describe('selector positions', () => {
      it('should use default placeholder', () => {
        const result = createPlaceholder(808, '.foo {}', ' {}');

        expect(result).to.equal('POSTCSS_foo_808');
      });
    });

    describe('comment positions', () => {
      it('should use default placeholder', () => {
        const result = createPlaceholder(808, '/* foo ', ' bar */');

        expect(result).to.equal('POSTCSS_foo_808');
      });
    });

    describe('statement positions', () => {
      it('should use a comment placeholder', () => {
        const result = createPlaceholder(808, 'color: hotpink;');

        expect(result).to.equal('/* POSTCSS_foo_808 */');
      });
    });

    describe('block positions', () => {
      it('should use a comment placeholder', () => {
        const result = createPlaceholder(808, '.foo { }');

        expect(result).to.equal('/* POSTCSS_foo_808 */');
      });
    });

    describe('property positions', () => {
      it('should use a variable placeholder', () => {
        const result = createPlaceholder(808, '.foo { ', ': hotpink; }');

        expect(result).to.equal('--POSTCSS_foo_808');
      });
    });
  });
});
