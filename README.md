# CivicConnect

A full-stack civic issue reporting and community engagement platform built for NIT Jamshedpur campus management. Citizens report infrastructure problems, track their lifecycle, discuss them locally, and volunteer to resolve them — while Officials, Moderators, and Admins keep the system moving.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Role-Based Access Control](#role-based-access-control)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Known Limitations](#known-limitations)

---

## Features

- **Smart Issue Reporting** — Citizens submit issues with photos; a lightweight keyword classifier auto-suggests a category and flags likely duplicates before submission.
- **Live Issue Directory & Map** — Browse all reports, upvote critical ones, and see them plotted on an interactive campus map (Leaflet + OpenStreetMap).
- **Issue Lifecycle Tracking** — Every status change (Reported → Under Review → Assigned → In Progress → Resolved → Closed) is logged with who made the change and when.
- **Neighborhood Forum** — Real-time-refreshed community chat tied to civic issues.
- **Resolution Portal** — Citizens can claim an open issue, upload proof of a fix, and earn reputation points.
- **Broadcast Alerts** — Officials, Moderators, and Admins can push live notifications to every user.
- **Admin-Managed Blogs & Events** — Admins publish and remove blog posts and campus events directly from the site — no code changes required.
- **Role-Based Access Control** — Four tiers (Citizen, Official, Moderator, Admin) with server-enforced permissions, not just hidden UI buttons.
- **Dark/Light Theme** — Persisted across sessions.
- **Command Center Dashboard** — Personal stats: total reports, resolutions, reputation earned, and AI-style network insights.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), react-leaflet, vanilla CSS with CSS variables |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Realtime refresh | Polling (5s interval) — see [Known Limitations](#known-limitations) |
| Maps | Leaflet + OpenStreetMap tiles |

---

## Role-Based Access Control

CivicConnect has four access levels. Roles are chosen at signup and, for anything above Citizen, gated behind an access pin that is checked **on the server**, not just hidden in the UI.

| Role | Signup Pin | Can Do |
|---|---|---|
| **Citizen** | none | Report issues, upvote, post in forum, register for events, delete their **own** issue only while it's still `Reported` |
| **Official** | `OFFICIAL1234` | Everything a Citizen can, plus: update issue status, broadcast alerts |
| **Moderator** | `MOD1234` | Everything an Official can, plus: delete chat messages, delete issues **only if their status is `Resolved`** |
| **Admin** | `ADMIN1234` | Everything, without restriction: delete any issue regardless of status, delete any chat message, publish/remove blogs, publish/remove events, toggle the Blogs/Events modules on or off site-wide |

**Why pins are checked server-side:** the frontend pin field is a convenience — the actual authorization happens in `server.js`, so a request crafted outside the UI (e.g. via curl or Postman) without the correct pin will still be rejected with a 403.

**Delete rule specifics:**
- A Moderator attempting to delete a non-`Resolved` issue gets rejected by the API, not just blocked by a hidden button.
- An Admin can bypass this entirely.
- A Citizen can only ever delete their own report, and only before an Official has picked it up.

To change these pins, edit the `ROLE_PINS` object near the top of `server.js`, and keep the matching `ROLE_PINS` object in `App.jsx` in sync (both files reference the same pin strings).

---

## Project Structure

```
civicconnect/
├── server.js          # Express backend: auth, RBAC, issues, blogs, events, chat, notifications
├── src/
│   ├── App.jsx        # Main React app — all pages and modals
│   └── App.css         # Design system (dark/light theme via CSS variables)
├── package.json
└── README.md
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection string

### 1. Backend

```bash
mkdir civicconnect-backend && cd civicconnect-backend
npm init -y
npm install express mongoose cors
# place server.js here
node server.js
```

You should see:
```
✅ Connected to MongoDB
🚀 Backend running on http://localhost:5000
```

### 2. Frontend

```bash
npm create vite@latest civicconnect-frontend -- --template react
cd civicconnect-frontend
npm install react-leaflet leaflet
# replace src/App.jsx and src/App.css with the provided files
npm run dev
```

Visit `http://localhost:5173` (Vite's default port).

### 3. First Admin Account

Sign up through the UI, select **Admin** as the role, and enter `ADMIN1234` as the pin. This account can now publish blogs/events and manage everything site-wide.

---

## Environment Variables

The current version hardcodes URLs (`http://localhost:5000`, `mongodb://127.0.0.1:27017/civicroots`) directly in the source for simplicity during hackathon development. **Before deploying**, replace these with environment variables:

**Backend (`server.js`):**
```js
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/civicroots')
// ...
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
```

**Frontend (`App.jsx`):**
Replace every `http://localhost:5000` with an environment variable, e.g.:
```js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// then use: fetch(`${API_URL}/api/issues`)
```

Create a `.env` file in the frontend root (never commit this):
```
VITE_API_URL=https://your-backend-url.onrender.com
```

And a `.env` for the backend:
```
MONGO_URI=your-mongodb-atlas-connection-string
PORT=5000
```

---

## Deployment

Vercel hosts frontends (static sites / Vite / Next.js) extremely well, but it does **not** run a persistent Node/Express server or host MongoDB. You need two separate deployments:

1. **Backend** → Render, Railway, or Fly.io (any of these support long-running Node servers)
2. **Database** → MongoDB Atlas (free tier is enough for a hackathon)
3. **Frontend** → Vercel

See the step-by-step walkthrough in the accompanying deployment guide for exact commands.

---

## API Reference

All routes are prefixed with `/api`. Routes that change data based on role expect `?role=<Role>` as a query parameter (sent automatically by the frontend).

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/signup` | Public | Create account; role + pin required for non-Citizen |
| POST | `/signin` | Public | Log in |
| PUT | `/upgrade-role` | Authenticated user | Upgrade an existing account's role via pin |
| GET | `/settings` | Public | Fetch UI module toggles |
| PUT | `/settings` | Admin (UI-gated) | Toggle Blogs/Events modules |
| GET | `/issues` | Public | List all issues |
| POST | `/issues` | Citizen+ | Report a new issue |
| PUT | `/issues/:id/status` | Official+ | Update issue status |
| DELETE | `/issues/:id?role=` | Citizen (own, unassigned) / Moderator (Resolved only) / Admin (any) | Remove an issue |
| PUT | `/issues/:id/upvote` | Citizen+ | Upvote an issue |
| GET | `/messages` | Public | Forum messages |
| POST | `/messages` | Citizen+ | Post a message |
| DELETE | `/messages/:id?role=` | Moderator/Admin | Delete a message |
| GET | `/notifications` | Public | Recent alerts |
| POST | `/notifications` | Official+ | Broadcast an alert |
| GET | `/blogs` | Public | List blog posts |
| POST | `/blogs?role=` | Admin | Publish a blog post |
| DELETE | `/blogs/:id?role=` | Admin | Remove a blog post |
| GET | `/events` | Public | List events |
| POST | `/events?role=` | Admin | Publish an event |
| DELETE | `/events/:id?role=` | Admin | Remove an event |

---

## Known Limitations

- **Polling, not WebSockets** — the frontend refetches every 5 seconds rather than using Socket.io for true real-time updates. Fine for a hackathon demo; a production version should switch to actual sockets.
- **Passwords stored in plaintext** — `server.js` compares `password` directly with no hashing. This is acceptable for a local hackathon demo but must be fixed (e.g. bcrypt) before any real deployment with real user data.
- **No JWT/session tokens** — the "logged in" state is just the user object cached in `localStorage`. It's not cryptographically verified on each request; server-side role checks rely on a `role` query param the client sends, which is fine for a hackathon but not tamper-proof against a determined attacker who edits requests directly.
- **In-memory UI settings** — `uiSettings` (Blogs/Events module toggles) resets to defaults if the backend restarts, since it isn't persisted to MongoDB.

For a hackathon submission these are reasonable, well-understood trade-offs. If you extend this beyond the hackathon, address plaintext passwords and add real auth tokens first.
