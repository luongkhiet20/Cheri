# Feature Implementation Plan: Public Order Tracking

**Required subskill:** `superpowers:executing-plans` (inline execution)
**Goal:** Reuse and complete the current guest/member order tracking flow, including seeded demo orders, without exposing unnecessary PII.
**Architecture:** Preserve `/vi/tracking` and `POST /api/orders/track`; narrow the public response at the service boundary and keep guest verification data in POST body only.
**Tech Stack:** Angular 20, NestJS 11, Mongoose 8, TypeScript.
**Spec:** `docs/superpowers/specs/2026-10-06-order-tracking-design.md`
**Global Constraints:** Implement and test against synthetic fixtures without MongoDB; live seeded-order lookup/admin-visibility validation is deferred until the user configures the development DB. No schema/collection additions unless code proves required; no PII in URL/response; support current and explicitly supported legacy order shapes; do not expose real order records during validation.
**Review Focus:** Ownership of member orders, guest verification, uniform mismatch response, PII minimization, stable tracking of demo and legacy orders.

## Task 1: Characterize current tracking contract and establish failing checks

**Files:**
- `server/src/orders/orders.controller.ts`
- `server/src/orders/orders.service.ts`
- `client/src/app/user/pages/order-tracking/order-tracking.component.ts`
- `client/src/app/user/pages/order-tracking/order-tracking.component.html`
- `client/src/app/services/api.service.ts`
- Add focused tests only with an available/approved test runner; otherwise create reproducible request/response checks documented here.

**Steps:**
1. Map accepted identifiers/contact fields and legacy field fallbacks in `trackOrder`; map every field returned to the client and every field rendered.
2. Trace logged-in order selection and confirm that it is restricted to the authenticated user's own order.
3. Verify query-parameter handling; add failing checks for email/phone in URL, auto-submit without entered verification, response address/email leakage, and mismatch enumeration.
4. Verify the expected demo seed shape from the first workstream's seed builder/spec; do not connect to MongoDB in this worktree.

**Acceptance:** Contract gaps are captured by failing focused checks or reproducible cases before implementation.

## Task 2: Minimize tracking response and secure guest lookup behavior

**Files:**
- `server/src/orders/orders.service.ts`
- `server/src/orders/orders.controller.ts` only if request validation/types require it
- `client/src/app/user/pages/order-tracking/order-tracking.component.ts`
- `client/src/app/user/pages/order-tracking/order-tracking.component.html`
- `client/src/app/services/api.service.ts` only if request contract is inconsistent

**Steps:**
1. Shape an explicit public tracking response containing order/tracking identifiers, status/history, carrier/ETA, product summary, and only necessary payment/refund summary; omit email and full shipping address.
2. Keep guest lookup verification in POST body; remove query-based email/phone prefilling/autosubmit. A URL may carry a non-sensitive order identifier only.
3. Normalize invalid/missing identifier and contact failures to one generic response without disclosing whether an order exists.
4. Preserve legacy identifier/contact fallbacks already used by the service; avoid broad schema migration.
5. Update the UI to render only the narrowed response and preserve status timeline/member flow.

**Acceptance:** Correct guest credentials return the expected summary; wrong ID/contact produce indistinguishable generic failure; response and URL contain no email/full address; logged-in customers can only see their own orders.

## Task 3: Verify live, demo, and legacy tracking paths

**Files:**
- Relevant tracking service/component tests or documented manual-check notes.
- Modify production files only if a failing check identifies a defect.

**Steps:**
1. Run focused unit/request-shape checks with synthetic fixtures for demo order, current order shape, supported legacy shape, invalid ID/contact, returned/refunded state, and member-owned order selection. Defer live Mongo lookup until the DB target is explicitly configured.
2. Run server and client builds plus relevant lint checks.
3. Verify request URLs do not include email/phone and inspect serialized public responses for forbidden fields.
4. Record any environment-dependent manual checks that cannot be run without a local dev DB/session.

**Acceptance:** All code-level tracking cases pass; public response stays minimized; no real customer data is used for fixtures. Live Mongo/admin-to-tracking integration is recorded as deferred, not claimed complete.
