# NexFlow

A chat and social web app for the team.

- **Chat rooms:** live messages, emoji reactions and images. Small images show right away; images over 1 MB show a **Show** button.
- **Channels:** post updates. Others can react and comment, and everything updates live.
- **Public or private:** anyone can join a public room or channel. In a private one, only the owner can add people.
- **Profile:** display name, bio, profile picture and password.
- **Dashboard:** your activity at a glance.
- **Planner:** a month calendar. Click a day to add or view plans. On login, a pop-up reminds you of today's plans.
- **Inventory:** cards for places you visited, movies you watched, books you read, and so on.
- **Admin:**
  - A users table: make or remove admins, disable or enable accounts, reset passwords, delete accounts.
  - Open any room or channel, including private ones.
  - Clear a room's or channel's contents, or delete it.

Built with Vue 3 + Tailwind CSS (client), Express + Socket.IO (server) and CouchDB.

---

## Requirements
- Node.js 20 or newer
- Access to the CouchDB server (`10.168.71.83:5984`)
- Write access to the shared uploads folder (`\\HRDLT3066\SharedFolder\FOR_COPY-PASTE\nextflow_fs`)

## First-time setup

```bash
# 1. Install
cd server && npm install
cd ../client && npm install

# 2. Settings: server/.env already exists. On a new machine, copy server/.env.example to server/.env and fill it in.

# 3. Create the first admin account
cd ../server
npm run create-admin -- admin YourPassword123 "Admin"
```

The server creates the `nexflow_db` database and its indexes the first time it starts.

## Running (development)

Use two terminals:

```bash
cd server && npm run dev      # API + live updates on http://localhost:4000
cd client && npm run dev      # the app on http://localhost:5173  ← open this one
```

## Running for other people on the network

```bash
cd client && npm run build    # builds the app into client/dist
cd ../server && npm start     # serves the app and the API on port 4000
```

Then open `http://<this-computer's-name-or-IP>:4000`, and set `CLIENT_ORIGIN` in `server/.env` to that same address.
If you put NexFlow behind HTTPS, also set `USE_HTTPS=true`.

## Security in short
- Passwords are hashed with bcrypt. They need at least 8 characters, including a letter and a number.
- The login session is an **httpOnly, SameSite=Strict cookie**, so page scripts can't read it and other websites can't use it.
- After 5 wrong passwords the account locks for 15 minutes, and login attempts are rate-limited per IP.
- Changing a password, an admin reset, or disabling an account logs that user out everywhere right away.
- Every request is validated on the server. Uploads must be real JPG, PNG, GIF or WEBP files (10 MB max) and get random file names.
- Uploaded files are only served to logged-in users.

## Troubleshooting
| Problem | Fix |
|---|---|
| `Could not start the server: ... unauthorized` | Check `COUCH_USER` / `COUCH_PASSWORD` in `server/.env`. |
| `!! Cannot write to the uploads folder` | The account running the server needs write permission on the share in `UPLOAD_DIR`. |
| `EADDRINUSE ... 4000` | Something else uses port 4000. Change `PORT` in `server/.env` and `SERVER` in `client/vite.config.js`. |
| Logged out right after logging in (on the network) | Make sure `USE_HTTPS` is `false` unless you really use `https://`. |

See [CLAUDE.md](CLAUDE.md) for how the code is organized.
