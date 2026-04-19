# myPlunt 

> A private social app for plant lovers share your collection, track watering, and keep your plants thriving together with friends.

**Status: Pre-launch.** The waitlist is live at [myplunt.com](https://myplunt.com).
---

## What is myPlunt?

myPlunt is a friends-only plant tracking app built for people who genuinely care about their plants not just for aesthetic posts.

Most plant apps are either overly clinical (spreadsheets with leaves) or social-media-style (public posts chasing likes). myPlunt sits in between: it gives you the tools to actually look after your plants, and lets you share that experience privately with the people you choose.

There is no public feed. No followers, no strangers browsing your collection. Everything stays between you and the friends you connect with. You can see what they're growing, remind each other to water, and swap advice all in a space that feels more like a group chat than a social network.

Under the hood, myPlunt tracks watering schedules, environmental thresholds (temperature, humidity, frost risk), and plant images. It ties each plant to a real city location so it can factor in local weather when flagging care alerts. Whether you have three succulents on a windowsill or a full indoor jungle, the goal is the same: keep your plants alive and make it a little more fun to do it with friends.

### Features

| Feature | Description |
|---|---|
| **Plant tracking** | Species, watering history, images, acquisition date |
| **Planters** | Group plants into indoor or outdoor containers |
| **Friend system** | Send, accept, or block friend requests. Friends see each other's full collection |
| **Watering reminders** | Per-plant intervals with social nudges — remind a friend to water |
| **Plant gallery** | Multiple Cloudinary images per plant, one marked as primary |
| **Weather alerts** | City-based location per plant for temperature, humidity, and frost monitoring |
| **Waitlist** | Pre-launch email capture so early supporters get notified on launch |

---

## Colour Palette

All brand colours live in `frontend/tailwind.config.js`. Change them there and they propagate everywhere.

| Token | Hex | Usage |
|---|---|---|
| `cream` | `#ebe1d3` | Page background |
| `green-main` | `#14532d` | Headings, primary text |
| `green-second` | `#0f7033` | Navbar, buttons |
| `green-light` | `#2e7d52` | Subtitles, accents |

> The two MUI theme colours in `frontend/src/App.tsx` mirror `green-main` and `green-second` — update both if you change the palette.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/waitlist` | Register waitlist email |

---

## Roadmap

- [ ] Auth (sign up / log in)
- [ ] Plant CRUD with Cloudinary image upload
- [ ] Planter management
- [ ] Friend requests & social feed
- [ ] Watering reminders
- [ ] Weather-based care alerts

---

## License

Private — all rights reserved.
