# Implementation Plan: API Logic & Architecture Refactor

This plan outlines the steps to refactor the API architecture and implement missing features as requested.

## 1. Auth & Onboarding Refactor
- [ ] **Merge Onboarding into Auth Flow**
    - Refactor `OnboardingController` to work seamlessly with `AuthController`.
    - Clarify responsibility: `AuthController` for account creation, `OnboardingController` (or `UserController`) for profile completion/preferences.
    - Ensure `POST /onboarding/complete` updates the *authenticated* user rather than creating a new one.
- [ ] **Remove Redundant Auth Route**
    - Remove `AuthController.getMe` and the `/api/auth/me` route.
    - Standardize on `UserController.getMe` (`/api/users/me`).

## 2. Controller Cleanup & Consolidation
- [ ] **Remove SeatsController**
    - Delete `src/controllers/seats/seats.controller.ts`.
    - Remove associated routes from `server.ts` or routes file.
- [ ] **Consolidate Reviews Logic**
    - Move review retrieval logic (`getReviews` currently stubbed in `VenueController`) into `ReviewsController`.
    - Ensure `ReviewsController` handles all review-related operations (Create, Read, Update, Delete).
    - Remove review stubs from `VenueController`.

## 3. Feature Implementation (Stubs -> Real)
- [ ] **Sports Controller**
    - Implement `getFixture` logic (currently empty/stubbed).
- [ ] **Billing Controller**
    - Implement `getInvoices`, `getTransactions`, `getPdf` logic.
    - Ensure it complements `SubscriptionsController` (handling non-subscription billing acts if any, or strictly exposing invoice history).
- [ ] **Discovery Controller**
    - Implement `getNearby` (venues near user).
    - Implement `search` (venues/matches by query).
    - Implement `getVenueDetails` (full details view).
- [ ] **Messaging Controller**
    - Implement `createConversation`.
    - Implement `getMessages`.
    - Implement `sendMessage`.
- [ ] **Notifications Controller**
    - Implement `getNotifications`.
    - Implement `markAsRead`.

## 4. Documentation
- [ ] **Document Waitlists**
    - Update `API_ROUTES.md` to include the user-side Waitlist routes found in `ReservationsController` (`joinWaitlist`, `leaveWaitlist`, `getWaitlist`).

## 5. Execution Order
1.  **Cleanup**: Remove Seats, Fix Auth/Me.
2.  **Refactor**: Onboarding & Reviews.
3.  **Documentation**: Update Waitlist docs.
4.  **Implementation**: Tackle the Controllers one by one (Billing, Sports, Discovery, Messaging, Notifications).
