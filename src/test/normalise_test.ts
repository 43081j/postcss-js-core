import {expect} from 'chai';
import {TaggedTemplateExpression} from '@babel/types';
import {computeNormalisedSource} from '../normalise.js';
import {extractTemplatesFromSource} from '../extract.js';
import {computeReplacedSource} from '../replacements.js';

const computeNodeAndSource = (
  source: string
): [string, TaggedTemplateExpression] => {
  const templates = extractTemplatesFromSource(source, {
    id: 'foo',
    tagNames: ['css']
  });
  const template = [...templates][0]!;
  const replacedSource = computeReplacedSource(source, template, () => '');
  return [replacedSource.result, template];
};

describe('normalise', () => {
  describe('computeNormalisedSource', () => {
    it('should compute prefixing newlines', () => {
      const source = `css\`
        .foo { color: hotpink; }
      \`;`;
      const [templateSource, template] = computeNodeAndSource(source);
      const result = computeNormalisedSource(templateSource, template);

      expect(result.prefixOffsets).to.deep.equal({
        lines: 1,
        offset: 1
      });
    });

    it('should compute prefixing tabs', () => {
      const source = `css\`\t\t\t
        .foo { color: hotpink; }
      \`;`;
      const [templateSource, template] = computeNodeAndSource(source);
      const result = computeNormalisedSource(templateSource, template);

      expect(result.prefixOffsets).to.deep.equal({
        lines: 1,
        offset: 4
      });
    });

    it('should compute prefixing spaces', () => {
      const source = `css\`\u0020\u0020\u0020
        .foo { color: hotpink; }
      \`;`;
      const [templateSource, template] = computeNodeAndSource(source);
      const result = computeNormalisedSource(templateSource, template);

      expect(result.prefixOffsets).to.deep.equal({
        lines: 1,
        offset: 4
      });
    });

    it('should compute normalise whitespace', () => {
      const source = `css\`
        .foo { color: hotpink; }
      \`;`;
      const [templateSource, template] = computeNodeAndSource(source);
      const normalised = computeNormalisedSource(templateSource, template);

      expect([...normalised.values]).to.deep.equal([
        [1, 6],
        [2, 6],
        [-1, 6]
      ]);
      expect(normalised.result).to.equal('  .foo { color: hotpink; }\n');
    });

    it('should leave deindented lines untouched', () => {
      const source = `css\`
    .foo { color: hotpink; }\`;`;
      const [templateSource, template] = computeNodeAndSource(source);
      const normalised = computeNormalisedSource(templateSource, template);

      expect([...normalised.values]).to.deep.equal([]);
      expect(normalised.result).to.equal('    .foo { color: hotpink; }');
    });

    it('should handle source with no padding', () => {
      const source = `css\`.foo { color: hotpink; }\`;`;
      const [templateSource, template] = computeNodeAndSource(source);
      const normalised = computeNormalisedSource(templateSource, template);

      expect([...normalised.values]).to.deep.equal([]);
      expect(normalised.result).to.equal('.foo { color: hotpink; }');
    });
  });
});
