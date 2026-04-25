# Database Schema

## User
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| name | String | Display name |
| username | String | Unique handle |
| email | String | Unique, used for login |
| password | String? | Nullable for OAuth users |
| authProvider | AuthProvider | LOCAL, GOOGLE, APPLE (default LOCAL) |
| providerId | String? | OAuth provider user ID |
| avatarUrl | String? | Profile picture URL |
| bio | String? | User description |
| city | String? | Location for weather monitoring |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-updated |

**Relations:** plants, planters, sentRequests, receivedRequests, blockedUsers, blockedBy, sentReminders, receivedReminders

---

## Plant
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| ownerId | UUID | FK to User (never null) |
| planterId | UUID? | FK to Planter (nullable) |
| name | String | User's name for the plant |
| species | String? | Botanical/common species |
| isDead | Boolean | Default false |
| wateringIntervalDays | Int | Default 7 days |
| sunlight | Sunlight | HIGH, MEDIUM, LOW (default MEDIUM) |
| minTemp | Float? | Weather alert threshold |
| maxTemp | Float? | Weather alert threshold |
| dateAcquired | DateTime | Default now |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-updated |

**Relations:** owner, planter, images (many), wateringLogs (many), reminders (many)

---

## Planter
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| ownerId | UUID | FK to User |
| name | String | e.g. "Kitchen windowsill" |
| description | String? | Optional details |
| isIndoor | Boolean | Default true |
| imageUrl | String? | Single image URL |
| createdAt | DateTime | Auto-set |
| updatedAt | DateTime | Auto-updated |

**Relations:** owner, plants (many)

---

## WateringLog
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| plantId | UUID | FK to Plant |
| notes | String? | Optional notes ("used fertilizer") |
| wateredAt | DateTime | When the plant was watered (default now) |
| createdAt | DateTime | When the entry was logged |

**Relations:** plant (cascade delete)

---

## PlantImage
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| plantId | UUID | FK to Plant |
| url | String | Cloudinary URL |
| createdAt | DateTime | Auto-set |

**Relations:** plant (cascade delete)

---

## Friendship
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| requesterId | UUID | FK to User (who sent the request) |
| addresseeId | UUID | FK to User (who received it) |
| status | FriendshipStatus | PENDING, ACCEPTED, DECLINED |
| sentAt | DateTime | When the request was sent |
| updatedAt | DateTime | Auto-updated |

**Constraints:** unique(requesterId, addresseeId)
**Relations:** requester, addressee

---

## UserBlock
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| blockerId | UUID | FK to User (who blocked) |
| blockedId | UUID | FK to User (who got blocked) |
| blockedAt | DateTime | When the block happened |

**Constraints:** unique(blockerId, blockedId)
**Relations:** blocker, blocked

**Note:** Blocking auto-removes any existing friendship (handled in application logic). Blocked user cannot see that they were blocked.

---

## WateringReminder
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| senderId | UUID | FK to User (friend who sent the nudge) |
| receiverId | UUID | FK to User (plant owner) |
| plantId | UUID | FK to Plant |
| message | String? | Optional custom message |
| sentAt | DateTime | When the reminder was sent |
| readAt | DateTime? | When the receiver saw it (null = unread) |

**Relations:** sender, receiver, plant

**Note:** This model is for friend-to-friend nudges only. System reminders (plant needs water based on interval) are computed on the fly from WateringLog data, not stored.
