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
Pagination: limit, offset query params
```

### Protected Routes (Require Authentication)
- `/api/partners/*` — All partner routes
- `/api/users/*` — All user routes  
- `/api/reservations/*` — All reservation routes
- `/api/referral/*` — Referral system
- `/api/boosts/*` — Boost system
- `/api/fidelity/*` — Loyalty program

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
}
```

### POST /api/auth/logout
**Logout user (invalidate token)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
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

### DELETE /api/users/me
**Delete user account (soft delete)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

### PUT /api/users/me/notification-preferences
**Update notification settings**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  email_notifications?: boolean;
  push_notifications?: boolean;
  sms_notifications?: boolean;
  match_notifications?: boolean;
  reservation_reminders?: boolean;
}

Response: 200
{
  notification_preferences: object;
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

### GET /api/users/me/favorite-venues
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

## 🤝 Referral Routes (`/api/referral`)

*All routes require authentication*

### GET /api/referral/code
**Get current user's referral code**

```typescript
Response: 200
{
  referral_code: string;
  referral_link: string;
  created_at: string;
}
```

### GET /api/referral/stats
**Get referral statistics**

```typescript
Response: 200
{
  total_invited: number;
  total_signed_up: number;
  total_converted: number;
  total_rewards_earned: number;
  rewards_value: string;
  conversion_rate: number;
}
```

### GET /api/referral/history
**Get referral history**

```typescript
Response: 200
{
  referred_users: Array<{
    id: string;
    name: string;
    status: 'invited' | 'signed_up' | 'converted';
    reward_earned: string | null;
    signed_up_at: string;
  }>;
  total: number;
}
```

### POST /api/referral/validate
**Validate a referral code (Public)**

```typescript
Request body:
{
  referral_code: string;
}

Response: 200
{
  valid: boolean;
  referrer_name: string;
}
```

---

## 🚀 Boost Routes (`/api/boosts`)

*Venue Owner routes for managing visibility boosts*

### GET /api/boosts/available
**Get available boosts**

```typescript
Response: 200
{
  count: number;
  boosts: Array<{
    id: string;
    type: string;
    source: string;
    created_at: string;
  }>;
}
```

### GET /api/boosts/prices
**Get boost pack pricing**

```typescript
Response: 200
{
  prices: Array<{
    pack_type: string;
    quantity: number;
    price: number;
    unit_price: number;
    discount_percentage: number;
    badge?: string;
  }>;
}
```

### POST /api/boosts/purchase/create-checkout
**Purchase boosts via Stripe**

```typescript
Request body:
{
  pack_type: 'single' | 'pack_3' | 'pack_10';
  success_url?: string;
  cancel_url?: string;
}

Response: 200
{
  checkout_url: string;
  session_id: string;
}
```

### POST /api/boosts/activate
**Activate a boost on a match**

```typescript
Request body:
{
  boost_id: string;
  venue_match_id: string;
}

Response: 200
{
  success: true;
  expires_at: string;
}
```

### GET /api/boosts/stats
**Get boost performance stats**

```typescript
Response: 200
{
  boosts: { available: number; active: number; used: number; total: number };
  performance: { total_views: number; total_bookings: number };
}
```

---

## 🏅 Fidelity Routes (`/api/fidelity`)

*Loyalty program routes*

### GET /api/fidelity/summary
**Get user fidelity summary (points, level, badges)**

```typescript
Response: 200
{
  data: {
    level: { id: string; name: string; rank: number; };
    points: { total: number; thisMonth: number; };
    progress: { pointsToNextLevel: number; progressPercentage: number; };
    stats: { totalReservations: number; totalCheckIns: number; };
    badges: { total: number; recent: Array<Badge> };
  }
}
```

### GET /api/fidelity/points-history
**Get points transaction history**

```typescript
Response: 200
{
  data: Array<{
    actionKey: string;
    points: number;
    description: string;
    date: string;
  }>
}
```

### GET /api/fidelity/badges
**Get all badges (locked and unlocked)**

```typescript
Response: 200
{
  data: {
    unlocked: Badge[];
    locked: Badge[];
  }
}
```

### GET /api/fidelity/challenges
**Get active challenges**

```typescript
Response: 200
{
  data: {
    active: Challenge[];
    completed: Challenge[];
  }
}
```

---

## 🏟️ Venue Routes (`/api/venues`)

### GET /api/venues
**Get all venues (with filters)**

```typescript
Query params:
  limit?: number
  offset?: number
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
  pagination: { total: number; page: number; totalPages: number };
}
```

### GET /api/venues/nearby
**Get nearby venues**

```typescript
Query params:
  lat: number
  lng: number
  radius: number (meters)

Response: 200
[
  { ...Venue, distance: number }
]
```

### GET /api/venues/:venueId
**Get venue details**

```typescript
Response: 200
{
  id: string;
  name: string;
  ...
}
```

### GET /api/venues/:venueId/matches
**Get matches available at venue**

```typescript
Query params:
  upcoming_only?: boolean

Response: 200
[
  {
    id: string;
    match: Match;
    venue_match: { available_capacity: number; ... }
  }
]
```

### POST /api/venues
**Create new venue (venue_owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  name: string;
  address: string; // street_address
  city: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
  capacity: number;
  type: string;
}

Response: 201
{
  venue: Venue;
}
```

---

## ⚽ Matches Routes (`/api/matches`)

### GET /api/matches
**Get all upcoming matches**

```typescript
Query params:
  limit?: number
  offset?: number
  status?: string

Response: 200
{
  data: Match[];
  count: number;
}
```

### GET /api/matches/:matchId
**Get match details**

```typescript
Response: 200
{
  data: Match;
}
```

### GET /api/matches/:matchId/venues
**Get venues broadcasting this match**

```typescript
Query params:
  lat?: number
  lng?: number
  distance_km?: number

Response: 200
{
  data: Array<{
    venue: Venue;
    availableCapacity: number;
    distance?: number;
  }>;
  count: number;
}
```

---

## 🎟️ Reservations Routes (`/api/reservations`)

*All routes require authentication*

### GET /api/reservations
**Get user's reservations**

```typescript
Response: 200
{
  data: Reservation[];
}
```

### POST /api/reservations
**Create reservation**

```typescript
Request body:
{
  venueMatchId: string;
  partySize: number;
  specialRequests?: string;
  requiresAccessibility?: boolean;
}

Response: 201
{
  message: string;
  reservation: Reservation;
  qr_code?: string;
}
```

### POST /api/reservations/:reservationId/cancel
**Cancel reservation**

```typescript
Request body:
{
  reason?: string;
}

Response: 200
{
  message: string;
  reservation: Reservation;
}
```

### POST /api/reservations/verify-qr
**Verify QR code (Venue Owner)**

```typescript
Request body:
{
  qrContent: string;
}

Response: 200
{
  valid: boolean;
  reservation: Reservation;
}
```

### POST /api/reservations/:reservationId/check-in
**Check-in guest (Venue Owner)**

```typescript
Response: 200
{
  message: string;
  reservation: Reservation;
}
```

---

## 🏢 Partner Dashboard Routes (`/api/partners`)

*Requires `venue_owner` role*

### GET /api/partners/venues
**Get my venues**

### POST /api/partners/venues
**Create venue with subscription checkout**

### GET /api/partners/analytics/dashboard
**Get main analytics dashboard**

### GET /api/partners/analytics/summary
**Get consolidated stats**

### GET /api/partners/venues/:venueId/reservations
**Get venue reservations**

### GET /api/partners/venues/:venueId/matches/calendar
**Get matches calendar view**

---

## 💳 Subscription Routes (`/api/subscriptions`)

*Requires `venue_owner` role*

### GET /api/subscriptions/plans
**Get available plans**

### POST /api/subscriptions/create-checkout
**Create subscription checkout session**

### GET /api/subscriptions/me
**Get current subscription**

### POST /api/subscriptions/me/update-payment-method
**Get Stripe Customer Portal URL**

### GET /api/subscriptions/invoices
**Get invoice history**

---
[« Back to Documentation Index](./index.md)
