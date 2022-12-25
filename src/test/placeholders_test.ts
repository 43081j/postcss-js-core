import {
  createPlaceholderFunc,
  computePossiblePosition
} from '../placeholders.js';
import {PlaceholderFunc} from '../types.js';
import {assert} from 'chai';

describe('placeholders', () => {
  describe('computePossiblePosition', () => {
    it('should use default when empty', () => {
      const result = computePossiblePosition('');
      assert.equal(result, 'default');
    });

    it('should be statement if semi-colon encountered', () => {
      const result = computePossiblePosition('.foo { color: hotpink;');
      assert.equal(result, 'statement');
    });

    it('should be default if colon encountered', () => {
      const result = computePossiblePosition('.foo { color:');
      assert.equal(result, 'default');
    });

    it('should be block if closing paren encountered', () => {
      const result = computePossiblePosition('.foo { }');
      assert.equal(result, 'block');
    });

    it('should be statement if opening paren encountered', () => {
      const result = computePossiblePosition('.foo {');
      assert.equal(result, 'statement');
    });

    it('should handle spaces after prefix', () => {
      const result = computePossiblePosition('.foo { ');
      assert.equal(result, 'statement');
    });

    it('should be comment if opening comment encountered', () => {
      const result = computePossiblePosition('.foo {} /* foo ');
      assert.equal(result, 'comment');
    });

    it('should ignore key chars inside comments', () => {
      const result = computePossiblePosition('.foo { /* tricky } comment */');
      assert.equal(result, 'statement');
    });

    it('should handle block position with suffix', () => {
      const result = computePossiblePosition('.foo { }', '.bar { }');
      assert.equal(result, 'block');
    });

    it('should be selector if suffix is open paren & prefix is block', () => {
      const result = computePossiblePosition('.foo { }', '{');
      assert.equal(result, 'selector');
    });

    it('should handle spaces before suffix', () => {
      const result = computePossiblePosition('.foo { }', ' {');
      assert.equal(result, 'selector');
    });

    it('should be statement if suffix is colon & prefix is statement', () => {
      const result = computePossiblePosition('.foo { ', ': hotpink; }');
      assert.equal(result, 'property');
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
      assert.equal(result, 'POSTCSS_foo_808');
    });

    describe('default positions', () => {
      it('should use default placeholder', () => {
        const result = createPlaceholder(808, '/* some comment */');

        assert.equal(result, 'POSTCSS_foo_808');
      });
    });

    describe('selector positions', () => {
      it('should use default placeholder', () => {
        const result = createPlaceholder(808, '.foo {}', ' {}');

        assert.equal(result, 'POSTCSS_foo_808');
      });
    });

    describe('comment positions', () => {
      it('should use default placeholder', () => {
        const result = createPlaceholder(808, '/* foo ', ' bar */');

        assert.equal(result, 'POSTCSS_foo_808');
      });
    });

    describe('statement positions', () => {
      it('should use a comment placeholder', () => {
        const result = createPlaceholder(808, 'color: hotpink;');

        assert.equal(result, '/* POSTCSS_foo_808 */');
      });
    });

    describe('block positions', () => {
      it('should use a comment placeholder', () => {
        const result = createPlaceholder(808, '.foo { }');

        assert.equal(result, '/* POSTCSS_foo_808 */');
      });
    });

    describe('property positions', () => {
      it('should use a variable placeholder', () => {
        const result = createPlaceholder(808, '.foo { ', ': hotpink; }');

        assert.equal(result, '--POSTCSS_foo_808');
      });
    });
  });
});
