# Feature Implementation Plan: Storefront Keyword Search

**Required subskill:** `superpowers:executing-plans` (inline execution)
**Goal:** Audit and repair only demonstrated issues in storefront keyword search; preserve the image-search analysis as deferred work.
**Architecture:** Reuse the existing search modal, `search` query parameter, product listing and backend search service. Do not implement image search in this cycle.
**Tech Stack:** Angular 20, NestJS 11, TypeScript.
**Spec:** `docs/superpowers/specs/2026-10-06-storefront-search-design.md`
**Global Constraints:** No external AI APIs; no image-search code changes; preserve Vietnamese search/token behavior; do not expand into unrelated product filtering.
**Review Focus:** Query persistence across pagination/filter/sort, empty and clear states, no accidental unfiltered results, Vietnamese keyword flow, image work remains untouched.

## Task 1: Trace and characterize keyword search behavior

**Files:**
- `client/src/app/user/shared/search-modal/search-modal.component.ts`
- `client/src/app/user/shared/search-modal/search-modal.component.html`
- `client/src/app/user/pages/product/products/products.component.ts`
- Product search controller/service under `server/src/products/` (locate exact files during execution).
- Add focused automated checks only if the repo's test runner is available; otherwise record reproducible browser/API scenarios.

**Steps:**
1. Trace modal submit through router query, product-list state, API request, and backend token matching.
2. Characterize Vietnamese terms, empty keyword, no results, clear-search, pagination and sort/filter changes.
3. Inspect image-search modal/controller/service solely to retain the already-approved analysis; do not edit those files.
4. Write failing checks for any observed keyword-search defect before implementing a correction.

**Acceptance:** Existing working paths are distinguished from concrete defects; image search remains unchanged.

## Task 2: Correct only proven keyword-search defects

**Files:** Limit to the storefront search/product list and backend keyword-search files identified in Task 1.

**Steps:**
1. Preserve the search term whenever pagination, sort or supported filters change.
2. Ensure empty query and clear-search return to the unfiltered listing intentionally, and no-results presents a useful empty state.
3. Fix only behavior covered by a failing test/repro; preserve the existing Vietnamese normalization/tokenization and API contract.
4. Do not alter image upload, image endpoint, image service, provider configuration, or `imageSearch` behavior in this cycle.

**Acceptance:** Modal keyword search reaches the correct filtered store results; query survives list controls; clearing resets search; empty state is clear; no image-search implementation changes appear in diff.

## Task 3: Verify search flow and preserve deferred image analysis

**Files:**
- Relevant search tests/check notes.
- `docs/superpowers/specs/2026-10-06-storefront-search-design.md` only if implementation reveals a factual correction.

**Steps:**
1. Run search-focused tests/checks for Vietnamese query, pagination, sort/filter, empty query and zero results.
2. Run client/server builds and relevant lint checks.
3. Review diff to confirm image-search files and external-provider integration remain untouched.
4. Report current image-search scaffold, no-match/failure routing risk and deferred no-external-AI constraint for a future separate plan.

**Acceptance:** Keyword flow is verified; deferred image-search analysis is accurate; no image feature implementation is included.
