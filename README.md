# Plunt

A social app for plant lovers. Connect with friends, share your plant collections, track watering schedules, and get weather-based care alerts all in a private, friends-only env.

## What is Plunt?

Plunt helps plant enthusiasts manage and share their plant collections with friends. There is no public visibility, only users who are connected as friends can view each other's plants and planters.

### Core Features

- **Plant Management** — Track your plants with species info, watering history, images, and environmental thresholds (temperature, humidity, frost resistance)
- **Planters** — Organize plants into indoor or outdoor containers
- **Friend System** — Send/accept/block friend requests. Friends get full access to each other's plant collections
- **Watering Reminders** — Per-plant watering intervals with social nudges (remind a friend to water their plant)
- **Plant Gallery** — Multiple images per plant via Cloudinary, with a primary image for cards and a full gallery in detail view
- **Location-Based Weather** — Each plant has its own city-based location for accurate weather monitoring and care alerts

## Tech Stack

### Frontend
- React 19 + TypeScript
- Vite
- MUI v9 (Material UI)
- Tailwind CSS v3

### Backend
- Node.js + TypeScript
- Express 5
- Prisma ORM
- PostgreSQL 16

### Infrastructure
- Docker (PostgreSQL)
- Cloudinary (image storage)

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Docker

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/Plunt-SPT.git
cd Plunt-SPT

# Install frontend
cd frontend
npm install

# Install backend
cd ../backend
npm install
cp .env.example .env  # Configure your environment variables
```

### Running Locally

```bash
# Backend (starts Docker Postgres automatically)
cd backend
npm run dev    # http://localhost:3001

# Frontend (in a separate terminal)
cd frontend
npm run dev    # http://localhost:5173
```

### Database

```bash
# Run from backend/
npx prisma migrate dev --name init   # Create and apply migrations
npx prisma studio                     # Visual database browser
```