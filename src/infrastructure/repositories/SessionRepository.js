/**
 * SessionRepository
 * Manages session storage for chapter generation sessions
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class SessionRepository {
  constructor() {
    this.sessions = new Map();
    this.sessionsByTab = new Map();
    this.activeSession = null;
  }

  save(chapterGeneration) {
    if (!(chapterGeneration instanceof ChapterGeneration)) {
      throw new Error('Can only save ChapterGeneration instances');
    }

    this.sessions.set(chapterGeneration.id, chapterGeneration);

    this.activeSession = chapterGeneration;

    return chapterGeneration.id;
  }

  findById(sessionId) {
    const normalizedId = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
    return this.sessions.get(normalizedId) || null;
  }

  findByTabId(tabId) {
    const sessionId = this.sessionsByTab.get(tabId);
    return sessionId ? this.findById(sessionId) : null;
  }

  associateWithTab(sessionId, tabId) {
    if (!this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.sessionsByTab.set(tabId, sessionId);
  }

  getActiveSession() {
    return this.activeSession;
  }

  findAllPendingSessions() {
    return Array.from(this.sessions.values()).filter(session => session.isPending());
  }

  findAllCompletedSessions() {
    return Array.from(this.sessions.values()).filter(session => session.isCompleted());
  }

  remove(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);

      for (const [tabId, storedSessionId] of this.sessionsByTab.entries()) {
        if (storedSessionId === sessionId) {
          this.sessionsByTab.delete(tabId);
        }
      }

      if (this.activeSession?.id === sessionId) {
        this.activeSession = null;
      }

      return true;
    }
    return false;
  }

  clear() {
    this.sessions.clear();
    this.sessionsByTab.clear();
    this.activeSession = null;
  }

  getCount() {
    return this.sessions.size;
  }

  exists(sessionId) {
    return this.sessions.has(sessionId);
  }

  toSessionResults(sessionId) {
    const session = this.findById(sessionId);
    return session ? session.toSessionResults() : null;
  }

  fromSessionResults(results) {
    const session = ChapterGeneration.fromSessionResults(results);
    this.save(session);
    return session;
  }

  getAllSessionResults() {
    const results = {};
    for (const [id, session] of this.sessions.entries()) {
      results[id] = session.toSessionResults();
    }
    return results;
  }

  getGenerationStatus(sessionId) {
    const session = this.findById(sessionId);
    if (!session) {
      return 'not_found';
    }

    if (session.isPending()) {
      return 'pending';
    }
    if (session.isCompleted()) {
      return 'done';
    }
    if (session.isFailed()) {
      return 'error';
    }

    return 'unknown';
  }
}
