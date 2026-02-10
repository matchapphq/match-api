[🏠 Home](./index.md) | [🏗️ Architecture](./architecture.md) | [🔌 API Routes](./api_routes.md) | [📊 Status](./status_report.md)

---

# Authentication Deep Dive

The Match API uses **JWT (JSON Web Tokens)** with a strict **Token Rotation** strategy to ensure high security and seamless user sessions.

## 🔐 Overview

- **Access Token**: Short-lived (15 minutes). Used for all API requests.
- **Refresh Token**: Long-lived (30 days). Used to obtain new access tokens.
- **Rotation**: Every time a refresh token is used, it is **revoked** and a new one is issued.

## 🔄 The Token Flow

### 1. Initial Login
When a user logs in via `POST /api/auth/login`:
1. The server validates credentials.
2. The server generates an **Access Token** and a **Refresh Token**.
3. Both tokens are returned in the JSON body **and** set as `httpOnly` signed cookies.

### 2. Making Requests
Include the Access Token in the header:
```http
Authorization: Bearer <access_token>
```

### 3. Token Expiration
When the Access Token expires (401 Unauthorized), the client should call:
`POST /api/auth/refresh-token`

The server will:
1. Verify the old Refresh Token signature.
2. Check the database to see if the token hash exists and is valid.
3. If valid:
    - **Delete/Invalidate** the old Refresh Token.
    - Generate a **brand new** Access Token.
    - Generate a **brand new** Refresh Token.
    - Store the new Refresh Token hash in the DB.
4. Return the new pair to the client.

## 🛡️ Security Features

### Database-backed Revocation
Unlike pure stateless JWT, we store the hash of active Refresh Tokens in the `tokens` table. This allows us to:
- Instantly logout a user from all devices (`DELETE FROM tokens WHERE user_id = ...`).
- Detect **Refresh Token Reuse**: If an old token is used twice, we know it's a potential breach and can revoke all sessions for that user.

### Cookie vs Header
- **Web Clients**: Use `httpOnly` cookies automatically handled by the browser.
- **Mobile Clients**: Use the JSON response body to store tokens in secure storage.

---
[« Back to Documentation Index](./index.md)
