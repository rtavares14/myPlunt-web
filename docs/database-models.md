# Plunt — Database Models

## User

Stores user profile and account info.

| Column    | Type     | Constraints              |
|-----------|----------|--------------------------|
| id        | UUID     | PK, auto-generated       |
| email     | String   | Unique                   |
| name      | String   | Required                 |
| password  | String   | Required (hashed)        |
| avatarUrl | String   | Optional                 |
| bio       | String   | Optional                 |
| createdAt | DateTime | Auto                     |
| updatedAt | DateTime | Auto                     |

**Relations:** Has many Plants, Planters, sent/received Friendships, sent/received WateringReminders.

---

## Friendship

Manages friend requests and blocking between users.

| Column      | Type             | Constraints                    |
|-------------|------------------|--------------------------------|
| id          | UUID             | PK, auto-generated             |
| requesterId | UUID             | FK → User                      |
| addresseeId | UUID             | FK → User                      |
| status      | FriendshipStatus | PENDING, ACCEPTED, or BLOCKED  |
| createdAt   | DateTime         | Auto                           |
| updatedAt   | DateTime         | Auto                           |

**Unique constraint:** One friendship record per user pair (`requesterId` + `addresseeId`).

---

## Planter

A container that groups plants. Can be indoor or outdoor.

| Column    | Type     | Constraints        |
|-----------|----------|--------------------|
| id        | UUID     | PK, auto-generated |
| name      | String   | Required           |
| isIndoor  | Boolean  | Default: true      |
| ownerId   | UUID     | FK → User          |
| createdAt | DateTime | Auto               |
| updatedAt | DateTime | Auto               |

**Relations:** Belongs to one User (owner). Has many Plants.

---

## Plant

Core entity. Tracks plant info, location, watering, and environmental thresholds.

| Column               | Type     | Constraints                      |
|----------------------|----------|----------------------------------|
| id                   | UUID     | PK, auto-generated               |
| name                 | String   | Required                         |
| species              | String   | Optional                         |
| dateAcquired         | DateTime | Default: now                     |
| lastWatered          | DateTime | Optional                         |
| isDead               | Boolean  | Default: false                   |
| wateringIntervalDays | Int      | Default: 7 (days before reminder)|
| city                 | String   | Optional                         |
| minTemp              | Float    | Optional (°C)                    |
| maxTemp              | Float    | Optional (°C)                    |
| minHumidity          | Float    | Optional (%)                     |
| maxHumidity          | Float    | Optional (%)                     |
| isFrostResistant     | Boolean  | Default: false                   |
| ownerId              | UUID     | FK → User                        |
| planterId            | UUID     | FK → Planter, optional           |
| createdAt            | DateTime | Auto                             |
| updatedAt            | DateTime | Auto                             |

**Relations:** Belongs to one User (owner). Optionally belongs to one Planter. Has many PlantImages and WateringReminders.

**Notes:**
- If `wateringIntervalDays` is not set by the user, defaults to 7 days.
- Environmental thresholds can be left empty; defaults can be inferred by species in the application layer.
- Location is city-based per plant for weather data.

---

## PlantImage

Stores Cloudinary image URLs for a plant. Supports multiple images with a primary flag.

| Column    | Type     | Constraints                    |
|-----------|----------|--------------------------------|
| id        | UUID     | PK, auto-generated             |
| url       | String   | Required (Cloudinary URL)      |
| isPrimary | Boolean  | Default: false                 |
| plantId   | UUID     | FK → Plant (cascade on delete) |
| createdAt | DateTime | Auto                           |

**Notes:** The `isPrimary` image is displayed on plant cards. All images appear in the detail gallery view.

---

## WaitlistEntry

Pre-launch email signups collected from the public landing page so we can notify subscribers when Plunt goes live.

| Column    | Type     | Constraints        |
|-----------|----------|--------------------|
| id        | UUID     | PK, auto-generated |
| email     | String   | Unique, required   |
| createdAt | DateTime | Auto               |

**Notes:** No relation to `User` — these are anonymous prospects, not registered accounts.

---

## WateringReminder

Social reminders sent between friends when a plant needs watering.

| Column     | Type     | Constraints        |
|------------|----------|--------------------|
| id         | UUID     | PK, auto-generated |
| senderId   | UUID     | FK → User          |
| receiverId | UUID     | FK → User          |
| plantId    | UUID     | FK → Plant         |
| message    | String   | Optional           |
| createdAt  | DateTime | Auto               |

**Notes:** Only friends (status = ACCEPTED) can send reminders. A plant is considered needing water when `now - lastWatered > wateringIntervalDays`.
