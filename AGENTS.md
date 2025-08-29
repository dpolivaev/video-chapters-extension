Read and use information from CLAUDE.md in this directory.

## Changelog Authoring Policy

Write changelogs for users. Use simple, purpose‑first language and include only user‑visible changes since the previous release. Follow Keep a Changelog format.

### Audience and Tone
- Plain, easy language; avoid internal/technical details.
- Explain the benefit or purpose of a change, not the implementation.

### Scope
- Cover all user‑facing changes since the last released version, not just the current task’s work.
- Exclude refactors, tests, code moves, or backend cleanups unless they change visible behavior.

### Structure
- Add a new section at the top: `## [x.y.z]`.
- Group items under `### Added`, `### Changed`, `### Fixed` (omit empty groups).
- Use short, scannable bullets; 1 line each when possible.

### Content Rules (applied in 1.4.1 and going forward)
- Instruction naming UX: mention when the name field appears in the popup header, expands to fill space, or shows a localized placeholder when empty.
- Instruction selection: call out that choosing an item from history also copies its name into the popup and saves it automatically.
- Model picker pricing: explicitly surface price information updates (e.g., free models listed first; paid models show a pricing tooltip) and clearer display names.
- Layout polish: note only visible layout improvements that affect the user experience (e.g., spacing or token display position in chat).

### Exclusions
- Do not include internal API unification, storage refactors, or implementation details unless they change the user experience.
- Do not list temporary workarounds or debugging notes.

### Process Checklist
1. Scan the git log since the previous release tag/version.
2. Collect user‑visible changes and map them to Added/Changed/Fixed.
3. Write purpose‑focused bullets in simple language.
4. Place the new section at the top of `CHANGELOG.md`.
5. Re‑read for user perspective and clarity.
