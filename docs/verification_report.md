[🏠 Home](./index.md) | [🏗️ Architecture](./architecture.md) | [🔌 API Routes](./api_routes.md) | [📊 Status](./status_report.md)

---

# API Route Verification Report

This report summarizes the verification of the `match-api` implementation against the documented `api_routes.md`.

## Summary
- **Total Controllers Reviewed**: 15+
- **Status**: Mixed. Core business logic (Venues, Reservations, Partners, Subscriptions, Boosts, Fidelity) is largely implemented. Peripheral features (Discovery, Messaging, Notifications, Reviews, Billing, Seats) are currently stubs.
- **Critical Mismatches**: Onboarding flow and Auth/Me behavior.

## Detailed Findings

### ✅ Implemented & Verified
The following controllers appear to be legally implemented and match the documentation (logic exists, though bugs may exist):
- **Venues**: CRUD, Photos, Opening Hours, Amenities, Favorites.
- **Partners**: Venue creation, Matches management, Reservations management, Analytics, Waitlist (owner side).
- **Reservations**: Creation (Instant/Request), Status flow, QR Verification, Check-in.
- **Subscriptions**: Plans, Checkout, Management.
- **Boosts**: Full implementation.
- **Fidelity**: Full implementation.
- **Referral**: Full implementation.
- **Sports**: Sports, Leagues, Teams.
- **Matches**: Listings, Details, Upcoming.

### ⚠️ Partial or Discrepant
- **Auth**:
  - `GET /api/auth/me`: Returns 301 Redirect to `/users/me`. Docs imply it returns user object directly.
- **Onboarding**:
  - `POST /api/onboarding/complete`: Code performs **User Creation** (Registration) + Preferences. Docs imply it updates **Existing User** preferences. This is a significant logic mismatch.
- **Sports**:
  - `GET /api/sports/fixture`: Method exists but body is empty (`try {} catch...`).
- **Waitlist (User-side)**:
  - `ReservationsController` contains `joinWaitlist`, `leaveWaitlist`, `getWaitlist` which are NOT documented in `api_routes.md` under Reservations (only under Partner for viewing).
- **Billing**:
  - `BillingController` is all stubs. However, `SubscriptionsController` implements `getMyInvoices`, creating potential duplication or confusion.

### ❌ Stubs (Not Implemented)
The following controllers exist but their methods return placeholder responses (e.g., `{ msg: "..." }`):
- **Discovery** (`DiscoveryController`): Nearby scanning, Map details, Search.
- **Messaging** (`MessagingController`): Conversations, Messages.
- **Notifications** (`NotificationsController`): Listing, Mark as read.
- **Reviews** (`ReviewsController`): CRUD for reviews.
- **Seats** (`SeatsController`): Seat maps, Reservation (specific seats), Pricing.
- **Venues**: `getReviews`, `getMatches`, `getAvailability` methods in `VenueController` are stubs.

## Recommendations

1.  **Fix Onboarding**: Align `OnboardingController.complete` to update the authenticated user instead of creating a new one, or update docs if this is intended to be a sign-up step.
2.  **Implement Discovery**: Critical for user experience (finding venues).
3.  **Implement Reviews**: Essential for social proof.
4.  **Implement Messaging/Notifications**: Needed for user-venue communication.
5.  **Clarify Billing**: Decide if `BillingController` is needed or if `SubscriptionsController` covers it.
6.  **Update api_routes.md**: Add the user-side Waitlist routes found in `ReservationsController`.


---
[« Back to Documentation Index](./index.md)
