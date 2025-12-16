const {
  extractTimestampFromSegment,
  buildTranscriptEntriesFromSegments,
  formatTranscriptLines
} = require('./content');

function createMockSegment({ timestamp = '', text = '' } = {}) {
  return {
    querySelector(selector) {
      if (selector === '.segment-time' || selector === '#segment-time' || selector === '.segment-timestamp') {
        return timestamp === '' ? null : { textContent: timestamp };
      }
      if (selector === '.segment-text' || selector === '#segment-text') {
        return text === '' ? null : { textContent: text };
      }
      return null;
    }
  };
}

describe('content transcript helpers', () => {
  test('extractTimestampFromSegment reads modern segment timestamp without reformatting', () => {
    const segment = createMockSegment({ timestamp: '32:30' });
    expect(extractTimestampFromSegment(segment)).toBe('32:30');
  });

  test('formatTranscriptLines omits empty parentheses when timestamp is missing', () => {
    const lines = formatTranscriptLines([
      { timestamp: '01:00', text: 'Has timestamp' },
      { timestamp: '', text: 'No timestamp' }
    ]);
    expect(lines).toEqual(['(01:00) Has timestamp', 'No timestamp']);
  });

  test('buildTranscriptEntriesFromSegments errors when majority timestamps are missing', () => {
    const segments = [
      createMockSegment({ text: 'First without time' }),
      createMockSegment({ text: 'Second without time' }),
      createMockSegment({ timestamp: '00:05', text: 'Third with time' })
    ];
    expect(() => buildTranscriptEntriesFromSegments(segments)).toThrow('no timestamps available.');
  });

  test('buildTranscriptEntriesFromSegments keeps segments without timestamps when majority have them', () => {
    const segments = [
      createMockSegment({ timestamp: '00:01', text: 'First' }),
      createMockSegment({ text: 'Second without time' }),
      createMockSegment({ timestamp: '00:03', text: 'Third' })
    ];
    const result = buildTranscriptEntriesFromSegments(segments);
    expect(result).toEqual([
      { timestamp: '00:01', text: 'First' },
      { timestamp: '', text: 'Second without time' },
      { timestamp: '00:03', text: 'Third' }
    ]);
  });
});
