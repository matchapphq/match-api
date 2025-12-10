# Match Project — Complete API Routes Documentation

**Production-ready API routes for Match platform (Stripe-integrated, venue owner subscriptions only)**

---

## 📋 API Structure Overview

```
Base URL: /api
Authentication: Bearer token (JWT)
Response format: JSON
Pagination: limit, offset query params
```

---

## 🔐 Authentication Routes

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

### POST /api/auth/refresh
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
**Request password reset email**

```typescript
Request body:
{
  email: string;
}

Response: 200
{
  message: string;
}
```

### POST /api/auth/reset-password
**Reset password with token**

```typescript
Request body:
{
  token: string;
  password: string;
  password_confirm: string;
}

Response: 200
{
  message: string;
}
```

### POST /api/auth/verify-email
**Verify email address**

```typescript
Request body:
{
  token: string;
}

Response: 200
{
  message: string;
}
```

---

## 👤 User Routes

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
  language?: string;
  timezone?: string;
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
    bio: string;
    created_at: timestamp;
  }
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
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  match_notifications?: boolean;
  nearby_venue_notifications?: boolean;
  promotion_notifications?: boolean;
  reservation_reminders?: boolean;
}

Response: 200
{
  notification_preferences: JSONB;
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
  state_province?: string;
  postal_code?: string;
  country?: string;
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

---

## 🎯 Onboarding Routes (User)

### POST /api/onboarding/preferences
**Save user preferences during onboarding**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  sports: string[];
  ambiances: string[];
  venue_types: string[];
  budget?: string;
  food_drinks_preferences?: string[];
  max_distance_km?: number;
  preferred_match_time?: string;
}

Response: 201
{
  preferences: UserPreferences;
}
```

### GET /api/onboarding/preferences
**Get current user preferences**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  preferences: UserPreferences;
}
```

### PUT /api/onboarding/preferences
**Update user preferences**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  sports?: string[];
  ambiances?: string[];
  venue_types?: string[];
  budget?: string;
  food_drinks_preferences?: string[];
  max_distance_km?: number;
  preferred_match_time?: string;
}

Response: 200
{
  preferences: UserPreferences;
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

---

## 🏟️ Venue Routes

### GET /api/venues
**Get all venues (with filters)**

```typescript
Query params:
  limit?: number (default: 20)
  offset?: number (default: 0)
  city?: string
  type?: venue_type
  search?: string
  is_verified?: boolean
  lat?: number
  lng?: number
  distance_km?: number

Response: 200
{
  venues: Venue[];
  total: number;
  limit: number;
  offset: number;
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
  state_province?: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  opening_hours?: object;
  capacity?: number;
  has_terrace?: boolean;
  has_wifi?: boolean;
  has_parking?: boolean;
  has_wheelchair_access?: boolean;
  menu?: object;
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
  type?: venue_type;
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  opening_hours?: object;
  capacity?: number;
  has_terrace?: boolean;
  has_wifi?: boolean;
  has_parking?: boolean;
  has_wheelchair_access?: boolean;
  menu?: object;
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

### GET /api/venues/:venueId/stats
**Get venue statistics (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  total_reviews: number;
  average_rating: number;
  total_reservations: number;
  upcoming_matches: number;
  this_month_revenue?: number;
}
```

---

## 📸 Venue Photos Routes

### POST /api/venues/:venueId/photos
**Upload venue photos**

```typescript
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data

Request body:
{
  photos: File[];
  alt_texts?: string[];
  is_primary?: boolean[];
}

Response: 201
{
  photos: VenuePhoto[];
}
```

### PUT /api/venues/:venueId/photos/:photoId
**Update photo details**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  alt_text?: string;
  is_primary?: boolean;
  display_order?: number;
}

Response: 200
{
  photo: VenuePhoto;
}
```

### DELETE /api/venues/:venueId/photos/:photoId
**Delete photo**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

---

## ⭐ Favorite Venues Routes

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

### GET /api/users/me/favorite-venues
**Get user's favorite venues**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  limit?: number
  offset?: number

Response: 200
{
  favorites: UserFavoriteVenue[];
  total: number;
}
```

---

## 🏆 Sports & Leagues Routes

### GET /api/sports
**Get all sports**

```typescript
Query params:
  limit?: number
  offset?: number
  is_active?: boolean

Response: 200
{
  sports: Sport[];
  total: number;
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
Query params:
  country?: string
  is_active?: boolean

Response: 200
{
  leagues: League[];
}
```

### GET /api/leagues/:leagueId
**Get league details**

```typescript
Response: 200
{
  league: League;
  teams: Team[];
}
```

### GET /api/leagues/:leagueId/teams
**Get teams in a league**

```typescript
Query params:
  limit?: number
  offset?: number

Response: 200
{
  teams: Team[];
  total: number;
}
```

### GET /api/teams/:teamId
**Get team details**

```typescript
Response: 200
{
  team: Team;
}
```

---

## ⚽ Matches Routes

### GET /api/matches
**Get all matches (with filters)**

```typescript
Query params:
  limit?: number (default: 20)
  offset?: number
  status?: match_status
  league_id?: uuid
  home_team_id?: uuid
  away_team_id?: uuid
  scheduled_from?: timestamp
  scheduled_to?: timestamp
  nearby?: boolean
  lat?: number
  lng?: number
  distance_km?: number

Response: 200
{
  matches: Match[];
  total: number;
}
```

### GET /api/matches/:matchId
**Get match details**

```typescript
Response: 200
{
  match: Match;
  venues: VenueMatch[];
  teams: {
    home: Team;
    away: Team;
  }
}
```

### GET /api/matches/nearby
**Get nearby matches (for user)**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  distance_km?: number (default: 10)
  limit?: number

Response: 200
{
  matches: Match[];
}
```

---

## 🎫 Venue Matches Routes

### GET /api/venues/:venueId/matches
**Get matches available at venue**

```typescript
Query params:
  status?: match_status
  limit?: number
  offset?: number

Response: 200
{
  matches: VenueMatch[];
  total: number;
}
```

### POST /api/venues/:venueId/matches
**Add match to venue (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  match_id: uuid;
  pricing_type: 'per_seat' | 'per_table' | 'fixed';
  base_price: number;
  vip_price?: number;
  total_seats: number;
  allows_reservations?: boolean;
  requires_deposit?: boolean;
  deposit_amount?: number;
  estimated_crowd_level?: string;
  notes?: string;
}

Response: 201
{
  venueMatch: VenueMatch;
}
```

### PUT /api/venues/:venueId/matches/:venueMatchId
**Update venue match details (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  pricing_type?: 'per_seat' | 'per_table' | 'fixed';
  base_price?: number;
  vip_price?: number;
  total_seats?: number;
  available_seats?: number;
  allows_reservations?: boolean;
  requires_deposit?: boolean;
  deposit_amount?: number;
  is_active?: boolean;
  is_featured?: boolean;
  estimated_crowd_level?: string;
  notes?: string;
}

Response: 200
{
  venueMatch: VenueMatch;
}
```

### DELETE /api/venues/:venueId/matches/:venueMatchId
**Remove match from venue (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

---

## 💺 Seat Management Routes

### GET /api/venues/:venueId/seats
**Get all seats for a venue**

```typescript
Query params:
  match_id?: uuid
  status?: seat_status
  section?: string

Response: 200
{
  seats: Seat[];
}
```

### POST /api/venues/:venueId/seats
**Create seats (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  seats: {
    seat_number: string;
    section?: string;
    row?: string;
    column?: string;
    seat_type?: 'standard' | 'premium' | 'vip' | 'wheelchair' | 'couple';
    is_accessible?: boolean;
    base_price?: number;
  }[];
}

Response: 201
{
  seats: Seat[];
}
```

### PUT /api/venues/:venueId/seats/:seatId
**Update seat details (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  seat_type?: 'standard' | 'premium' | 'vip' | 'wheelchair' | 'couple';
  status?: seat_status;
  base_price?: number;
  blocked_reason?: string;
  blocked_until?: timestamp;
}

Response: 200
{
  seat: Seat;
}
```

### POST /api/venues/:venueId/seats/bulk-block
**Block multiple seats (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  seat_ids: uuid[];
  reason: string;
  until: timestamp;
}

Response: 200
{
  blocked_count: number;
}
```

---

## 🔒 Seat Holds Routes (5-minute temporary holds)

### POST /api/matches/:matchId/seat-holds
**Place seat hold (regular user)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  venue_match_id: uuid;
  seat_ids: uuid[];
}

Response: 201
{
  hold: SeatHold;
  expires_at: timestamp;
}
```

### GET /api/users/me/seat-holds
**Get active seat holds for user**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  holds: SeatHold[];
}
```

### DELETE /api/seat-holds/:holdId
**Release seat hold**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

---

## 🎟️ Reservations Routes

### POST /api/reservations
**Create reservation**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  venue_match_id: uuid;
  seat_ids: uuid[];
  special_requests?: string;
}

Response: 201
{
  reservation: Reservation;
  qr_code: string;
}
```

### GET /api/reservations/:reservationId
**Get reservation details**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  reservation: Reservation;
  venue: {
    name: string;
    location: {
      latitude: number;
      longitude: number;
    }
  }
  match: {
    home_team: Team;
    away_team: Team;
    scheduled_at: timestamp;
  }
}
```

### GET /api/users/me/reservations
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

### GET /api/venues/:venueId/reservations
**Get venue's reservations (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  status?: reservation_status
  match_id?: uuid
  limit?: number
  offset?: number

Response: 200
{
  reservations: Reservation[];
  total: number;
}
```

### PUT /api/reservations/:reservationId
**Update reservation**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  special_requests?: string;
}

Response: 200
{
  reservation: Reservation;
}
```

### POST /api/reservations/:reservationId/check-in
**Check-in to reservation**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  qr_code?: string;
}

Response: 200
{
  reservation: Reservation;
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

## 🤝 Partner Routes (Venue Owners - Legacy/Shortcuts)

These routes were migrated from the previous workspace and provide direct access for venue owners to manage their venues and matches.

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
  state_province?: string;
  postal_code: string;
  country: string;
}

Response: 201
{
  venue: Venue;
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
  base_price: number;
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

---

## 🏥 Health & Status Routes

### GET /api/health
**Health check**

```typescript
Response: 200
{
  status: 'ok';
  timestamp: timestamp;
}
```

### GET /api/status
**System status**

```typescript
Response: 200
{
  status: 'operational' | 'degraded' | 'maintenance';
  version: string;
}
```
