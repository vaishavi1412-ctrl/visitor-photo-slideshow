# AI Log

**AI tool used:** Claude (Anthropic), used in a chat conversation, one development phase at a time (planning, setup, backend, frontend, integration, documentation).

This log lists ten important interactions. For each one it records the prompt, what the AI produced, what was wrong or incomplete, how the problem was found and how it was fixed. Only events that actually occurred are recorded. The interactions documented below were reviewed for accuracy and completeness.

## Summary

|#|Phase|Topic|AI mistake or gap?|
|-|-|-|-|
|1|Planning|Architecture, stack and database design|No problem found (one revision made later)|
|2|Setup|Project setup commands|**Yes. Commands for the wrong operating system**|
|3|Setup and frontend|"Backend is not reachable" and the missing proxy|**Yes. Wrong first diagnosis, config file mix-up**|
|4|Backend tests|Wrong test configuration, 3 photo tests failing|**Yes. Look-alike config files, unsafe fallback**|
|5|Git|Database files committed by mistake|**Yes. A needed file was never created**|
|6|Frontend tests|Hidden encoding character in `package.json`|**Yes. A command that wrote invalid JSON**|
|7|Slideshow|First version was too bare|**Yes. Incomplete against the request**|
|8|Slideshow|Page wider than the window|**Yes. Bug that the tests could not see**|
|9|Integration|Coloured test images on the real slideshow|Gap: helper script had no cleanup|
|10|Admin tests|Test failures caused by an empty file|No (the cause was an empty file)|

## Entry 1: Planning and architecture

* **Prompt given to AI (summary):** The full assignment text, asking for a requirement checklist, a beginner-friendly technology stack, a folder structure, the database design and a phased plan with approval after each phase.
* **What the AI generated:** A requirement checklist, the stack (React with Vite, Express, SQLite, Socket.IO, `multer`, `sharp`), a folder structure, five tables (`visitors`, `photos`, `admin`, `slideshow_settings` and a `removal_requests` table for the removal requirement), a returning-visitor design (cookie token plus a short visitor code as backup) and a seven-phase plan.
* **What was incorrect or incomplete:** Nothing was found wrong at the planning stage. In the next phase the AI revised one choice itself: `bcrypt` was replaced by `bcryptjs`, because `bcrypt` often needs build tools that fail to install on Windows.
* **How I identified the issue:** I reviewed the plan against every requirement in the assignment before approving it.
* **How it was corrected:** I approved the plan with the `visitor_code` backup and the `removal_requests` table. The `bcryptjs` change was applied during setup.
* **Evidence:** The final design is documented in `ARCHITECTURE.md`.

## Entry 2: Setup commands written for the wrong operating system

* **Prompt given to AI (summary):** Asked for Phase 2, the project setup, with exact commands.
* **What the AI generated:** Folder and file commands written for Linux and macOS (`mkdir -p`, `touch`, `cp`).
* **What was incorrect or incomplete:** I use Windows with PowerShell, where these commands do not work. This was a genuine AI mistake: it assumed an environment instead of asking.
* **How I identified the issue:** The commands failed in my terminal, and I told the AI I use Windows.
* **How it was corrected:** The AI rewrote every command for PowerShell (`New-Item`, `copy`, here-strings) and used PowerShell commands from then on.
* **Evidence:** The Phase 2 setup worked afterwards and the backend started on port 5000.

## Entry 3: "Backend is not reachable" and the missing proxy

* **Prompt given to AI (summary):** I pasted the page text "Backend is not reachable" and later the message "Something went wrong. Please try again" shown on the registration form, and asked what was wrong.
* **What the AI generated:** A Vite proxy configuration that forwards `/api` to the backend, and a series of checks.
* **What was incorrect or incomplete:** The AI's first diagnosis (that `localhost` was resolving to an IPv6 address) was wrong, and its first fix did not help. The real cause was that `frontend/vite.config.js` on my disk still had the default content with no proxy, so Vite returned the React page for `/api/health` instead of passing the request to the backend. Later the same symptom came back because `vite.config.js` contained the backend's test settings (`DB_FILE`, `UPLOAD_DIR`), so two similar-looking config files had been mixed up.
* **How I identified the issue:** The AI asked me to print the real file with `type vite.config.js`. The first time it showed the default file with no proxy. The second time it showed the backend test settings. Opening `/api/health` through the frontend returned an HTML page instead of JSON.
* **How it was corrected:** The file was rewritten from PowerShell with the proxy settings and checked by printing it again. After restarting, `http://localhost:5173/api/health` returned `{"status":"ok"}` and registration worked.
* **Evidence:** `/api/health` returned `{"status":"ok"}` through the frontend, and the screenshot of the Upload page showed the visitor greeting after registering.

## Entry 4: Wrong test configuration and three failing photo tests

* **Prompt given to AI (summary):** I pasted the output of `npm test` in the backend, first with an error about `@vitejs/plugin-react` and later with three failing photo tests.
* **What the AI generated:** A corrected `backend/vitest.config.js` that sets an in-memory database and a temporary upload folder for tests.
* **What was incorrect or incomplete:** The backend config had React content in it, which belongs to the frontend. After the next change the old file was still in place, so `UPLOAD_DIR` was undefined and the tests failed. The AI's own code also had a weakness: when the test setting was missing, `config.js` silently fell back to the real `uploads` folder, so test images were written into real data.
* **How I identified the issue:** The error named `@vitejs/plugin-react` inside a backend file, and the failing lines showed `path.join(UPLOAD_DIR, ...)` receiving `undefined`.
* **How it was corrected:** The config file was rewritten and printed to check it, and the stray test images were removed from the real `uploads` folder.
* **Evidence:** Before: 18 passed and 3 failed. After: 21 of 21 passed, later 49 of 49 for the whole backend.

## Entry 5: Database files committed by mistake

* **Prompt given to AI (summary):** I pasted the output of my first `git commit`.
* **What the AI generated:** The Windows version of the setup steps, which listed the project folders and files.
* **What was incorrect or incomplete:** The root `.gitignore` and `README.md` were never created in the Windows version, so Git had no rule to ignore `backend/data/slideshow.db` and its two companion files. They were committed. This was a genuine AI mistake: a required step was left out.
* **How I identified the issue:** The `git commit` output listed `slideshow.db`, `slideshow.db-shm` and `slideshow.db-wal`, which should never be in a repository.
* **How it was corrected:** A root `.gitignore` was created, the three files were removed from Git only (`git rm --cached`), and the commit was amended before anything was pushed.
* **Evidence:** `git ls-files` no longer listed any `slideshow.db` file, and `git check-ignore -v backend/.env` showed that `.env` is ignored.

## Entry 6: A hidden character that made `package.json` invalid

* **Prompt given to AI (summary):** I pasted a long error from `npm test` in the frontend: "Invalid package config ... package.json is not valid JSON" followed by "Cannot find dependency 'jsdom'".
* **What the AI generated:** A PowerShell command (`Set-Content -Encoding utf8`) that rewrote the root `package.json`.
* **What was incorrect or incomplete:** In Windows PowerShell that command adds an invisible byte-order mark at the start of the file. `npm` ignores it, but Node and Vitest reject it. The "missing jsdom" message was a side effect and misleading. This was a genuine AI mistake.
* **How I identified the issue:** I read the error line that said `package.json ... is not valid JSON`, which pointed at the root file and not at `jsdom`.
* **How it was corrected:** The file was rewritten without the byte-order mark using `[IO.File]::WriteAllText` with a UTF-8 encoding without BOM. Then a `node -e "JSON.parse(...)"` check printed that the file was valid.
* **Evidence:** `npm ls` listed `jsdom`, `@testing-library/react` and `@testing-library/dom`, and the frontend tests ran afterwards.

## Entry 7: The first slideshow page was too bare

* **Prompt given to AI (summary):** Asked for the full-screen TV slideshow with smooth transitions, an empty state, live updates and no broken images.
* **What the AI generated:** A full-screen photo page with transitions, live updates and 11 behaviours, but with its buttons hidden until the mouse moved.
* **What was incorrect or incomplete:** The page worked, but it looked like only an image. I wanted a proper slideshow screen with a layout, visible buttons and tests. This was incomplete against my request.
* **How I identified the issue:** I opened `/slideshow` in the browser and told the AI I wanted a proper layout with buttons and tests.
* **How it was corrected:** The page was rebuilt with a header and live badge, a thumbnail strip, a control bar (Previous, Play or Pause, Next, Full screen), a counter, a clean display mode, and 11 automated tests with fake timers.
* **Evidence:** The 11 slideshow tests passed (see `TESTING.md`).

## Entry 8: The slideshow page was wider than the window

* **Prompt given to AI (summary):** I sent a screenshot of the new slideshow with 19 photos uploaded.
* **What the AI generated:** The layout and styles of the slideshow page, which passed all 11 automated tests.
* **What was incorrect or incomplete:** In a real browser the right side of the page was cut off ("Back to si", "Full scre"). The thumbnail strip made the grid column as wide as all the thumbnails together. The automated tests could not catch this, because the fake browser used by the tests does not calculate layout. This was a genuine AI mistake that tests could not detect.
* **How I identified the issue:** The screenshot showed the clipped buttons.
* **How it was corrected:** A column rule `grid-template-columns: minmax(0, 1fr)` and `min-width: 0` on the header, stage, bottom area and thumbnail strip were added, so the strip scrolls inside the window.
* **Evidence:** Verified in the browser. The "Back to site" and "Full screen" buttons were fully visible, and the thumbnail strip scrolled horizontally as expected.
## Entry 9: Coloured test images appeared on the real slideshow

* **Prompt given to AI (summary):** Asked for helper scripts to test simultaneous uploads and server-side validation, and later told the AI that the slideshow showed extra plain-colour images.
* **What the AI generated:** `backend/scripts/simulate-uploads.js`, which creates solid-colour test photos for "Simulated Visitor" and "Check Visitor" through the real API.
* **What was incorrect or incomplete:** The script worked, but it had no cleanup. Every run left more plain-colour photos on the real slideshow, which looked like a bug. The AI first had to explain that these were its own test images.
* **How I identified the issue:** The slideshow screenshot showed plain blue, green and purple images next to my real photos.
* **How it was corrected:** A cleanup script, `backend/scripts/cleanup-test-data.js`, was added. It signs in as admin, and deletes only visitors named "Simulated Visitor" or "Check Visitor" (their photos go too).
* **Evidence:** Ran the cleanup script successfully. No test visitors were found, so no visitor records or photos were removed. The script reported that 1 real visitor was left untouched. Verified that the slideshow continued displaying correctly after cleanup.
## Entry 10: Automated tests caught an empty file

* **Prompt given to AI (summary):** I pasted a failing `npm test` run in the frontend with "Element type is invalid" errors.
* **What the AI generated:** The admin screens and their tests. It also gave a checking command.
* **What was incorrect or incomplete:** Nothing in the AI's code was wrong. `frontend/src/pages/admin/AdminVisitors.jsx` was an empty file (0 bytes), because its code never reached the file. The AI could not tell this from the error alone, so it asked me to check the file.
* **How I identified the issue:** `(Get-Item AdminVisitors.jsx).Length` printed `0`.
* **How it was corrected:** The code was put into the file and saved.
* **Evidence:** Before: 25 passed and 3 failed. After: 28 of 28 passed. This shows that the automated tests found a broken page before manual testing.

