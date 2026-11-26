# Testing

This file records what was tested, how, and what actually happened. **A test is marked as passed only when it was executed and the result was seen.** Anything not yet run is marked **NOT RUN**.

## 1. Summary

| Area | How it is tested | Status |
|---|---|---|
| Backend logic (API, database, uploads, privacy, admin) | 49 automated tests (Vitest and Supertest) | Executed. 49 of 49 passed |
| Frontend (slideshow page and admin screens) | 28 automated tests (Vitest and React Testing Library) | Executed. 28 of 28 passed |
| Server-side upload validation | `backend/scripts/simulate-uploads.js checks` against the running backend | Executed. 11 of 11 checks passed |
| Simultaneous uploads | `backend/scripts/simulate-uploads.js uploads 5` against the running backend | Executed. 4 of 4 checks passed |
| Security and repository checks | Manual commands (section 5) | Executed. 6 of 6 passed |
| Visitor screens in a real browser (12-case manual plan) | Manual test plan (section 6) | **NOT RUN** until the actual results below are filled in |

Test date: November 2026. Environment: Windows, Node.js 24, Chrome or Edge.

## 2. Automated tests

Run everything from the project root:

```powershell
npm test
```

Or run one side at a time with `npm test --prefix backend` and `npm test --prefix frontend`.

### Actual result (executed)

```text
backend:   Test Files 5 passed (5)   Tests 49 passed (49)
frontend:  Test Files 2 passed (2)   Tests 28 passed (28)
```

| Test file | Tests | What it checks |
|---|---|---|
| `backend/tests/health.test.js` | 1 | The server answers the health check |
| `backend/tests/visitors.test.js` | 7 | New visitor registration and cookie, invalid names, recognising a returning visitor without a duplicate, no cookie means no visitor, sign-in on a new device with code and name, wrong code or name refused, logout |
| `backend/tests/photos.test.js` | 13 | Upload refused without registering or without consent, safe generated file names, several photos at once (JPG, PNG, WEBP), wrong file type, fake image, file over 5 MB, duplicate photo refused, five visitors uploading at the same time, previous and new photos for a returning visitor, own photos only, deleting own photo (row and file), not deleting someone else's photo |
| `backend/tests/slideshow.test.js` | 9 | Empty list and default settings, photos from different visitors, no names exposed, photos without consent never shown, hidden photos never shown, missing files skipped, deleted photos disappear, live update event after upload and delete, no event after a failed upload |
| `backend/tests/admin.test.js` | 19 | All admin routes refused without login, same message for wrong password and unknown user, strict `HttpOnly` cookie, password stored only as a bcrypt hash, logout, dashboard totals, photo list, hide and show, invalid status, delete photo (row, file, slideshow), visitor list without codes, rename visitor, delete visitor with photos and files, settings read and update, invalid settings refused, removal requests (create, one at a time, owner only, approve hides the photo, reject keeps it) |
| `frontend/src/pages/Slideshow.test.jsx` | 11 | Empty-state screen, first photo with counter and settings, automatic change after the photo duration, wrap-around to the first photo, pause and play, Next and Previous, thumbnail jump, new photo shown at the next change, deleted photo removed, broken image dropped, "cannot reach the server" message |
| `frontend/src/pages/admin/Admin.test.jsx` | 17 | Redirect to login when signed out, wrong password message, successful login, expired session, sign out, dashboard numbers, hide and show a photo, delete with confirmation and cancel, approve and reject a removal request, settings save and validation, rename visitor, delete visitor with confirmation and cancel |

### Problems the automated tests found during development

These are real events, recorded honestly. Each was fixed and the tests were run again.

| Event | Result before | Cause | Result after |
|---|---|---|---|
| Photo tests after the first run | 18 passed, 3 failed (`UPLOAD_DIR` was undefined) | `backend/vitest.config.js` still had the old content, without the temporary upload folder setting | 21 of 21 passed in the three backend test files that existed at that time |
| Admin screen tests | 25 passed, 3 failed ("Element type is invalid") | `frontend/src/pages/admin/AdminVisitors.jsx` was an empty file (0 bytes) | 28 of 28 passed |

## 3. Server-side validation script (executed)

The browser stops bad files before they are sent. To prove that the **server** refuses them as well, `backend/scripts/simulate-uploads.js checks` sends requests straight to the API.

```text
PASS  Upload without registering is refused (HTTP 401)
PASS  Upload without the consent value is refused (HTTP 400)
PASS  Upload with consent set to "false" is refused (HTTP 400)
PASS  A .txt file is rejected as the wrong format (HTTP 400)
PASS  A text file renamed to .jpg is rejected (not a real image) (HTTP 400)
PASS  A file over 5 MB is refused (HTTP 413)
PASS  A valid photo with consent is saved (HTTP 201)
PASS  The same photo again is refused as a duplicate (HTTP 400)
PASS  Refused uploads saved nothing (only 1 photo exists) (1 photo(s))
PASS  The visitor can delete their own photo (HTTP 200)
PASS  After deleting, no photos remain (0 photo(s))

All checks passed.
```

## 4. Simultaneous uploads script (executed)

`backend/scripts/simulate-uploads.js uploads 5` registers five visitors and uploads one photo for each, all at the same moment.

```text
PASS  Every upload succeeded (HTTP 201) (5 of 5)
PASS  Every photo got a unique ID (5 unique IDs)
PASS  Every photo was saved as its own file (5 files)
PASS  All photos appear in the slideshow list (5 of 5)

All checks passed.
```

Both scripts add test visitors to the real database. `backend/scripts/cleanup-test-data.js` removes them afterwards.

## 5. Security and repository checks (executed)

| # | Check | How | Result |
|---|---|---|---|
| 1 | `.env` is not in Git and the admin password is not in any tracked file or in the history | `git ls-files`, `git check-ignore -v backend/.env`, `git grep` and `git log -S` for the password value | Passed. Only `backend/.env.example` is tracked, `.env` is ignored by the rule in `backend/.gitignore`, and neither search found the password |
| 2 | `.env.example` holds placeholders only | `type backend\.env.example` | Passed. The password line reads `replace-with-your-own-password` |
| 3 | Admin routes refuse a signed-out visitor | Open `/api/admin/stats` in a browser without signing in | Passed. Response: `{"error":"Admin login required."}` |
| 4 | Upload without a visitor cookie is refused | `Invoke-WebRequest -Method Post` to `/api/photos` | Passed. HTTP 401 |
| 5 | The public slideshow list shows no names | Open `/api/slideshow` | Passed. Each photo has only `id` and `url`, followed by the settings |
| 6 | Uploaded files have random names | List `backend\uploads` | Passed. All 15 files had UUID names ending in `.webp` |

## 6. Manual test plan (the 12 cases from the assignment)

Use a clean database if possible (see the README for how to reset). Test files: any real photos, a text file `notes.txt`, and a fake 6 MB file `big.png`. Fill in **PS C:\Users\Vaishavi\visitor-photo-slideshow\backend> node scripts/simulate-uploads.js checks | Tee-Object -FilePath C:\Users\Vaishavi\test-files\checks-output.txt
>> 
Sending good and bad uploads straight to the server (no browser checks)...

PASS  Upload without registering is refused (HTTP 401)
PASS  Upload without the consent value is refused (HTTP 400)
PASS  Upload with consent set to "false" is refused (HTTP 400)
PASS  A .txt file is rejected as the wrong format (HTTP 400)
PASS  A text file renamed to .jpg is rejected (not a real image) (HTTP 400)
PASS  A file over 5 MB is refused (HTTP 413)
PASS  A valid photo with consent is saved (HTTP 201)
PASS  The same photo again is refused as a duplicate (HTTP 400)
PASS  Refused uploads saved nothing (only 1 photo exists) (1 photo(s))
PASS  The visitor can delete their own photo (HTTP 200)
PASS  After deleting, no photos remain (0 photo(s))

A visitor called "Check Visitor" was created. You can delete it on the admin Visitors page.

All checks passed.
PS C:\Users\Vaishavi\visitor-photo-slideshow\backend> node scripts/simulate-uploads.js uploads 5 | Tee-Object -FilePath C:\Users\Vaishavi\test-files\uploads-output.txt
Registering 5 visitors, then uploading one photo each, all at once...

PASS  Every upload succeeded (HTTP 201) (5 of 5)
PASS  Every photo got a unique ID (5 unique IDs)
PASS  Every photo was saved as its own file (5 files)
PASS  All photos appear in the slideshow list (5 of 5)

These photos are now on your real slideshow. To remove them, delete the
"Simulated Visitor" entries on the admin Visitors page (their photos go too).

All checks passed.
PS C:\Users\Vaishavi\visitor-photo-slideshow\backend> 
** and **Result** after you have performed each test. Write **Pass** or **Fail** only for tests you have really done.

| # | Test | Steps | Expected result | Actual result | Result | Other evidence |
|---|---|---|---|---|---|---|
| 1 | New visitor registration | Home, then **I am a new visitor**, enter a name, press Continue | Upload page opens and the top bar says "Hi" with the name | _fill in_ | NOT RUN | Backend visitors tests |
| 2 | Returning visitor identification | (a) Refresh and open Home. (b) In a private window choose **I have been here before** and enter the visitor code and name | (a) "Welcome back" with the name. (b) Recognised, photos listed | _fill in_ | NOT RUN | Backend visitors tests |
| 3 | Single photo upload | Choose one photo, tick consent, upload | "1 photo uploaded" and the photo appears on the slideshow | _fill in_ | NOT RUN | Backend photos tests |
| 4 | Multiple photo upload | Choose three photos together, tick consent, upload | "3 photos uploaded", all under "Just uploaded" | _fill in_ | NOT RUN | Backend photos tests |
| 5 | Invalid file format | Choose `notes.txt` | Rejected with a message, no preview | _fill in_ | NOT RUN | Script: `.txt` and fake `.jpg` refused by the server (executed) |
| 6 | File exceeding the size limit | Choose `big.png` | Rejected as larger than 5 MB, no preview | _fill in_ | NOT RUN | Script: server answers HTTP 413 (executed) |
| 7 | Missing consent | Choose a photo, leave the box unticked, press Upload | Message asking for consent, nothing uploaded | _fill in_ | NOT RUN | Script: server refuses without consent (executed) |
| 8 | Automatic slideshow | Keep `/slideshow` open and upload a photo from another window | The photo appears without a refresh, each photo shows about 5 seconds | _fill in_ | NOT RUN | Frontend slideshow tests (fake timers) |
| 9 | Previous photos for a returning visitor | Sign in again as the same visitor and upload one more photo | New photo under "Just uploaded", older ones under "Your earlier photos" | _fill in_ | NOT RUN | Backend photos tests |
| 10 | Multiple simultaneous uploads | Two browsers upload at the same moment | Both succeed, each sees only its own photos, the slideshow shows both | _fill in_ | NOT RUN | Backend test and script with five visitors (executed) |
| 11 | Photo deletion | On the success page, delete a photo | It disappears from the page and from the slideshow | _fill in_ | NOT RUN | Backend photos and admin tests, script (executed) |
| 12 | Admin authentication | (a) Open `/admin` signed out. (b) Wrong password. (c) Correct password. (d) Sign out | (a) Sent to login. (b) Error message. (c) Dashboard. (d) Back to login | _fill in_ | NOT RUN | Backend and frontend admin tests, security check 3 (executed) |

### Additional manual checks

| # | Check | Expected result | Actual result | Result |
|---|---|---|---|---|
| A | Request removal of a photo, then approve it as admin | The photo leaves the slideshow | _fill in_ | NOT RUN |
| B | Change seconds per photo and the transition in Admin, Settings, with the slideshow open | The slideshow changes without a refresh | _fill in_ | NOT RUN |
| C | Stop the backend while the slideshow plays, then start it again | "Reconnecting", then "Live" again, and playback continues | _fill in_ | NOT RUN |
| D | Open `/slideshow` with many photos and check the right edge | "Back to site" and "Full screen" are fully visible and the thumbnail strip scrolls sideways | _fill in_ | NOT RUN |

## 7. Not covered by automated tests

- The visitor pages (Home, Register, Returning, Upload, Success) have no automated tests. Their rules are tested on the server side, and the screens themselves are covered only by the manual plan above.
- There are no automated end-to-end tests in a real browser. Layout and full-screen mode need a real browser, so they are checked manually.
- Load testing was not done. Simultaneous uploads were tested with five visitors only.
