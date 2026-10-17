# TWISTFUZZ — Confirmed Product and System Specification (for Codex)

This document consolidates decisions previously confirmed by the user. Do not silently override them. The visual direction is **Elegant Garden**, selected after the earlier Soft Blossom concept.

## Brand, UX, and asset requirements

- Official brand: **TWISTFUZZ** (not FUZZYWIRE). Retain supplied original logo, don't substitute stock logo.
- Approved theme: **Concept 2: Elegant Garden** — warm ivory, dusty rose, mauve/burgundy, soft sage accents; premium romantic handmade-floral visual language, mobile-responsive.
- Preserve source user product photos; catalog flyer prices are reference-only and unverified.
- Separate pages/interfaces for **Customer**, **Staff**, and **Admin/Owner**. User also requested matching banner, poster, slogans, icons and reusable UI components.
- 3D flowers should eventually resemble hand-crafted chenille/fuzzy-wire materials, not merely generic low-poly flowers. Procedural preview is an intermediate proof of concept.

## Technology architecture

- React + Vite + TypeScript; Tailwind styling desired (existing starter may use custom CSS); Three.js + React Three Fiber; Blender for final GLB/glTF assets.
- Firebase Authentication; Supabase PostgreSQL, Storage, Edge Functions and Realtime; Vercel frontend; GitHub source control.
- Resend for important transactional emails; Google Maps Platform for geocoding, road-distance pricing and live rider map.
- Firebase-to-Supabase integration needs verified Firebase JWTs, trusted role assignment, proper RLS and secure privileged Edge Functions. Do not trust client role claims or service secrets.

## Identity / roles

- Customer login `/login`: email/password + Google Sign-In; verified email required before checkout; account required to order, no guest checkout.
- Staff login `/staff/login`: email/password only, no public self-signup, admin-provisioned, optional MFA. May update authorized operational statuses, change stock-in/out/quantities with audit logs, and record cash collection, but cannot verify GCash or approve refunds or confirm orders.
- Admin login `/admin/login`: email/password only, no public self-signup, mandatory MFA (check Firebase/Identity Platform configuration), sole authority to confirm orders, verify GCash, approve refunds and assign/reassign riders. Secure pre-established admin recovery preserving MFA. Staff recovery assisted by admin; customer Firebase password reset.
- Separate protected dashboards, server-enforced RBAC, logged privileged operations.

## Catalog and 3D customizer

- Six flower models: **Tulip, Daisy, Sunflower, Gerbera, Rose, Lily**.
- Maximum **30 total stems** per custom bouquet, mix multiple flower types and colors.
- Colors vary per flower and are subject to inventory availability; Tulip pink/red/white/yellow/purple; Daisy white/pink/yellow/purple; Sunflower yellow/orange; Gerbera pink/red/orange/yellow/white/purple; Rose red/pink/white/purple/blue; Lily white/pink/yellow/orange.
- Wrappers: Kraft Brown, Pastel Pink, White, Lavender, Elegant Black.
- Ribbons: Standard Satin, Personalized Printed, No Ribbon.
- Add-ons: Message Card, Photo Card, Personalized Name Tag. No fairy lights in v1.
- Per-flower/per-stem cost + wrapper + ribbon + add-ons; assembly included in component prices. Actual component/catalog prices pending. Server must recalculate from trusted DB prices. No live checkout until approved prices.
- User should be able to save/reopen a design. V0.4 can implement explicitly labeled local-storage **preview drafts**, then secure per-user saved designs later.

## Payments and business process

- Cash and GCash payments; COD **ready-made only**; custom orders **full GCash advance payment**.
- Mixed cart containing ANY custom bouquet → **entire order prepaid by GCash**.
- GCash submit reference number + screenshot; admin verifies against actual transaction. Staff can record cash collection at pickup/delivery with amount, timestamp, actor, audit log. Admin-only refund approval.
- Customer cannot cancel after admin confirmation (subject to legal consumer rights); damaged/incorrect/unfulfilled order issues filed via website, optional photo evidence; admin reviews and grants appropriate refund, replacement or correction.
- Order transitions: Pending Confirmation → Admin Confirmed → Crafting if applicable → Ready for Pickup or Preparing for Dispatch → Out for Delivery as applicable → Completed. Ready-made in-stock can skip Crafting. Separate payment state and order state. Stock reservations on admin confirmation after required payment verification, with transactional concurrency controls.
- Inventory: track ready-made finished bouquets AND raw supplies; stock-based availability plus manual admin override; staff stock adjustments auditable.
- Notifications: all detailed status updates in-app; important order, payment, fulfillment and issue milestones via Resend email (provider not yet configured).

## Delivery / hours

- Own TWISTFUZZ staff/rider; Cainta and Taytay, Rizal only. Dispatch municipality Cainta; exact address privately configured later.
- Delivery fee = `max(40, 20 + 5 * ceil(road_kilometers))` in PHP; pickup delivery fee ₱0. Road distance through Google Maps; routing billing/key configuration pending.
- Monday–Friday, 9:00 AM–6:00 PM fulfillment; 5:00 PM same-day processing cutoff; preferred customer date up to 30 days, subject to admin approval.
- Foreground PWA GPS by assigned rider (not guaranteed in background), target update ~15 seconds, stale warning after 60 seconds; only latest precise location retained, purged within 24h after closure. Customer sees only their own assigned delivery; admin can monitor. Native rider app potential later.
- Only Admin assigns/reassigns riders. Delivery handoff with secure **6-digit OTP**, maximum **8h**, one-time, **5 failed attempts** then temporary lock/authorized reissue; hash/store securely, rate-limit, audit; can't mark completed without valid handoff process and required cash receipt.
- Staff reports failed delivery; admin contacts customer and decides reschedule/retry/appropriate refund; any extra delivery fee needs customer approval.

## Explicitly pending / deliberately deferred

- Exact real product and component prices **PENDING**. Flyer numbers are not official.
- Production lead times **DEFERRED** at user request; do not ask until user is ready.
- Exact dispatch address, route API keys, Resend domain/key, Firebase project configuration, Supabase project, RLS verification, MFA configuration, material quantities and production readiness are not set up.

## Delivery status / deployment honesty

Prior connected Vercel project `twistfuzz-bloom-preview` was created for a protected staging preview, but **v0.3 ZIP and any deployment may have different source versions**. Verify deployment content/build; do not assume sync. No TWISTFUZZ GitHub repo was found or created during this handoff. No live database or Firebase project was provisioned.
