[🏠 Home](./index.md) | [🏗️ Architecture](./architecture.md) | [🔌 API Routes](./api_routes.md) | [📊 Status](./status_report.md)

---

# Match Project — Complete API Routes Documentation

**Production-ready API routes for Match platform**  
*Last updated: February 2026*

## 💼 Business Model

- **Venue owners pay** for subscriptions (Stripe-integrated)
- **Users don't pay** — reservations are completely FREE (like booking a restaurant table)
- Users book a table by party size, receive a QR code, venue owner scans to verify

---

## 📋 API Structure Overview

```
Base URL: /api
Authentication: Bearer token (JWT)
Response format: JSON
Pagination: limit, offset (or page, limit) query params
```

### Protected Routes (Require Authentication)
- `/api/partners/*` — All partner routes (Venue Owner only)
- `/api/users/*` — All user routes  
- `/api/reservations/*` — All reservation routes
- `/api/referral/*` — Referral system
- `/api/boosts/*` — Boost system
- `/api/fidelity/*` — Loyalty program
- `/api/notifications/*` — Notifications

---

## 🔐 Authentication Routes (`/api/auth`)

### POST /api/auth/register
**Register new user (regular user or venue owner)**

```typescript
Request body:
{
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: 'user' | 'venue_owner' | 'admin';
  // Optional Onboarding Fields
  referralCode?: string;
  fav_sports?: string[];
  ambiances?: string[];
  venue_types?: string[];
  budget?: string;
}

Response: 200
{
  user: User;
  token: string;
  refresh_token: string;
}
```

### POST /api/auth/login
**Login with email and password**

```typescript
Request body:
{
  email: string;
  password: string;
}

Response: 200
{
  user: User;
  token: string;
  refresh_token: string;
}
```

### POST /api/auth/google
**Login or register with Google ID token**

```typescript
Request body:
{
  id_token: string;
}

Response: 200
{
  user: User;
  token: string;
  refresh_token: string;
  is_new_user: boolean;
}
```

### POST /api/auth/apple
**Login or register with Apple ID token**

```typescript
Request body:
{
  id_token: string;
  first_name?: string; // optional; available on first Apple authorization
  last_name?: string;  // optional; available on first Apple authorization
}

Response: 200
{
  user: User;
  token: string;
  refresh_token: string;
  is_new_user: boolean;
}
```

### POST /api/auth/refresh-token
**Refresh JWT token**

```typescript
Request body:
{
  refresh_token: string;
}

Response: 200
{
  token: string;
  refresh_token: string;
}
```

### POST /api/auth/logout
**Logout user (revoke current session when possible)**

```typescript
Headers: Authorization: Bearer <token>

Optional request body:
{
  refresh_token?: string; // Recommended to revoke the exact current session
}

Response: 200
{
  message: string;
  session_revoked: boolean;
}
```

### POST /api/auth/forgot-password
**Request password reset code**

Sends a 6-digit verification code to the user's email. Code expires after 15 minutes.

```typescript
Request body:
{
  email: string;
}

Response: 200
{
  message: "If the email exists, a code has been sent.";
}
```

### POST /api/auth/verify-reset-code
**Verify password reset code**

```typescript
Request body:
{
  email: string;
  code: string;           // 6-digit code
}

Response: 200
{
  valid: boolean;
}
```

### POST /api/auth/reset-password
**Reset password with verification code**

```typescript
Request body:
{
  email: string;
  code: string;           // 6-digit code
  new_password: string;   // min 6 characters
}

Response: 200
{
  message: "Password reset successfully";
}
```

### POST /api/auth/validate-email
**Check if email exists in system**

```typescript
Request body:
{
  email: string;
}

Response: 200
{
  message: "Email is valid";
}
```

---

## 👤 User Routes (`/api/users`)

*All routes require authentication*

### GET /api/users/me
**Get current logged-in user profile**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  user: User;
}
```

### PUT /api/users/me
**Update current user profile**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  bio?: string;
}

Response: 200
{
  user: User;
}
```

### PUT /api/users/me/password
**Update current user password**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  current_password: string;
  new_password: string;
  confirm_password: string;
}

Response: 200
{
  message: "Password updated successfully";
}
```

### GET /api/users/me/sessions
**List active login sessions for the authenticated user**

Inactive sessions are automatically revoked when they are older than
`SESSION_INACTIVITY_DAYS` (default: `7` days) based on `updated_at`.

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  sessions: Array<{
    id: string;
    device: string;
    location: {
      city: string | null;
      region: string | null;
      country: string | null;
    };
    created_at: string;
    updated_at: string;
    is_current: boolean;
  }>;
}
```

### POST /api/users/me/session-heartbeat
**Refresh current session activity timestamp and last known location**

```typescript
Headers: Authorization: Bearer <token>

Optional request body:
{
  location?: {
    city?: string | null;
    region?: string | null;
    country?: string | null;
  };
}

Response: 200
{
  success: true;
}
```

### DELETE /api/users/me/sessions/others
**Revoke all other sessions (keeps current session based on JWT session id)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: "Other sessions revoked";
  revoked: number;
  kept_session_id: string | null;
}
```

### DELETE /api/users/me/sessions/:sessionId
**Revoke a specific session by id**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: "Session revoked";
}
```

### DELETE /api/users/me
**Delete user account (soft delete)**

Soft-deletes the account immediately, revokes active sessions, and keeps the account recoverable
for `ACCOUNT_DELETION_GRACE_DAYS` days before permanent purge.

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  reason: string;
  details?: string;
  password: string;
}

Response: 200
{
  msg: "Delete user account";
}
```

### GET /api/users/me/privacy-preferences
**Get privacy preferences and account-deactivation grace period metadata**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  analytics_consent: boolean;
  marketing_consent: boolean;
  legal_updates_email: boolean;
  account_deletion_grace_days: number;
}
```

### PUT /api/users/me/privacy-preferences
**Update privacy preferences**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  analytics_consent?: boolean;
  marketing_consent?: boolean;
  legal_updates_email?: boolean;
}

Response: 200
{
  analytics_consent: boolean;
  marketing_consent: boolean;
  legal_updates_email: boolean;
  account_deletion_grace_days: number;
}
```

### PUT /api/users/me/notification-preferences
**Update notification settings**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  email_reservations?: boolean;
  email_marketing?: boolean;
  email_updates?: boolean;
  push_reservations?: boolean;
  push_marketing?: boolean;
  push_updates?: boolean;
  sms_reservations?: boolean;
}

Response: 200
{
  email_reservations: boolean;
  email_marketing: boolean;
  email_updates: boolean;
  push_reservations: boolean;
  push_marketing: boolean;
  push_updates: boolean;
  sms_reservations: boolean;
}
```

### GET /api/users/me/addresses
**Get user's addresses**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  addresses: UserAddress[];
}
```

### POST /api/users/me/addresses
**Add new address**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  street_address: string;
  city: string;
  state_province?: string;
  postal_code: string;
  country: string;
  is_default?: boolean;
}

Response: 201
{
  address: UserAddress;
}
```

### PUT /api/users/me/addresses/:addressId
**Update address**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  street_address?: string;
  city?: string;
  postal_code?: string;
  is_default?: boolean;
}

Response: 200
{
  address: UserAddress;
}
```

### DELETE /api/users/me/addresses/:addressId
**Delete address**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

### GET /api/users/me/favorites
**Get user's favorite venues**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  favorites: UserFavoriteVenue[];
}
```

### GET /api/users/:userId
**Get public user profile**

```typescript
Response: 200
{
  user: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string;
    created_at: timestamp;
  }
}
```

---

## 🔍 Discovery & Venues (`/api/discovery`, `/api/venues`)

### GET /api/venues
**Get all venues (with filters)**

```typescript
Query params:
  page?: number
  limit?: number
  city?: string
  type?: venue_type
  search?: string
  lat?: number
  lng?: number
  distance_km?: number
  sort?: 'distance' | 'rating' | 'newest'

Response: 200
{
  data: Venue[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}
```

### GET /api/venues/nearby
**Get nearby venues (Mobile focused)**

```typescript
Query params:
  lat: number
  lng: number
  radius: number (meters, default 5000)

Response: 200
[
  { ...Venue, distance: string }
]
```

### GET /api/discovery/nearby
**Get nearby venues (Discovery focused)**

```typescript
Query params:
  lat: number
  lng: number
  radius_km?: number (default 10)

Response: 200
[
  { ...Venue, distance: number, photos: Photo[] }
]
```

### GET /api/discovery/matches-nearby
**Get upcoming matches at nearby venues**

```typescript
Query params:
  lat: number
  lng: number
  radius_km?: number (default 10)

Response: 200
[
  { 
    ...Match, 
    venue: { id, name, distance, ... },
    venueMatchId: string,
    availableCapacity: number 
  }
]
```

### GET /api/discovery/search
**Paginated search for venues and matches**

```typescript
Query params:
  q?: string;
  type?: 'all' | 'venues' | 'matches';
  page?: number;
  limit?: number;
  lat?: number;
  lng?: number;
  radius_km?: number;
  date?: string; // YYYY-MM-DD

Response: 200
{
  venues: Venue[];
  matches: Match[];
  pagination: { ... }
}
```

### GET /api/venues/:venueId
**Get venue details**

### GET /api/venues/:venueId/photos
**Get venue photos**

### GET /api/venues/:venueId/reviews
**Get venue reviews**

### GET /api/venues/:venueId/matches
**Get matches available at venue**

```typescript
Query params:
  upcoming_only?: boolean

Response: 200
Array<{
  id: string; // match id
  scheduled_at: string;
  status: string;
  homeTeam: Team;
  awayTeam: Team;
  league: League;
  venue_match: { 
    id: string; // venue_match_id
    available_capacity: number; 
    ... 
  }
}>
```

### GET /api/venues/:venueId/availability
**Get current seat availability**

### GET /api/venues/:venueId/opening-hours
**Get venue opening hours**

### GET /api/venues/:venueId/opening-hours/exceptions
**Get special closure dates or modified hours**

### GET /api/venues/:venueId/menu
**Get venue menu**

### GET /api/venues/:venueId/amenities
**Get venue amenities (Wi-Fi, Terrace, etc.)**

---

## ⚽ Sports & Matches (`/api/sports`, `/api/leagues`, `/api/teams`, `/api/matches`)

### GET /api/sports
**List all supported sports**

### GET /api/sports/:sportId/leagues
**Get leagues for a sport**

### GET /api/leagues/:leagueId
**Get league details**

### GET /api/leagues/:leagueId/teams
**Get teams in a league**

### GET /api/teams/:teamId
**Get team details**

### GET /api/matches
**Get matches (upcoming by default)**

```typescript
Query params:
  status?: 'scheduled' | 'live' | 'finished'
  limit?: number
  offset?: number
  date?: string (YYYY-MM-DD)
  sport_id?: string
```

### GET /api/matches/upcoming
**Get upcoming matches**

### GET /api/matches/upcoming-nearby
**Get upcoming matches at nearby venues**

### GET /api/matches/:matchId
**Get match details**

### GET /api/matches/:matchId/venues
**Get venues broadcasting this match**

### GET /api/matches/:matchId/live-updates
**Get real-time score updates (API-Sports proxy)**

### Live Data Proxy (`/api/football/*`)
*Direct access to real-time data from API-Sports (autoy-syncs to DB)*
- `GET /api/football/countries`
- `GET /api/football/leagues`
- `GET /api/football/teams`
- `GET /api/football/fixtures`

---

## 🎟️ Reservations & Waitlist (`/api/reservations`)

*All routes require authentication*

### GET /api/reservations
**Get user's reservation history**

### POST /api/reservations
**Create free table reservation**

```typescript
Request body:
{
  venueMatchId: string;
  partySize: number;
  specialRequests?: string;
}
```

### GET /api/reservations/:reservationId
**Get reservation details (includes QR code)**

### POST /api/reservations/:reservationId/cancel
**Cancel a reservation**

### POST /api/reservations/waitlist/join
**Join waitlist for a full match**

```typescript
Request body:
{
  venueMatchId: string;
  partySize: number;
}
```

### POST /api/reservations/waitlist/:waitlistId/leave
**Leave waitlist**

### GET /api/reservations/waitlist
**Get user's current waitlist entries**

---

## 🏢 Partner Dashboard (`/api/partners`)

*Requires `venue_owner` role. Base URL: `/api/partners`*

### Venues & Matches
- `GET /venues` — Get my venues
- `POST /venues` — Create venue (triggers Stripe checkout)
- `POST /venues/verify-checkout` — Finalize venue creation after payment
- `GET /venues/matches` — Get all matches scheduled across my venues
- `POST /venues/:venueId/matches` — Schedule a match at my venue
- `PUT /venues/:venueId/matches/:matchId` — Update capacity/settings for a match
- `DELETE /venues/:venueId/matches/:matchId` — Cancel match broadcast

### Management & Analytics
- `GET /venues/:venueId/reservations` — Get all reservations for a venue
- `GET /venues/:venueId/reservations/stats` — Detailed reservation analytics
- `GET /venues/:venueId/matches/calendar` — Calendar view of broadcasts
- `GET /venues/:venueId/clients` — CRM view of regular customers
- `GET /venues/:venueId/subscription` — Manage Stripe subscription
- `POST /venues/:venueId/payment-portal` — Open Stripe Billing Portal
- `GET /stats/customers` — Consolidated customer statistics
- `GET /analytics/summary` — Overview of performance
- `GET /analytics/dashboard` — Full dashboard data
- `GET /activity` — Recent activity feed

### Scans & Check-ins
- `POST /reservations/:reservationId/status` — Accept/Decline 'Request' mode bookings
- `POST /reservations/verify-qr` — Verify user's QR code (from scanning)
- `POST /reservations/:reservationId/check-in` — Confirm guest arrival (Triggers automatic commission billing: €1.50/guest)
- `POST /reservations/:reservationId/mark-no-show` — Mark user as absent

### Waitlist
- `GET /venues/:venueId/matches/:matchId/waitlist` — View waitlist
- `POST /waitlist/:entryId/notify` — Notify customer that a table is free

---

## 💳 Subscriptions & Billing (`/api/subscriptions`, `/api/invoices`, `/api/transactions`)

### GET /api/billing/pricing
**Get commission pricing model**

```typescript
Response: 200
{
  "model": "commission_per_checked_in_guest",
  "default_rate": "1.50",
  "currency": "EUR",
  "unit": "guest_checked_in"
}
```

### GET /api/subscriptions/plans
**List available subscription levels**

### POST /api/subscriptions/create-checkout
**Start subscription checkout**

### GET /api/subscriptions/me
**Get current user subscription status**

### POST /api/subscriptions/me/update-payment-method
**Get payment portal URL**

### Billing History
- `GET /api/invoices` — List all invoices
- `GET /api/invoices/:invoiceId` — Get invoice details
- `GET /api/invoices/:invoiceId/pdf` — Download invoice
- `GET /api/transactions` — List all transactions

---

## 🤝 Referral & Boosts (`/api/referral`, `/api/boosts`)

### Referral System
- `GET /api/referral/code` — Get my referral code
- `GET /api/referral/stats` — Get referral performance
- `GET /api/referral/history` — List invited users
- `POST /api/referral/validate` — Validate code before signup

### Boost visibility
- `GET /api/boosts/available` — Check boost inventory
- `GET /api/boosts/prices` — List boost pack prices
- `POST /api/boosts/purchase/create-checkout` — Buy boosts
- `POST /api/boosts/activate` — Apply boost to a match
- `GET /api/boosts/stats` — Boost performance analytics

---

## 🏅 Fidelity Program (`/api/fidelity`)

- `GET /api/fidelity/summary` — Points, level, and recent badges
- `GET /api/fidelity/points-history` — Log of points earned/spent
- `GET /api/fidelity/badges` — List all achievement badges
- `GET /api/fidelity/challenges` — List active/completed challenges
- `GET /api/fidelity/levels` — List all loyalty tiers

---

## 🔔 Notifications (`/api/notifications`)

- `GET /api/notifications` — List notifications
- `GET /api/notifications/unread-count` — Count unread
- `GET /api/notifications/new` — Get new since last check
- `PUT /api/notifications/read-all` — Mark all read
- `PUT /api/notifications/:notificationId/read` — Mark single read
- `DELETE /api/notifications/:notificationId` — Remove notification

---

## 📷 Media & Uploads (`/api/media`)

*All routes require authentication*

### POST /api/media/upload
**Generic file upload**

```typescript
Request body: (multipart/form-data)
{
  file: File;
  type?: string; // 'general', 'venue', etc.
}

Response: 200
{
  success: true,
  url: string,
  message: string
}
```

### POST /api/media/avatar
**Upload user profile picture**

Updates the authenticated user's `avatar_url` automatically.

```typescript
Request body: (multipart/form-data)
{
  file: File;
}

Response: 200
{
  success: true,
  url: string,
  message: string
}
```

---

## 🛠️ Infrastructure & Misc

- `GET /api/health` — System health check
- `GET /api/health/test` — Test endpoint
- `POST /api/webhooks/stripe` — Stripe event handler
- `GET /api/coupons/validate` — Check coupon code validity
- `GET /api/amenities` — Global list of available amenities (grouped by category)

---
[« Back to Documentation Index](./index.md)
