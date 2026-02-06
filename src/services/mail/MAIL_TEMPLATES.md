# Mail Service Templates

This document outlines the available email templates and the data payloads required for each. The Mail Service processes these jobs via the `mail-queue` queue.

## Job Structure

To trigger an email, add a job to the queue with the following structure:

```typescript
import { EmailType } from './types/mail.types';

const jobData = {
  to: "user@example.com",     // Recipient email address (string or string[])
  subject: "Subject Line",    // Email subject
  type: EmailType.WELCOME,    // The type of email (see below)
  data: { ... }               // Template-specific variables
};
```

---

## Template Types

### 1. Welcome Email
**Enum:** `EmailType.WELCOME` (`'welcome'`)
**Description:** Sent to new users upon successful registration.

#### Data Payload (`WelcomeData`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userName` | `string` | Yes | The user's display name. |
| `actionLink` | `string` | Yes | URL for the main call-to-action (e.g., "Find a match"). |

**Example:**
```json
{
  "userName": "Alex",
  "actionLink": "https://match.app/discovery"
}
```

---

### 2. Welcome Partner
**Enum:** `EmailType.WELCOME_PARTNER` (`'welcome-partner'`)
**Description:** Sent to new venue owners upon successful registration.

#### Data Payload (`WelcomePartnerData`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userName` | `string` | Yes | The partner's display name. |
| `actionLink` | `string` | Yes | URL for the dashboard. |

**Example:**
```json
{
  "userName": "Jean",
  "actionLink": "https://match.app/dashboard"
}
```

---

### 3. Venue Payment Success
**Enum:** `EmailType.VENUE_PAYMENT_SUCCESS` (`'venue-payment-success'`)
**Description:** Sent when a venue subscription payment is successful.

#### Data Payload (`VenuePaymentSuccessData`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userName` | `string` | Yes | The partner's name. |
| `venueName` | `string` | Yes | The venue name. |
| `amount` | `string` | Yes | The paid amount (e.g. "29.99€"). |
| `planName` | `string` | Yes | The name of the plan (e.g. "Annuel (Pro)"). |
| `date` | `string` | Yes | Payment date. |
| `invoiceUrl` | `string` | No | URL to the invoice PDF. |

**Example:**
```json
{
  "userName": "Jean",
  "venueName": "The Sports Bar",
  "amount": "29.99€",
  "planName": "Annuel (Pro)",
  "date": "14/07/2024",
  "invoiceUrl": "https://stripe.com/..."
}
```

---

### 4. Reset / Forgot Password
**Enum:** `EmailType.RESET_PASSWORD` (`'reset-password'`) or `EmailType.FORGOT_PASSWORD` (`'forgot-password'`)
**Description:** Sent when a user requests a password reset code.

#### Data Payload (`ResetPasswordData`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | `string` | Yes | The 6-digit verification code. |
| `userName` | `string` | No | The user's name (optional). |

**Example:**
```json
{
  "code": "123456",
  "userName": "Alex"
}
```

---

### 5. Reservation Confirmation
**Enum:** `EmailType.RESERVATION_CONFIRMATION` (`'reservation-confirmation'`)
**Description:** Sent when a venue booking is successfully confirmed.

#### Data Payload (`ReservationConfirmationData`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userName` | `string` | Yes | Name of the person who booked. |
| `venueName` | `string` | Yes | Name of the establishment. |
| `matchName` | `string` | Yes | Name of the sporting event (e.g., "PSG vs OM"). |
| `date` | `string` | Yes | Formatted date (e.g., "12/05/2024"). |
| `time` | `string` | Yes | Formatted time (e.g., "21:00"). |
| `guests` | `number` | Yes | Number of people in the party. |
| `bookingId` | `string` | No | Unique reference ID for the booking. |
| `address` | `string` | No | Address of the venue. |

**Example:**
```json
{
  "userName": "Alex",
  "venueName": "The Sports Bar",
  "matchName": "France vs Spain",
  "date": "14/07/2024",
  "time": "21:00",
  "guests": 4,
  "bookingId": "RES-98765",
  "address": "123 Main St, Paris"
}
```