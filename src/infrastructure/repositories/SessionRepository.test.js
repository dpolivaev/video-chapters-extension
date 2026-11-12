const { loadSessionRepository } = require('../../../test/helpers/view-environment');

describe('SessionRepository', () => {
  test('reports subtitles-only sessions as subtitles_only', () => {
    const SessionRepository = loadSessionRepository();
    const repository = new SessionRepository();
    const transcript = new VideoTranscript('Subtitle content', 'Title', 'Author', 'https://youtube.com/watch?v=testid');
    const session = new ChapterGeneration(transcript, null, '', true);

    repository.fromSessionResults(session.toSessionResults());

    expect(repository.getGenerationStatus(String(session.id))).toBe('subtitles_only');
    expect(repository.findAllPendingSessions()).toEqual([]);
    expect(repository.findAllCompletedSessions()).toEqual([]);
  });
});
