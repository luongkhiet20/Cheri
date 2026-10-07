# Feature Implementation Plan: Admin Orders and Safe Demo Seed

**Required subskill:** `superpowers:executing-plans` (inline execution)
**Goal:** Audit/fix the existing admin order workflow and add repeatable synthetic MongoDB orders visible in admin and usable for tracking.
**Architecture:** Keep existing NestJS order API and Angular admin screen. Add an isolated seed command with explicit development-database opt-in and stable demo identifiers; never reuse the legacy destructive seed script.
**Tech Stack:** Angular 20, NestJS 11, Mongoose 8, TypeScript, repository build/lint commands.
**Spec:** `docs/superpowers/specs/2026-10-06-order-admin-seed-design.md`
**Global Constraints:** No product-description or database changes outside the explicit demo-order seed; no production DB access; no stock decrement or email; do not add order `isActive` semantics; CSV must remain CSV; do not change unrelated admin behavior.
**Review Focus:** Seed environment guard/idempotency, no destructive query, order status/payment snapshots, payment filter compatibility, refund display, CSV correctness, and the explicit toggle audit.

## Task 1: Add a safe, isolated demo-order seed command

**Files:**
- Add `server/src/scripts/seed-demo-orders.cjs` and pure helpers in `server/src/scripts/demo-order-seed-core.cjs`.
- Add runnable root `package.json` scripts `seed:demo-orders` and `test:seed-demo-orders`.
- Use Node's built-in `node:test` in `server/test/seed-demo-orders.test.cjs`; no new test dependency is needed.

**Steps:**
1. Inspect `server/src/orders/schemas/order.schema.ts`, product and payment-method schemas, existing order constructors, and package scripts. Derive valid required fields and legacy-compatible fields from source.
2. Define the seed identity with a stable prefix/tag and deterministic order IDs; seed only synthetic customer/contact values and existing products/payment methods.
3. Add a failing test/guard check proving default invocation does not connect/write and non-development/unspecified DBs are rejected.
4. Implement explicit opt-in (e.g. `SEED_DEMO_ORDERS=true`) plus an exact allowed database name/URI check; refuse production and unknown DB names before connecting/writing.
5. Upsert only records with the demo marker/order IDs; preflight reserved IDs and never `deleteMany`, clear collections, change stock, send mail, or overwrite non-demo records. Support safe repeat runs.
6. Run focused checks and server build; inspect the final seed diff for destructive operations.

**Acceptance:** Default run is inert; only explicitly selected development DB is allowed; two runs yield the same number/content of demo records; existing data is untouched; admin can distinguish synthetic orders; tracking credentials are stable and documented without using real PII.

## Task 2: Verify and repair admin order behavior, including toggle audit

**Files:**
- `client/src/app/admin/pages/orders/orders.component.ts`
- `client/src/app/admin/pages/orders/orders.component.html`
- `client/src/app/admin/pages/orders/order-detail/order-detail.component.ts`
- `client/src/app/admin/pages/orders/order-detail/order-detail.component.html`
- `client/src/app/admin/pages/orders/order-form/order-form.component.ts`
- `server/src/orders/orders.service.ts`
- Relevant order/payment schemas only if source proves a missing field.

**Steps:**
1. Audit create/edit/delete/search/status/payment filters/detail and trace API data shapes. Record the requested Bật/Tắt check explicitly across component/template/API/service/schema. Do not infer a new enabled/disabled state for orders.
2. Audit return/refund enum fields, allowed transitions, detail labels/history, filter and exported values. Add a test or reproducible focused check for each concrete discrepancy before editing.
3. Audit payment filter against payment-method management data, including IDs/codes/snapshots and inactive historical methods; fix only demonstrated mismatch.
4. Audit CSV generation and fix only concrete issues: `.csv`, `text/csv;charset=utf-8`, UTF-8/Excel-friendly Vietnamese, correct escaping for commas/quotes/newlines, and selected/report columns. Do not introduce XLSX.
5. Run client/server builds and available lint/checks. Document any toggle behavior that is absent and leave it unchanged if no order-specific semantics exist.

**Acceptance:** Existing CRUD/search/filter/detail remain functional; returned/refunded values are represented consistently; payment filter uses configured methods while retaining legacy values; export downloads valid CSV; toggle is explicitly audited and no speculative `isActive` is added.

## Task 3: Admin-visible validation of seeded orders

**Files:**
- `client/src/app/admin/pages/orders/orders.component.ts` and `.html` only if validation exposes a display/filter defect.
- `docs/superpowers/plans/2026-10-06-order-admin-seed.md` for a short execution/verification note if needed.

**Steps:**
1. Build the app and start the required services against a specifically named development database only; never use an inherited/unknown connection string. If the target is not configured and explicitly authorized, stop before connecting and request it.
2. Run the safe seed command twice and compare the marked demo-order count and stable identifiers.
3. Verify list, search, status/payment filters, order detail, return/refund display, CSV download and the toggle audit using demo records.
4. If UI defects are found, add a failing focused test/check first, repair only the relevant admin surface, and rerun checks.
5. Confirm no product stock, non-demo order, payment method or email changed; report manual checks that could not be performed without local credentials.

**Acceptance:** Seeded records are visible in admin; all listed admin checks are evidenced; seed remains repeatable; no unrelated records or external systems are changed.

## Progress checkpoint — 2026-10-07

- Task 1: Seed command and guards are implemented. Five focused tests cover explicit development-target authorization, synthetic fixtures, idempotent synchronization, and collision protection using doubles. No live database has been connected or seeded.
- Task 2: Code audit and targeted fixes are implemented. Payment filters load configured methods across API pages and retain historical values. Existing return/refund fields are present; refund labels and detail display are covered by the changes. CSV export uses `.csv` and `text/csv;charset=utf-8`; three focused tests cover escaping, formula-safe text, and refund labels.
- Toggle audit: No order-specific enable/disable action or `isActive` field was found in the order UI/API/schema. No speculative toggle was added; `isActive` usage in the form belongs to product variants/payment methods.
- Task 3: Pending live MongoDB/admin validation, explicitly deferred by the user. Seed twice/count comparison, actual CRUD/filter/detail checks, and browser CSV download still need a named development database and a working session.
- Verification at this checkpoint: focused seed/CSV tests pass 8/8; `node --check server/admin-server.js` passes. Build results are recorded in the GitHub handoff.
- This checkpoint is on `feature/admin-orders`; order tracking and storefront search remain in their separate worktrees/branches.
