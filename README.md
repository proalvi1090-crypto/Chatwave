# ChatWave - Real-time Chat App (Full Stack)

A WhatsApp Web-style, self-hosted chat application with private messaging, group chat, media/file upload, and real-time updates.

## Stack

- Frontend: React 18, Vite, TailwindCSS, Zustand, Socket.io-client, React Router v6
- Backend: Node.js, Express, Socket.io, MongoDB (Mongoose), Redis (ioredis), JWT, bcrypt, Multer, Cloudinary, Web Push
- DevOps: Docker, Docker Compose, MongoDB Atlas free tier, Render-compatible

## Project Structure

- client: React app
- server: Express + Socket server
- docker-compose.yml: local services (client, server, redis)
- .env.example: server env reference

## Implemented Features

- Authentication
- Register, login, refresh token, logout all devices (refresh token version invalidation)
- JWT access token + refresh token cookie
- User profile update with avatar upload

- Private chat
- Search users and create/open private conversation
- Real-time new message delivery
- Typing indicator events
- Seen status endpoint + socket event

- Group chat
- Create group
- Add/remove member with admin restrictions
- Group info card on UI

- Message types
- Text, image, file (up to 10MB)
- Reply metadata field support (backend + UI rendering)
- Delete own message (delete-for-self)

- Presence
- Online/offline state with Redis + MongoDB lastSeen
- Real-time status broadcast events

- Notifications
- Browser push subscription endpoint
- Service worker setup
- Notification sound on incoming message

- Search
- User search by name/email
- Message search with query in conversation API

- UI/UX
- Responsive layout (sidebar + chat window)
- Light/dark mode
- Animated glassmorphism-style panels

## Environment Setup

### 1) Server env

Copy values from .env.example into your real env file for server:

- PORT
- NODE_ENV
- CLIENT_URL
- MONGODB_URI
- REDIS_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY
- VAPID_SUBJECT

### 2) Client env

Use client/.env.example and set:

- VITE_API_URL
- VITE_SOCKET_URL
- VITE_VAPID_PUBLIC_KEY

## Run Locally (without Docker)

### Server

```bash
cd server
npm install
npm run dev
```

### Client

```bash
cd client
npm install
npm run dev
```

## Run with Docker

From project root:

```bash
docker compose up --build
```

Client: http://localhost:5173
Server: http://localhost:5000

## REST API Endpoints

### Auth

- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh-token

### User

- GET /api/users/search?q=name
- GET /api/users/:id
- PUT /api/users/profile
- POST /api/users/push-subscription

### Conversation

- GET /api/conversations
- POST /api/conversations
- POST /api/conversations/group
- GET /api/conversations/:id
- PUT /api/conversations/:id/group
- POST /api/conversations/:id/members
- DELETE /api/conversations/:id/members/:userId

### Message

- GET /api/messages/:conversationId
- POST /api/messages
- DELETE /api/messages/:id
- PUT /api/messages/:id/seen

## Socket Events

Client -> Server:

- join_conversation
- send_message
- typing_start
- typing_stop
- mark_seen

Server -> Client:

- new_message
- user_typing
- user_stop_typing
- message_seen
- user_online
- user_offline

## Notes

- Group create UI currently expects member IDs comma-separated for fast setup.
- For production, move refresh token to secure cookie policy and configure CORS domain exactly.
- Add dedicated icons under client/public for richer push notifications.

## Security Checklist (Before Pushing to GitHub)

- Keep real secrets only in local `.env` files.
- Commit only example env files such as `.env.example` and `client/.env.example`.
- Rotate JWT, Cloudinary, and VAPID secrets immediately if they are ever exposed.
- Prefer GitHub repository secrets or deployment platform secret managers for production values.
