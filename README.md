# Visitor Photo Slideshow

A web application where visitors enter their name, upload photos and give explicit consent, and the photos then play automatically as a live slideshow on a TV or computer screen. Returning visitors are recognised and see their earlier photos together with new ones. A small admin area lets staff moderate photos and manage visitors and slideshow settings.

Built as **Assignment 1: Visitor Photo Slideshow** (MCA).

## What the application does

1. A visitor opens the website on their phone or laptop and registers with their full name.
2. They choose one or more photos, see previews, tick a consent box and upload.
3. The photos appear on the slideshow screen within seconds, without anyone refreshing the page.
4. When the same visitor comes back, the app recognises them and shows their previous and new photos.
5. An admin can hide or delete photos, manage visitors, answer removal requests and change how the slideshow behaves.

## Features

**Visitors**
- Welcome page, registration page and returning visitor page
- Returning visitors recognised by a private cookie, or by a short visitor code plus their name on another device
- No duplicate visitor records for the same browser and name

**Photo upload**
- Multiple photos at once (up to 10 per upload), JPG, JPEG, PNG and WEBP
- Maximum 5 MB per photo, checked in the browser and again on the server
- Previews before upload, and photos can be removed from the list before submitting
- Upload progress bar, clear error messages and per-photo results
- Visitors can delete their own photos or ask the admin to remove them

**Slideshow (TV mode)**
- Separate full-screen page at `/slideshow`, with Play/Pause, Previous/Next, thumbnails and Full screen
- About 5 seconds per photo (the admin can change this from 2 to 60 seconds)
- Smooth transitions (fade, slide or zoom) and a slow zoom effect on every photo
- Updates automatically when photos are uploaded or removed (Socket.IO, with a polling backup)
- Friendly empty-state screen, and broken or missing images are never shown

**Admin**
- Login, dashboard (total visitors, total photos, photos on the slideshow, recent visitors, pending requests)
- Photo management: hide, show again, delete
- Visitor management: rename, delete (their photos are deleted too)
- Removal requests: approve (hides the photo) or reject
- Slideshow settings: seconds per photo and transition type

**Privacy and security**
- Explicit consent checkbox on every upload, stored for each photo; photos without consent are never shown
- Server-side validation of file type, real image content and file size
- Random file names, so files can never overwrite each other
- Hashed admin password and hashed visitor tokens
- Admin routes protected on the server
- No secrets in the repository (`.env` is ignored by Git, `.env.example` holds placeholders only)

## Technology stack

| Part | Choice |
|---|---|
| Frontend | React with Vite, React Router, plain CSS |
| Backend | Node.js with Express |
| Database | SQLite (`better-sqlite3`) |
| Live updates | Socket.IO |
| Upload handling | `multer` and `sharp` |
| Passwords | `bcryptjs` |
| Tests | Vitest, Supertest, React Testing Library |

Reasons for each choice are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Project structure

```
visitor-photo-slideshow/
├── README.md, ASSUMPTIONS.md, ARCHITECTURE.md, TESTING.md, AI_LOG.md
├── package.json          (root scripts: start both servers, run all tests)
├── backend/              (Express API, SQLite, Socket.IO, tests, helper scripts)
│   ├── .env.example
│   ├── src/              (app, routes, middleware, utils)
│   ├── tests/
│   └── scripts/
└── frontend/             (React app and its tests)
    └── src/
```

## Getting started

### Requirements

- Node.js 20 or newer (developed on Node 24)
- Git

### Install

```bash
git clone https://github.com/<your-username>/visitor-photo-slideshow.git
cd visitor-photo-slideshow
npm install
npm install --prefix backend
npm install --prefix frontend
```

### Configure

Copy the example settings file and fill in your own values.

Windows (PowerShell):

```powershell
copy backend\.env.example backend\.env
```

macOS or Linux:

```bash
cp backend/.env.example backend/.env
```

Then open `backend/.env` and set your admin login:

| Setting | Example | Meaning |
|---|---|---|
| `PORT` | `5000` | Port of the backend |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Address of the frontend that may call the API |
| `ADMIN_USERNAME` | `admin` | Admin login name |
| `ADMIN_PASSWORD` | your own password | At least 8 characters. Never commit this file |
| `MAX_FILE_SIZE_MB` | `5` | Maximum size of one photo |

### Database setup

There is nothing to install or create by hand. When the backend starts for the first time it:

- creates the SQLite file `backend/data/slideshow.db` and all tables,
- adds the default slideshow settings (5 seconds, fade transition),
- creates the admin account from `backend/.env` (it is updated if you change the values and restart).

To start completely fresh, stop the backend and delete `backend/data/slideshow.db*` and the `.webp` files in `backend/uploads/`.

### Run

From the project root, one command starts both the backend and the frontend:

```bash
npm run dev
```

Or run them separately in two terminals:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

| Address | What it is |
|---|---|
| `http://localhost:5173` | The website for visitors |
| `http://localhost:5173/slideshow` | The TV or computer slideshow screen |
| `http://localhost:5173/admin/login` | Admin login |
| `http://localhost:5000/api/health` | Backend health check |

You can open the website on a phone on the same network by replacing `localhost` with your computer's address, if your firewall allows it.

## How to use

**Visitors**
1. Open the website and choose **I am a new visitor**. Enter your full name.
2. On the upload page choose photos (or drag them in), check the previews, tick the consent box and press **Upload**.
3. The success page shows your visitor code. Keep it: on another device, choose **I have been here before** and enter the code with your name.
4. From **My photos** you can delete a photo or send a removal request.

**The slideshow screen**
1. Open `/slideshow` on the TV or computer, and press **Full screen** (or open `/slideshow?tv=1` to start in clean display mode).
2. Keyboard: **F** full screen, **Space** pause or play, **Left and Right arrows** previous and next.
3. In full screen the buttons hide themselves and come back when you move the mouse.

**Admin**
1. Sign in at `/admin/login`.
2. Use **Photos** to hide, show or delete photos and to answer removal requests, **Visitors** to rename or delete visitors, and **Settings** to change seconds per photo and the transition.

## Running the tests

```bash
npm test                          # all tests (backend, then frontend)
npm test --prefix backend         # backend only
npm test --prefix frontend        # frontend only
```

At the time of writing, 77 automated tests pass (49 backend and 28 frontend). The full test report, the manual test plan and its results are in [TESTING.md](TESTING.md).

### Helper scripts

Run these from the `backend` folder while the backend is running:

```bash
node scripts/simulate-uploads.js checks      # the server must refuse bad uploads
node scripts/simulate-uploads.js uploads 5   # five visitors upload at the same time
node scripts/cleanup-test-data.js            # remove the test visitors and their photos
```

The first two add test photos to the real slideshow, so run the cleanup script afterwards.

## Privacy and security summary

- Photos are shown only with explicit consent, only on the public slideshow screen, and never with names.
- Uploads are validated by file type, real image content and size, then re-encoded as WebP (this also removes hidden metadata such as GPS location).
- Admin access needs a login; passwords and visitor tokens are stored only as hashes.
- Every decision is explained in [ARCHITECTURE.md](ARCHITECTURE.md) and [ASSUMPTIONS.md](ASSUMPTIONS.md).

## Documentation

| File | Contents |
|---|---|
| [ASSUMPTIONS.md](ASSUMPTIONS.md) | Every assumption made where the assignment was not specific |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Design, database, data flows and diagrams |
| [TESTING.md](TESTING.md) | Automated tests, manual test plan and real results |
| [AI_LOG.md](AI_LOG.md) | How AI was used, including real mistakes and how they were fixed |

## Deployed application

Not deployed. The application runs locally, as the assignment allows.

## Known limitations

- Admin sessions are kept in server memory, so restarting the backend signs the admin out.
- Photos are stored on the local disk, which is suitable for development and a single venue, not for large-scale hosting.
- There is no HTTPS locally, so cookies are marked `Secure` only when `NODE_ENV=production`.
- Photos are not deleted automatically after a period of time; the admin removes them.

## Author

`<Your name>`, MCA student. Replace this line before submitting.