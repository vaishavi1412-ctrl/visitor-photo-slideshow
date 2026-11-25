# Assumptions

The assignment leaves many details open. This file lists every assumption made, with the reason for each.

## Visitors and identity

| # | Assumption | Why |
|---|---|---|
| 1 | A visitor is recognised by a random secret token kept in an `HttpOnly` cookie. Only the SHA-256 hash of the token is stored in the database. | Names are not unique. The cookie cannot be read by page scripts, and a leaked database cannot be used to impersonate visitors. |
| 2 | Every visitor also gets a 6-character visitor code (letters and digits without look-alikes such as O, 0, I and 1). On another device, or after clearing cookies, the code plus the visitor's full name signs them in again. | Cookies belong to one browser. The code is a backup that needs no email, phone number or password. |
| 3 | Registering again in the same browser with the same name (capital letters ignored) reuses the existing record. A different name creates a new visitor. | Avoids duplicate records, while still allowing two people to share one device. |
| 4 | Signing in with the code on a new device gives that device a fresh token, and the previous device is signed out. | Keeps the design simple: one stored token hash per visitor. |
| 5 | A name must be 2 to 60 characters: letters of any language, spaces, dots, apostrophes and hyphens. Digits and symbols are not allowed. | Simple validation that blocks markup and odd input, while supporting names such as O'Brien and non-English names. |
| 6 | Visitors give only their name. No email, phone number or password is collected. | The assignment asks only for a name, and less personal data means less to protect. |
| 7 | Sign-in attempts (visitor code and admin) are limited to 10 per 15 minutes for each IP address. | Stops guessing of codes and passwords. |

## Photos and uploads

| # | Assumption | Why |
|---|---|---|
| 8 | The maximum size is 5 MB per photo (`MAX_FILE_SIZE_MB` in `.env`). | The size suggested in the assignment, and large enough for resized phone photos. |
| 9 | Only JPG, JPEG, PNG and WEBP are accepted. The file extension, the reported type and the actual image content are all checked. | These are the required formats. Decoding the image catches a text file renamed to `.jpg`. |
| 10 | Up to 10 photos can be sent in one upload. There is no limit on how many uploads a visitor makes. | Keeps each request quick and memory use small. |
| 11 | Every photo is converted to WebP, resized to fit within 1920 by 1920 pixels, turned upright using its camera rotation, and stripped of metadata such as GPS location. | Protects privacy, saves space and gives the TV consistent images. |
| 12 | An image larger than 50 million pixels is refused. | Protects the server memory from extremely large images. |
| 13 | Photos are stored in the local `backend/uploads` folder under random UUID names. The database stores only the path. | The assignment allows local storage. Random names prevent overwriting and unsafe file names. |
| 14 | A visitor cannot save the same photo twice (the SHA-256 of the file is compared per visitor). Two different visitors may upload identical files. | Prevents duplicate photo records without blocking other people. |
| 15 | Visitors can delete their own photos immediately. | Gives visitors control over their own photos. |

## Slideshow

| # | Assumption | Why |
|---|---|---|
| 16 | Each photo is shown for 5 seconds by default. The admin can change this to any whole number from 2 to 60. | The value in the assignment, with limits that keep the screen usable. |
| 17 | There are three transitions: fade (default), slide and zoom. | The assignment asks for smooth transitions and a transition setting. |
| 18 | The slideshow page needs no login. It receives only photo IDs and image addresses, never names. | A TV has no keyboard to log in with. The privacy rules are enforced by the data that is sent. |
| 19 | Photos play oldest first in a loop. A newly uploaded photo is shown at the next change instead of waiting at the end of the list. | New photos appear within seconds, as the assignment requires. |
| 20 | Live updates use Socket.IO. The page also asks the server again every 20 seconds. | Instant updates, plus a safety net if the connection drops. |
| 21 | A photo whose file is missing or fails to load is skipped. | Broken images must never be shown. |
| 22 | The venue has one slideshow with one set of settings. | The assignment describes a single TV or screen. |
| 23 | Full screen mode (or `/slideshow?tv=1`) hides the controls until the mouse moves. | A clean display for a TV. |

## Privacy and consent

| # | Assumption | Why |
|---|---|---|
| 24 | Consent is a checkbox on every upload. Photos are saved only when it is ticked, and consent is stored for each photo. | The assignment requires explicit consent. |
| 25 | Consent can be withdrawn by deleting a photo or sending a removal request. | The assignment requires a way to request removal. |
| 26 | The consent text states where photos are shown (full screen on the public display), that names are not shown, and that photos can be removed. | Consent is only meaningful when it is informed. |
| 27 | Uploaders are assumed to have the right to share the photos they upload, including people in them. Admin moderation is the safety net. | The application cannot verify who is in a photo. |
| 28 | Approving a removal request hides the photo from the slideshow immediately. Deleting it permanently is a separate admin action. | Honours the request at once, while keeping the record until the admin decides. |
| 29 | Photos are not deleted automatically after any period of time. | The assignment gives no retention rules. The admin deletes photos manually. |

## Admin

| # | Assumption | Why |
|---|---|---|
| 30 | There is one admin account. Its username and password come from `backend/.env` (password at least 8 characters) and are stored only as a bcrypt hash. | Simple, and no secret is written in the source code. |
| 31 | The admin account is created or updated every time the backend starts. | Changing the password means editing `.env` and restarting. |
| 32 | An admin session lasts 2 hours and is kept in server memory, so restarting the backend signs the admin out. | Simple and acceptable for this project. |
| 33 | The admin cookie is `HttpOnly` and `SameSite=Strict`. | Page scripts and other websites cannot use it. |
| 34 | The admin cannot see visitor codes. | Otherwise an admin could sign in as a visitor. |
| 35 | Deleting a visitor deletes all of their photos, both the database rows and the image files. | A clean removal with nothing left behind. |

## Technical and environment

| # | Assumption | Why |
|---|---|---|
| 36 | The application runs locally on Node.js 20 or newer (developed on Node 24), with the backend on port 5000 and the frontend on port 5173. | The assignment asks for something that runs locally without paid services. |
| 37 | In development, Vite forwards `/api`, `/uploads` and `/socket.io` to the backend, so the browser sees one address. | Avoids cross-origin cookie problems. |
| 38 | Cookies are marked `Secure` only in production, because local development has no HTTPS. | A `Secure` cookie would not work over plain `http://localhost`. |
| 39 | The database is the single file `backend/data/slideshow.db`, created automatically and ignored by Git. | No database server to install, and no personal data in the repository. |
| 40 | Visitors and the TV use a current browser (Chrome, Edge, Firefox or Safari, on computers and phones). | Needed for full-screen mode and live updates. |
| 41 | The application is not deployed. It is run locally for the demonstration. | The assignment asks for a deployed link only if available. |
