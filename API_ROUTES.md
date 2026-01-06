# Match Project — Complete API Routes Documentation

**Production-ready API routes for Match platform**  
*Last updated: January 2026*

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

### GET /api/auth/me
**Get current authenticated user**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  user: User;
}
```

### PUT /api/auth/me
**Update current user profile**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
}

Response: 200
{
  user: User;
}
```

### DELETE /api/auth/me
**Delete user account (soft delete)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
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

### PUT /api/users/me/onboarding-complete
**Mark onboarding as complete**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  onboarding_complete: boolean;
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

## 🎯 Onboarding Routes (`/api/onboarding`)

### POST /api/onboarding/complete
**Complete user onboarding with preferences**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  sports: string[];
  ambiances: string[];
  venue_types: string[];
  budget?: string;
  food_drinks_preferences?: string[];
}

Response: 200
{
  success: boolean;
  preferences: UserPreferences;
}
```

---

## 🏟️ Venue Routes (`/api/venues`)

### GET /api/venues
**Get all venues (with filters)**

```typescript
Query params:
  limit?: number (default: 20)
  offset?: number (default: 0)
  city?: string
  type?: venue_type
  search?: string
  lat?: number
  lng?: number
  distance_km?: number

Response: 200
{
  venues: Venue[];
  total: number;
}
```

### GET /api/venues/nearby
**Get nearby venues based on location**

```typescript
Query params:
  lat: number
  lng: number
  distance_km?: number (default: 10)
  limit?: number

Response: 200
{
  venues: Venue[];
}
```

### GET /api/venues/:venueId
**Get venue details**

```typescript
Response: 200
{
  venue: Venue;
  photos: VenuePhoto[];
  rating: {
    average: number;
    count: number;
  }
}
```

### GET /api/venues/:venueId/photos
**Get venue photos**

```typescript
Response: 200
{
  photos: VenuePhoto[];
}
```

### GET /api/venues/:venueId/reviews
**Get venue reviews**

```typescript
Query params:
  limit?: number
  offset?: number

Response: 200
{
  reviews: Review[];
  total: number;
  average_rating: number;
}
```

### GET /api/venues/:venueId/matches
**Get matches available at venue**

```typescript
Query params:
  status?: match_status
  limit?: number

Response: 200
{
  matches: VenueMatch[];
}
```

### GET /api/venues/:venueId/availability
**Get venue availability for reservations**

```typescript
Query params:
  date?: string
  match_id?: uuid

Response: 200
{
  available_tables: number;
  total_capacity: number;
}
```

### POST /api/venues
**Create new venue (venue_owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  name: string;
  description?: string;
  type: venue_type;
  street_address: string;
  city: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  phone?: string;
  capacity?: number;
}

Response: 201
{
  venue: Venue;
}
```

### PUT /api/venues/:venueId
**Update venue (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  name?: string;
  description?: string;
  phone?: string;
  opening_hours?: object;
  capacity?: number;
}

Response: 200
{
  venue: Venue;
}
```

### DELETE /api/venues/:venueId
**Delete venue (soft delete, owner only)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

---

## ⭐ Venue Favorites Routes (`/api/venues/:venueId/favorite`)

### POST /api/venues/:venueId/favorite
**Add venue to favorites**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  note?: string;
}

Response: 201
{
  favorite: UserFavoriteVenue;
}
```

### DELETE /api/venues/:venueId/favorite
**Remove venue from favorites**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

### PATCH /api/venues/:venueId/favorite
**Update favorite note**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  note: string;
}

Response: 200
{
  favorite: UserFavoriteVenue;
}
```

### GET /api/venues/:venueId/favorite
**Check if venue is favorited**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  is_favorite: boolean;
  favorite?: UserFavoriteVenue;
}
```

---

## 🏆 Sports Routes (`/api/sports`)

### GET /api/sports
**Get all sports**

```typescript
Query params:
  limit?: number
  offset?: number

Response: 200
{
  sports: Sport[];
}
```

### GET /api/sports/:sportId
**Get sport details**

```typescript
Response: 200
{
  sport: Sport;
}
```

### GET /api/sports/:sportId/leagues
**Get leagues for a sport**

```typescript
Response: 200
{
  leagues: League[];
}
```

---

## 🏅 Leagues Routes (`/api/leagues`)

### GET /api/leagues/:leagueId
**Get league details**

```typescript
Response: 200
{
  league: League;
}
```

### GET /api/leagues/:leagueId/teams
**Get teams in a league**

```typescript
Response: 200
{
  teams: Team[];
}
```

---

## 👥 Teams Routes (`/api/teams`)

### GET /api/teams/:teamId
**Get team details**

```typescript
Response: 200
{
  team: Team;
}
```

---

## ⚽ Matches Routes (`/api/matches`)

### GET /api/matches
**Get all matches (with filters)**

```typescript
Query params:
  limit?: number (default: 20)
  offset?: number
  status?: match_status
  league_id?: uuid
  scheduled_from?: timestamp
  scheduled_to?: timestamp

Response: 200
{
  matches: Match[];
  total: number;
}
```

### GET /api/matches/upcoming
**Get upcoming matches**

```typescript
Query params:
  limit?: number
  sport_id?: uuid

Response: 200
{
  matches: Match[];
}
```

### GET /api/matches/upcoming-nearby
**Get upcoming matches near user location**

```typescript
Query params:
  lat: number
  lng: number
  distance_km?: number (default: 10)
  limit?: number

Response: 200
{
  matches: Match[];
}
```

### GET /api/matches/:matchId
**Get match details**

```typescript
Response: 200
{
  match: Match;
  teams: {
    home: Team;
    away: Team;
  }
}
```

### GET /api/matches/:matchId/venues
**Get venues broadcasting this match**

```typescript
Response: 200
{
  venues: VenueMatch[];
}
```

### GET /api/matches/:matchId/live-updates
**Get live score updates for match**

```typescript
Response: 200
{
  match_id: uuid;
  status: string;
  score?: {
    home: number;
    away: number;
  }
  events?: MatchEvent[];
}
```

---

## 🗺️ Discovery Routes (`/api/discovery`)

### GET /api/discovery/nearby
**Get nearby venues and matches**

```typescript
Query params:
  lat: number
  lng: number
  distance_km?: number (default: 10)

Response: 200
{
  venues: Venue[];
  matches: Match[];
}
```

### GET /api/discovery/venues/:venueId
**Get venue details for discovery**

```typescript
Response: 200
{
  venue: Venue;
}
```

### GET /api/discovery/venues/:venueId/menu
**Get venue menu**

```typescript
Response: 200
{
  menu: object;
}
```

### GET /api/discovery/venues/:venueId/hours
**Get venue opening hours**

```typescript
Response: 200
{
  opening_hours: object;
}
```

### GET /api/discovery/matches-nearby
**Get matches near a location**

```typescript
Query params:
  lat: number
  lng: number
  distance_km?: number

Response: 200
{
  matches: Match[];
}
```

### POST /api/discovery/search
**Search venues and matches**

```typescript
Request body:
{
  query: string;
  lat?: number;
  lng?: number;
  filters?: {
    type?: venue_type;
    sport?: string;
  }
}

Response: 200
{
  venues: Venue[];
  matches: Match[];
}
```

---

## 💺 Seats Routes (`/api/venues/:venueId/seats`)

### GET /api/venues/:venueId/seats
**Get seat map for venue**

```typescript
Query params:
  match_id?: uuid

Response: 200
{
  seats: Seat[];
  sections: Section[];
}
```

### POST /api/venues/:venueId/seats/reserve
**Reserve seats**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  seat_ids: uuid[];
  match_id: uuid;
}

Response: 201
{
  reservation: SeatReservation;
}
```

### GET /api/venues/:venueId/seats/pricing
**Get seat pricing**

```typescript
Query params:
  match_id?: uuid

Response: 200
{
  pricing: {
    standard: number;
    premium: number;
    vip: number;
  }
}
```

---

## 🎟️ Reservations Routes (`/api/reservations`)

*All routes require authentication*

Reservations are completely free for users. They work like restaurant table bookings:
1. User specifies venue, match, and party size
2. System finds best available table
3. User receives QR code
4. Venue owner scans QR to verify on match day

### GET /api/reservations
**Get user's reservations**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  status?: reservation_status
  limit?: number
  offset?: number

Response: 200
{
  reservations: Reservation[];
  total: number;
}
```

### GET /api/reservations/:reservationId
**Get reservation details with QR code**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  reservation: Reservation;
  qr_code: string;
  venue: Venue;
  match: Match;
}
```

### POST /api/reservations/hold
**Hold a table (15 min temporary hold)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  venue_match_id: uuid;
  party_size: number;
  requires_accessibility?: boolean;
}

Response: 201
{
  hold_id: uuid;
  expires_at: timestamp;
  table: {
    name: string;
    capacity: number;
  }
}
```

### POST /api/reservations/confirm
**Confirm reservation from hold**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  hold_id: uuid;
  special_requests?: string;
}

Response: 201
{
  reservation: Reservation;
  qr_code: string;
}
```

### POST /api/reservations/:reservationId/cancel
**Cancel reservation**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  reason?: string;
}

Response: 200
{
  reservation: Reservation;
}
```

### POST /api/reservations/verify-qr
**Verify QR code (venue owner scans user's QR)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  qr_code: string;
}

Response: 200
{
  valid: boolean;
  reservation: Reservation;
}
```

### POST /api/reservations/:reservationId/check-in
**Check-in reservation after QR verification**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  reservation: Reservation;
}
```

### GET /api/reservations/venue-match/:venueMatchId
**Get all reservations for a venue match (venue owner)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  reservations: Reservation[];
  total: number;
}
```

---

## 📋 Waitlist Routes (`/api/reservations/waitlist`)

### POST /api/reservations/waitlist
**Join waitlist when no tables available**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  venue_match_id: uuid;
  party_size: number;
}

Response: 201
{
  waitlist_entry: WaitlistEntry;
  position: number;
}
```

### GET /api/reservations/waitlist/me
**Get user's waitlist entries**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  waitlist: WaitlistEntry[];
}
```

### DELETE /api/reservations/waitlist/:waitlistId
**Leave waitlist**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

---

## ⭐ Reviews Routes

### POST /api/venues/:venueId/reviews
**Create review for venue**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  rating: number (1-5);
  title: string;
  content: string;
  atmosphere_rating?: number;
  food_rating?: number;
  service_rating?: number;
  value_rating?: number;
}

Response: 201
{
  review: Review;
}
```

### GET /api/venues/:venueId/reviews
**Get venue reviews**

```typescript
Query params:
  limit?: number
  offset?: number
  sort?: 'recent' | 'rating' | 'helpful'

Response: 200
{
  reviews: Review[];
  total: number;
  average_rating: number;
}
```

### PUT /api/reviews/:reviewId
**Update review (author only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  rating?: number;
  title?: string;
  content?: string;
  atmosphere_rating?: number;
  food_rating?: number;
  service_rating?: number;
  value_rating?: number;
}

Response: 200
{
  review: Review;
}
```

### DELETE /api/reviews/:reviewId
**Delete review (author only)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

### POST /api/reviews/:reviewId/helpful
**Mark review as helpful**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  is_helpful: boolean;
}

Response: 200
{
  helpful_count: number;
  unhelpful_count: number;
}
```

---

## 🔔 Notifications Routes

### GET /api/notifications
**Get user notifications**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  is_read?: boolean
  type?: notification_type
  limit?: number
  offset?: number

Response: 200
{
  notifications: Notification[];
  unread_count: number;
}
```

### PUT /api/notifications/:notificationId/read
**Mark notification as read**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  notification: Notification;
}
```

### PUT /api/notifications/read-all
**Mark all notifications as read**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

### DELETE /api/notifications/:notificationId
**Delete notification**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

---

## 💬 Messaging Routes

### POST /api/conversations
**Start or get conversation with user**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  participant_id: uuid;
  subject?: string;
}

Response: 200 | 201
{
  conversation: Conversation;
}
```

### GET /api/conversations
**Get user's conversations**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  limit?: number
  offset?: number

Response: 200
{
  conversations: Conversation[];
  total: number;
}
```

### GET /api/conversations/:conversationId/messages
**Get messages in conversation**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  limit?: number
  offset?: number

Response: 200
{
  messages: Message[];
  total: number;
}
```

### POST /api/conversations/:conversationId/messages
**Send message**

```typescript
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data (if file)

Request body:
{
  type: 'text' | 'image' | 'file';
  content: string;
  file?: File;
}

Response: 201
{
  message: Message;
}
```

### PUT /api/messages/:messageId
**Edit message**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  content: string;
}

Response: 200
{
  message: Message;
}
```

### DELETE /api/messages/:messageId
**Delete message (soft delete)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

### PUT /api/conversations/:conversationId/archive
**Archive conversation**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  conversation: Conversation;
}
```

---

## 💳 Subscription Routes (Venue Owners Only)

### POST /api/subscriptions/plans
**Get available subscription plans**

```typescript
Response: 200
{
  plans: {
    basic: {
      id: string;
      name: string;
      price: number;
      currency: string;
      features: {
        max_monthly_reservations: number;
        venue_promotion_slots: number;
        advanced_analytics: boolean;
        priority_support: boolean;
      }
    },
    pro: {...},
    enterprise: {...}
  }
}
```

### POST /api/subscriptions/create-checkout
**Create Stripe checkout session**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  plan: 'basic' | 'pro' | 'enterprise';
  billing_period?: 'monthly' | 'yearly';
}

Response: 200
{
  checkout_url: string;
  session_id: string;
}
```

### GET /api/subscriptions/me
**Get current subscription (venue owner)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  subscription: Subscription;
  next_billing_date: timestamp;
  payment_method: {
    card_brand: string;
    card_last_four: string;
    card_exp_month: number;
    card_exp_year: number;
  }
}
```

### POST /api/subscriptions/me/update-payment-method
**Update payment method**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  stripe_payment_method_id: string;
}

Response: 200
{
  subscription: Subscription;
  payment_method: {
    card_brand: string;
    card_last_four: string;
  }
}
```

### POST /api/subscriptions/me/cancel
**Cancel subscription (venue owner)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  subscription: Subscription;
  cancellation_date: timestamp;
}
```

### POST /api/subscriptions/me/upgrade
**Upgrade subscription plan**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  plan: 'basic' | 'pro' | 'enterprise';
}

Response: 200
{
  subscription: Subscription;
}
```

---

## 📜 Invoices Routes (Venue Owners)

### GET /api/invoices
**Get user's invoices**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  status?: invoice_status
  limit?: number
  offset?: number

Response: 200
{
  invoices: Invoice[];
  total: number;
}
```

### GET /api/invoices/:invoiceId
**Get invoice details**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  invoice: Invoice;
}
```

### GET /api/invoices/:invoiceId/pdf
**Download invoice PDF**

```typescript
Headers: Authorization: Bearer <token>

Response: 200 (PDF file)
```

---

## 💰 Transactions Routes (Venue Owners)

### GET /api/transactions
**Get user's transactions**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  type?: transaction_type
  status?: transaction_status
  limit?: number
  offset?: number

Response: 200
{
  transactions: Transaction[];
  total: number;
}
```

### GET /api/transactions/:transactionId
**Get transaction details**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  transaction: Transaction;
}
```

---

## 📊 Analytics Routes (Venue Owners)

### GET /api/venues/:venueId/analytics/overview
**Get venue analytics overview**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  from?: date
  to?: date

Response: 200
{
  analytics: {
    total_reservations: number;
    total_revenue: number;
    average_occupancy: number;
    top_matches: Match[];
  }
}
```

### GET /api/venues/:venueId/analytics/reservations
**Get reservation analytics**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  from?: date
  to?: date
  group_by?: 'day' | 'week' | 'month'

Response: 200
{
  data: {
    date: date;
    count: number;
    revenue: number;
  }[];
}
```

### GET /api/venues/:venueId/analytics/revenue
**Get revenue analytics**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  from?: date
  to?: date

Response: 200
{
  data: {
    date: date;
    amount: number;
  }[];
  total: number;
}
```

---

## 🎟️ Coupons Routes

### GET /api/coupons/validate
**Validate coupon code**

```typescript
Query params:
  code: string;
  venue_id?: uuid;

Response: 200
{
  valid: boolean;
  discount: number;
  type: 'percentage' | 'fixed';
}
```

---

## 🔗 Webhook Routes

### POST /api/webhooks/stripe
**Stripe webhook handler**

```typescript
Headers: Stripe-Signature: <signature>

Request body: Raw Stripe event

Events handled:
  - payment_method.attached
  - invoice.paid
  - invoice.payment_failed
  - customer.subscription.updated
  - customer.subscription.deleted

Response: 200
{
  received: true;
}
```

---

## 🤝 Partner Routes (`/api/partners`)

*All routes require authentication*

Dashboard and management routes for venue owners (partners).

### GET /api/partners/venues
**Get venues owned by the current user**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  venues: Venue[];
}
```

### POST /api/partners/venues
**Create a new venue**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  name: string;
  street_address: string;
  city: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
}

Response: 201
{
  venue: Venue;
}
```

### POST /api/partners/venues/verify-checkout
**Verify Stripe checkout and create venue**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  session_id: string;
}

Response: 200
{
  venue: Venue;
  subscription: Subscription;
}
```

### GET /api/partners/venues/matches
**Get all matches for partner's venues**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  matches: VenueMatch[];
}
```

### POST /api/partners/venues/:venueId/matches
**Schedule a match at a venue**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  match_id: uuid;
  total_seats: number;
}

Response: 201
{
  venueMatch: VenueMatch;
}
```

### DELETE /api/partners/venues/:venueId/matches/:matchId
**Cancel a scheduled match**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  success: true;
}
```

### GET /api/partners/venues/:venueId/clients
**Get clients/customers for a venue**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  clients: Client[];
}
```

### GET /api/partners/venues/:venueId/subscription
**Get venue subscription details**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  subscription: Subscription;
}
```

### POST /api/partners/venues/:venueId/payment-portal
**Get Stripe payment portal URL**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  portal_url: string;
}
```

### GET /api/partners/stats/customers
**Get customer statistics**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  total_customers: number;
  new_this_month: number;
  returning_customers: number;
}
```

### GET /api/partners/analytics/summary
**Get analytics summary for partner**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  total_reservations: number;
  total_matches_broadcast: number;
  average_attendance: number;
}
```

---

## 🏥 Health Route

### GET /api/health
**Health check**

```typescript
Response: 200 "OK"
```
