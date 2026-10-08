# Chat Widget UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. The user requested implementation of the existing approved design; preserve that execution choice.

**Goal:** Add an accessible, responsive Chéri chat prototype to storefront pages.
**Architecture:** A standalone Angular component owns only in-memory UI state. The root shell mounts it using the existing `!isDashboard` condition. No service, backend, AI or persistence is introduced.
**Tech Stack:** Angular 20, TypeScript, CSS, Node test runner.
**Spec:** `docs/superpowers/specs/2026-10-06-chat-widget-ui-design.md`

## Global Constraints

- User requested a new worktree per feature; use `feature/chat-widget-ui` from committed admin checkpoint `11225b4`.
- Do not edit or commit the user's local MongoDB configuration.
- No API/AI calls, database writes, storage or invented staff responses.
- Show a greeting, local message bubbles, composer and send control; clearly label the prototype.
- Admin pages must not render the widget. Preserve existing route classification and all other storefront behavior.

## Review Focus

- Empty messages, Vietnamese text, HTML-looking input and Enter during IME composition.
- Focus on opening, focus restoration on closing and Escape without affecting unrelated page controls.
- Narrow/short viewports, safe-area insets and a scrollable message area.
- SSR without browser globals; component recreated with no persisted conversation.
- Root-shell render with `isDashboard=true` must contain no chat controls.

## Task 1: Standalone chat prototype

**Files:** Add `client/src/app/user/shared/chat-widget/chat-widget.component.ts`, `.html`, `.css`, and `chat-widget.test.cjs`.
**Interfaces:** Produces `ChatWidgetComponent`: `isOpen` and `messages` signals, `draft: string`, `openChat()`, `closeChat()`, `sendMessage()`, `onEnter(event: KeyboardEvent)`, `onEscape(event: KeyboardEvent)`.

- [ ] Write behavioral tests for closed initial state, open/close, trimmed local messages, blank/overlong rejection, Shift+Enter/IME preservation, Escape, focus restoration and fresh-instance reset.
- [ ] Run `node --test client/src/app/user/shared/chat-widget/chat-widget.test.cjs`; expect failures before the component exists.
- [ ] Implement standalone component and burgundy/cream responsive UI with a labelled nonmodal dialog, polite message log, textarea (1000-character limit), launcher and close/send buttons. All state remains in memory; keep received greeting static.
- [ ] Rerun focused and existing seed/CSV tests; expect all passing.
- [ ] Commit the component and its tests with a Vietnamese commit message.

## Task 2: Storefront integration and verification

**Files:** Modify `client/src/app/app.component.ts` and `.html`; extend `chat-widget.test.cjs` with real-template rendering checks; update spec with verification results.
**Interfaces:** Consumes `ChatWidgetComponent` from Task 1 and existing shell `isDashboard` flag. No new route logic or backend interface.

- [ ] Render the real shell template with controlled storefront/admin state and assert chat appears only in storefront; expect storefront failure before mounting.
- [ ] Import/mount `<app-chat-widget *ngIf="!isDashboard">` in the existing shell.
- [ ] Run all available tests, `npm.cmd run build:client`, targeted widget lint and `git diff --check`; verify scope contains no backend/Mongo/variant changes.
- [ ] Exercise desktop/mobile and keyboard interactions in an isolated preview if a local browser is available; otherwise record browser checks as unverified.
- [ ] Commit integration and verification notes; request one fresh whole-branch review, address Important/Critical findings with regression tests and keep the branch/worktree local.
