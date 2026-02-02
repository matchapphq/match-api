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

### POST /api/subscriptions/mock
**Toggle mock subscription state (development/testing only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  plan?: 'basic' | 'pro' | 'enterprise';
  active?: boolean;
}

Response: 200
{
  subscription: Subscription;
  message: string;
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

> **Note:** Returns success even if email doesn't exist to prevent user enumeration attacks.

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

Error: 400 Bad Request
{
  error: "Invalid or expired code";
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

Error: 400 Bad Request
{
  error: "Invalid or expired code";
}

Error: 404 Not Found
{
  error: "User not found";
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

Error: 404 Not Found
{
  error: "User not found";
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

### POST /api/venues/:venueId/photos
**Upload venue photo (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  photo_url: string;
  alt_text?: string;
  is_primary?: boolean;
  display_order?: number;
}

Response: 201
{
  photo: VenuePhoto;
}
```

### DELETE /api/venues/:venueId/photos/:photoId
**Delete venue photo (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  message: string;
}
```

### PUT /api/venues/:venueId/photos/:photoId/primary
**Set photo as primary (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  photo: {
    id: string;
    venue_id: string;
    url: string;
    is_primary: boolean;
    display_order: number;
    uploaded_by: string;
    created_at: string;
    updated_at: string;
  }
}

Error: 403 Forbidden
{
  error: "Not authorized to modify photos for this venue";
}

Error: 404 Not Found
{
  error: "Photo not found";
}
```

### GET /api/venues/:venueId/opening-hours
**Get venue opening hours**

```typescript
Response: 200
{
  opening_hours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    // ... other days
  }
}
```

### PUT /api/venues/:venueId/opening-hours
**Update venue opening hours (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  opening_hours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    // ... other days
  }
}

Response: 200
{
  venue: Venue;
  message: string;
}
```

### POST /api/venues/:venueId/opening-hours/exceptions
**Add special hours exception (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  date: string;                   // "2026-12-25"
  reason: string;                 // "Christmas Day"
  closed: boolean;
  special_hours?: {
    open: string;                 // "10:00"
    close: string;                // "18:00"
  };
}

Response: 201
{
  exception: {
    id: string;
    venue_id: string;
    date: string;
    reason: string;
    closed: boolean;
    special_open: string | null;
    special_close: string | null;
    created_at: string;
  }
}

Error: 400 Bad Request
{
  error: "Date must be in the future" | "Exception already exists for this date";
}
```

### GET /api/venues/:venueId/opening-hours/exceptions
**List all special hours exceptions**

```typescript
Query params:
- from?: string                   // "2026-01-01"
- to?: string                     // "2026-12-31"
- upcoming_only?: boolean         // Default: false

Response: 200
{
  exceptions: OpeningHoursException[];
  total: number;
}
```

### DELETE /api/venues/:venueId/opening-hours/exceptions/:exceptionId
**Delete a special hours exception (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  success: true;
  message: "Exception deleted successfully";
}

Error: 404 Not Found
{
  error: "Exception not found";
}
```

### GET /api/amenities
**Get list of all available amenities (public)**

```typescript
Response: 200
{
  amenities: [
    {
      id: string;
      slug: string;               // "wifi"
      name: string;               // "Wi-Fi"
      icon: string;               // "Wifi" (lucide-react)
      category: string;           // "facilities"
      description?: string;
    }
  ];
  categories: [
    {
      slug: string;               // "facilities"
      name: string;               // "Facilities"
      amenities: string[];        // Array of amenity IDs
    }
  ];
}
```

### GET /api/venues/:venueId/amenities
**Get venue amenities**

```typescript
Response: 200
{
  amenities: Amenity[];
}
```

### PUT /api/venues/:venueId/amenities
**Set venue amenities (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  amenities: string[];            // Array of amenity IDs
}

Response: 200
{
  venue: {
    id: string;
    name: string;
    amenities: Amenity[];
    updated_at: string;
  }
}

Error: 400 Bad Request
{
  error: "Invalid amenity ID";
  invalid_amenities: string[];
}
```

### GET /api/venues/:venueId/menu
**Get venue menu**

```typescript
Response: 200
{
  menu: MenuItem[];
}
```

### POST /api/venues/:venueId/menu
**Create/update venue menu (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  menu: [
    {
      name: string;
      description?: string;
      price: number;
      category: string;
      image_url?: string;
    }
  ]
}

Response: 200
{
  venue: Venue;
  message: string;
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

### PUT /api/venues/:venueId/booking-mode
**Update venue booking mode (owner only)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  booking_mode: 'INSTANT' | 'REQUEST';
}

Response: 200
{
  venue: Venue;
}
```

> **Note:** Add `booking_mode: 'INSTANT' | 'REQUEST'` field to the Venue model. `INSTANT` = auto confirm, `REQUEST` = owner must confirm.

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

### GET /api/sports/fixture
**Get upcoming fixtures across sports**

```typescript
Query params:
  sport_id?: uuid
  league_id?: uuid
  from?: string   // ISO date
  to?: string

Response: 200
{
  fixtures: FixtureSummary[];
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

Reservations work like restaurant table bookings. The flow now supports two modes per venue:

- **INSTANT**: reservation is immediately `CONFIRMED` if capacity allows
- **REQUEST**: reservation is created as `PENDING` and the venue owner must confirm/decline

### Common Statuses

```typescript
type reservation_status =
  | 'PENDING'           // awaiting venue confirmation
  | 'CONFIRMED'         // confirmed by system (instant) or venue
  | 'DECLINED'          // declined by venue
  | 'CANCELED_BY_USER'
  | 'CANCELED_BY_VENUE'
  | 'NO_SHOW';
```

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

### POST /api/reservations
**Create reservation (instant or request mode)**

Single button on the client; backend decides `PENDING` vs `CONFIRMED` based on `venue.booking_mode` and availability.

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  venue_match_id: uuid;
  party_size: number;
  requires_accessibility?: boolean;
  special_requests?: string;
}

Response: 201
{
  reservation: Reservation; // status: 'PENDING' | 'CONFIRMED'
  qr_code?: string;         // present only if status === 'CONFIRMED'
}
```

**Backend behavior:**

1. Load `venue_match` and `venue.booking_mode`.
2. If `booking_mode === 'INSTANT'`:
   - Check capacity/availability.
   - If available → create reservation with `status = 'CONFIRMED'`, generate QR, send notifications to user & venue.
   - If not available → 409 / 422 error.
3. If `booking_mode === 'REQUEST'`:
   - Create reservation with `status = 'PENDING'` (no QR yet or optional "pending" QR).
   - Notify venue owner of new reservation request.
   - Optionally auto-expire after a configured time window.

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

### GET /api/subscriptions/plans
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

### GET /api/subscriptions/invoices
**List invoices scoped to the authenticated venue owner (alias of `/api/invoices`)**

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
**List every match scheduled across the current partner's venues**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  data: [
    {
      id: string;
      venue: { id: string; name: string } | null;
      match: {
        id: string;
        homeTeam: string;
        awayTeam: string;
        scheduled_at: string;
        league?: string | null;
      } | null;
      total_capacity: number;
      reserved_seats: number;
      available_capacity: number;
      status: 'upcoming' | 'live' | 'finished';
    }
  ];
}
```

> The backend aggregates all venues owned by the authenticated partner, resolves their `venue_matches`, and returns normalized stats (`reserved_seats`, `available_capacity`, status, etc.).

### POST /api/partners/venues/:venueId/matches
**Schedule a match at a venue**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  match_id: string;
  total_capacity: number;
}

Response: 201
{
  venueMatch: VenueMatch;
}
```

**Validation:** `venueId`, `match_id`, and `total_capacity` are required. On success the API automatically sets `available_capacity = total_capacity`.

### PUT /api/partners/venues/:venueId/matches/:matchId
**Update a venue match**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  total_capacity?: number;
  available_capacity?: number;
  is_active?: boolean;
  is_featured?: boolean;
  allows_reservations?: boolean;
  max_group_size?: number;
  notes?: string;
}

Response: 200
{
  venueMatch: VenueMatch;
}
```

### GET /api/partners/venues/:venueId/reservations
**Get all reservations for a venue**

```typescript
Headers: Authorization: Bearer <token>

Query params:
- page?: number (default: 1)
- limit?: number (default: 20)
- status?: 'all' | 'pending' | 'confirmed' | 'canceled'

Response: 200
{
  reservations: [
    {
      id: string;
      user: { id, first_name, last_name, email, phone };
      venueMatch: { match: { homeTeam, awayTeam, scheduled_at } };
      party_size: number;
      status: string;
      special_requests?: string;
      created_at: string;
    }
  ];
  total: number;
  page: number;
  limit: number;
}
```

### GET /api/partners/venues/:venueId/reservations/stats
**Get reservation statistics for a venue**

```typescript
Headers: Authorization: Bearer <token>

Query params:
- from?: string                   // "2026-01-01"
- to?: string                     // "2026-01-31"

Response: 200
{
  stats: {
    period: { from: string; to: string };
    reservations: {
      total: number;
      confirmed: number;
      cancelled: number;
      no_show: number;
      cancellation_rate: number;
      no_show_rate: number;
    };
    customers: {
      total_unique: number;
    };
  }
}
```

### GET /api/partners/venues/:venueId/matches/calendar
**Get calendar view of scheduled matches**

```typescript
Headers: Authorization: Bearer <token>

Query params:
- month?: string                  // "2026-01" (defaults to current month)
- status?: string                 // Filter by status

Response: 200
{
  matches: VenueMatch[];
  summary: {
    total_matches: number;
    total_seats_available: number;
    total_seats_reserved: number;
    occupancy_rate: number;
  };
  days_with_matches: string[];    // ["2026-01-15", "2026-01-18", ...]
}
```

### PATCH /api/partners/reservations/:reservationId
**Update reservation details (full update)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  status?: 'pending' | 'confirmed' | 'canceled' | 'checked_in' | 'completed' | 'no_show';
  table_number?: string;
  notes?: string;
  party_size?: number;
  special_requests?: string;
}

Response: 200
{
  reservation: Reservation;
}

Error: 400 Bad Request
{
  error: "Cannot increase party size: not enough available seats";
  available_seats: number;
  requested_increase: number;
}
```

### POST /api/partners/reservations/:reservationId/mark-no-show
**Mark reservation as no-show**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  reason?: string;
}

Response: 200
{
  reservation: {
    id: string;
    status: "no_show";
    marked_no_show_at: string;
    no_show_reason: string | null;
  };
  seats_released: number;
}

Error: 400 Bad Request
{
  error: "Can only mark confirmed or checked_in reservations as no-show";
  current_status: string;
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

### GET /api/partners/analytics/dashboard
**Get complete analytics dashboard**

```typescript
Headers: Authorization: Bearer <token>

Query params:
- start_date?: string (ISO date)
- end_date?: string (ISO date)

Response: 200
{
  overview: {
    total_venues: number;
    total_matches: number;
    total_reservations: number;
  };
  reservations_by_status: {
    pending: number;
    confirmed: number;
    canceled: number;
  };
  capacity_utilization: number; // 0-100 percentage
}
```

---

## �️ Reservation Owner Actions (`/api/partners/reservations`)

Venue owners must be able to accept/decline `PENDING` reservations.

### PATCH /api/partners/reservations/:reservationId/status
**Update reservation status (venue owner)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  status: 'CONFIRMED' | 'DECLINED';
}

Response: 200
{
  reservation: Reservation;
}
```

**Behavior:**

- Only valid if:
  - Current user owns the venue.
  - Current reservation status is `PENDING`.
- Transitions:
  - `PENDING → CONFIRMED`: generate QR (if not generated) and notify user.
  - `PENDING → DECLINED`: notify user, optionally suggest alternatives.

---

## 🎁 Referral Routes (`/api/referral`)

The referral system allows venue owners to invite other restaurateurs and earn 1 free boost per converted referral.

**Rule: 1 converted referral = 1 free boost**

### GET /api/referral/code
**Get current user's referral code (creates one if not exists)**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  referral_code: string;      // e.g., "MATCH-RESTO-A7B9C2"
  referral_link: string;      // e.g., "https://match.app/signup?ref=MATCH-RESTO-A7B9C2"
  created_at: string;
}
```

### GET /api/referral/stats
**Get referral statistics for current user**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  total_invited: number;
  total_signed_up: number;
  total_converted: number;
  total_rewards_earned: number;
  rewards_value: number;      // In euros (e.g., 150 for 5 boosts)
  conversion_rate: number;    // Percentage
}
```

### GET /api/referral/history
**Get referral history with pagination**

```typescript
Headers: Authorization: Bearer <token>

Query params:
- page?: number (default: 1)
- limit?: number (default: 20)
- status?: 'all' | 'invited' | 'signed_up' | 'converted' (default: 'all')

Response: 200
{
  referred_users: [
    {
      id: string;
      name: string;           // Anonymized: "Marc D."
      status: 'invited' | 'signed_up' | 'converted';
      reward_earned: string | null;  // "1 boost" if converted
      created_at: string;
      signed_up_at?: string;
      converted_at?: string;
    }
  ];
  total: number;
  page: number;
  limit: number;
}
```

### POST /api/referral/validate
**Validate a referral code (public - for signup flow)**

```typescript
Request body:
{
  referral_code: string;
}

Response: 200
{
  valid: boolean;
  referrer_name?: string;     // e.g., "Jean D." (anonymized)
  message: string;
}
```

### POST /api/referral/register
**Register a referral when new user signs up with a code**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  referral_code: string;
  referred_user_id: string;
}

Response: 200
{
  success: boolean;
  referral_id: string;
  message: string;
}
```

### POST /api/referral/convert
**Convert a referral after first payment (internal/webhook use)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  referred_user_id: string;
}

Response: 200
{
  success: boolean;
  referral_id: string;
  boost_id: string;
  referrer_id: string;
  message: string;
}
```

### GET /api/referral/boosts
**Get available boosts for current user**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  boosts: Boost[];
  total: number;
}
```

### POST /api/referral/boosts/:boostId/use
**Use a boost for a venue match**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  venue_match_id: string;
}

Response: 200
{
  success: boolean;
  message: string;
}
```

**Referral Status Flow:**
1. `invited` → User has been invited but hasn't signed up yet
2. `signed_up` → User has created an account using the referral code
3. `converted` → User has completed their first payment → **Referrer gets 1 boost**

---

## 🎖️ Fidelity Routes (`/api/fidelity`)

*All routes require authentication*

### GET /api/fidelity/summary
**Get current user's points, level, and streak overview**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  points_balance: number;
  current_level: string;
  next_level: {
    name: string;
    points_required: number;
  };
  streak: {
    active: boolean;
    days: number;
  };
}
```

### GET /api/fidelity/points-history
**List recent points transactions**

```typescript
Headers: Authorization: Bearer <token>

Query params:
  limit?: number (default: 25)
  offset?: number

Response: 200
{
  transactions: FidelityTransaction[];
  total: number;
}
```

### GET /api/fidelity/badges
**Get unlocked and upcoming badges**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  unlocked: FidelityBadge[];
  upcoming: FidelityBadge[];
}
```

### GET /api/fidelity/challenges
**Get active challenges for the user**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  challenges: FidelityChallenge[];
}
```

### GET /api/fidelity/levels
**List all available loyalty levels**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  levels: FidelityLevel[];
}
```

---

## ⚡ Boost Routes (`/api/boosts`)

The boost system allows venue owners to increase visibility of their venue matches in search results.

**Pricing:**
- 1 boost = 30€
- Pack of 3 = 75€ (25€/unit, 17% off)
- Pack of 10 = 200€ (20€/unit, 33% off)

### GET /api/boosts/prices
**Get boost pack prices (public)**

```typescript
Response: 200
{
  prices: [
    {
      pack_type: string;        // 'single', 'pack_3', 'pack_10'
      quantity: number;
      price: number;            // Total price in EUR
      unit_price: number;       // Price per boost
      discount_percentage: number;
      stripe_price_id?: string;
      badge?: string;           // e.g., "Meilleure offre"
    }
  ]
}
```

### GET /api/boosts/available
**Get available boosts for current user**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  count: number;
  boosts: [
    {
      id: string;
      type: 'purchased' | 'referral' | 'promotional';
      source: string;
      created_at: string;
    }
  ]
}
```

### GET /api/boosts/stats
**Get global boost statistics**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  boosts: {
    available: number;
    active: number;
    used: number;
    expired: number;
    total: number;
  };
  purchases: {
    total_spent: number;
    total_purchased: number;
  };
  performance: {
    total_views: number;
    total_bookings: number;
    avg_performance_score: number;
  };
}
```

### GET /api/boosts/summary
**Get boost summary for dashboard**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  available_boosts: number;
  active_boosts: number;
  last_purchase_date: string | null;
}
```

### POST /api/boosts/purchase/create-checkout
**Create Stripe Checkout session for boost purchase**

```typescript
Headers: Authorization: Bearer <token>

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
  purchase_id: string;
}
```

### POST /api/boosts/purchase/verify
**Verify a Stripe payment after checkout**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  session_id: string;
}

Response: 200
{
  success: boolean;
  purchase: {
    id: string;
    pack_type: string;
    quantity: number;
    payment_status: string;
    paid_at?: string;
  };
}
```

### GET /api/boosts/boostable/:venueId
**Get matches available for boosting at a venue**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  matches: [
    {
      id: string;
      venue_id: string;
      match_id: string;
      is_boosted: boolean;
      total_capacity: number;
      available_capacity: number;
      scheduled_at: string;
      status: string;
      home_team: string;
    }
  ]
}
```

### GET /api/boosts/purchases
**Get purchase history**

```typescript
Headers: Authorization: Bearer <token>

Query params:
- page?: number (default: 1)
- limit?: number (default: 20)

Response: 200
{
  purchases: [
    {
      id: string;
      pack_type: string;
      quantity: number;
      total_price: number;
      payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
      paid_at?: string;
      created_at: string;
    }
  ];
  total: number;
  page: number;
  limit: number;
}
```

### POST /api/boosts/activate
**Activate a boost on a venue match**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  boost_id: string;
  venue_match_id: string;
}

Response: 200
{
  success: boolean;
  boost_id: string;
  venue_match_id: string;
  expires_at: string;
  message: string;
}
```

**Validation:**
- Boost must be available (status = 'available')
- Venue match must exist and belong to user's venue
- Match must be scheduled (upcoming)
- Match must not already be boosted

### POST /api/boosts/deactivate
**Deactivate a boost (mark as used)**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  boost_id: string;
}

Response: 200
{
  success: boolean;
  boost_id: string;
  message: string;
}
```

### GET /api/boosts/history
**Get boost usage history**

```typescript
Headers: Authorization: Bearer <token>

Query params:
- page?: number (default: 1)
- limit?: number (default: 20)
- status?: 'all' | 'available' | 'used' | 'expired'

Response: 200
{
  boosts: [
    {
      id: string;
      type: string;
      status: string;
      source: string;
      venue_match_id?: string;
      activated_at?: string;
      used_at?: string;
      expires_at?: string;
      created_at: string;
      home_team?: string;
    }
  ];
  total: number;
  page: number;
  limit: number;
}
```

### GET /api/boosts/analytics/:boostId
**Get detailed analytics for a specific boost**

```typescript
Headers: Authorization: Bearer <token>

Response: 200
{
  boost_id: string;
  venue_match_id: string;
  boost_started_at: string;
  boost_ended_at?: string;
  views_before_boost: number;
  views_during_boost: number;
  views_after_boost: number;
  bookings_before_boost: number;
  bookings_during_boost: number;
  bookings_after_boost: number;
  performance_score?: number;    // 0-100
  estimated_roi?: number;        // In EUR
}
```

**Boost Workflow:**
1. User purchases boosts via Stripe Checkout
2. Webhook creates boost records with status `available`
3. User activates boost on a venue match → status becomes `used`, match shows "⚡ Sponsorisé" badge
4. Boost expires automatically when match ends
5. Analytics track views/bookings during boost period

---

## 📋 Waitlist Routes

### GET /api/partners/venues/:venueId/matches/:matchId/waitlist
**View waitlist for a venue match (venue owner)**

```typescript
Headers: Authorization: Bearer <token>

Query params:
- status?: 'all' | 'waiting' | 'notified' | 'converted' | 'expired'

Response: 200
{
  waitlist: [
    {
      id: string;
      user_id: string;
      party_size: number;
      status: 'waiting' | 'notified' | 'expired' | 'converted';
      position: number | null;
      notified_at?: string;
      notification_expires_at?: string;
      created_at: string;
    }
  ];
  summary: {
    total_entries: number;
    waiting_entries: number;
    notified_entries: number;
    total_party_size: number;
  };
}
```

### POST /api/partners/waitlist/:entryId/notify
**Notify waitlist customer that a spot is available**

```typescript
Headers: Authorization: Bearer <token>

Request body:
{
  message?: string;
  expiry_minutes?: number;        // Default: 60
}

Response: 200
{
  waitlistEntry: WaitlistEntry;
  notifications_sent: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  message: "Customer has been notified and has 60 minutes to claim their spot.";
}

Error: 400 Bad Request
{
  error: "Customer already notified";
  notified_at: string;
}
```

---

## 🏥 Health Route

### GET /api/health
**Health check**

```typescript
Response: 200 "OK"
```
