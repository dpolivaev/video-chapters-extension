const { loadView, loadSessionRepository } = require('../../test/helpers/view-environment');

describe('ResultsView', () => {
  test('uses subtitles-only results when the status check fails', async () => {
    const environment = loadView(__dirname, 'ResultsView');
    const transcript = new VideoTranscript('Subtitle content', 'Title', 'Author', 'https://youtube.com/watch?v=testid');
    const session = new ChapterGeneration(transcript, null, '', true);
    environment.browser.runtime.sendMessage.mockImplementation(async request => {
      if (request.action === 'getGenerationStatus') {
        return { success: false };
      }
      return { success: true, results: session.toSessionResults() };
    });
    const view = Object.create(environment.View.prototype);
    Object.assign(view, { resultId: session.id, results: null, status: 'pending', chatHistory: [] });

    await view.checkStatusAndInit();

    expect(view.status).toBe('subtitles_only');
    expect(environment.elements.subtitlesContent.value).toBe(transcript.content);
    expect(environment.elements.subtitlesTab.classList.contains('active')).toBe(true);
    expect(environment.elements.progressSection.style.display).toBe('none');
    expect(environment.setTimeout).not.toHaveBeenCalled();
  });

  test('displays subtitles without generation timers or chat', async () => {
    const environment = loadView(__dirname, 'ResultsView');
    const transcript = new VideoTranscript(
      '0:00 Subtitle content', 'Video title', 'Video author',
      'https://youtube.com/watch?v=testid', 'en', 'English', true
    );
    const SessionRepository = loadSessionRepository();
    const sessions = new SessionRepository();
    const session = new ChapterGeneration(transcript, null, '', true);
    sessions.fromSessionResults(session.toSessionResults());
    environment.browser.runtime.sendMessage.mockImplementation(async request => {
      if (request.action === 'getGenerationStatus') {
        return { success: true, status: sessions.getGenerationStatus(request.resultId) };
      }
      return { success: true, results: sessions.toSessionResults(request.resultId) };
    });
    const view = Object.create(environment.View.prototype);
    Object.assign(view, {
      resultId: session.id, results: null, status: 'pending', userSwitchedTab: false, chatHistory: []
    });

    await view.checkStatusAndInit();

    const { elements, document, browser } = environment;
    expect(elements.subtitlesContent.value).toBe(transcript.content);
    expect(elements.subtitleInfo.textContent).toContain('English');
    expect(elements.pageTitle.textContent).toBe('tab_subtitles');
    expect(elements.subtitlesTab.classList.contains('active')).toBe(true);
    expect(elements.chaptersTab.classList.contains('active')).toBe(false);
    expect(elements.chaptersHtml.textContent).toBe('');
    expect(elements.chatSection.style.display).toBe('none');
    expect(elements.progressSection.style.display).toBe('none');
    expect(environment.setTimeout).not.toHaveBeenCalled();
    expect(browser.runtime.sendMessage.mock.calls.filter(([request]) => request.action === 'getGenerationStatus')).toHaveLength(1);

    await elements.copySubtitlesBtn.dispatch('click');
    expect(environment.navigator.clipboard.writeText).toHaveBeenCalledWith(transcript.content);

    const chapterTab = document.querySelectorAll('.tab-btn').find(button => button.dataset.tab === 'chapters');
    await chapterTab.dispatch('click');
    expect(elements.chaptersTab.classList.contains('active')).toBe(true);
    expect(elements.chatSection.style.display).toBe('none');
    elements.chatInput.value = 'Should not be sent';
    await elements.sendChatBtn.dispatch('click');
    expect(browser.runtime.sendMessage).not.toHaveBeenCalledWith(expect.objectContaining({ action: 'sendChatMessage' }));
  });
});
