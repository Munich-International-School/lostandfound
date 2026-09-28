# Lost & Found

Simple Lost & Found web app with two storage modes:

- **Server mode**: Node/Express + SQLite, using `/data/lostandfound.sqlite`
- **Static mode**: browser `localStorage`, so it can run on GitHub Pages

## GitHub Pages support

Yes — the site can run on GitHub Pages **as a static app**.

Important limitation: GitHub Pages cannot run the Node/Express server or the SQLite database, so data entered on GitHub Pages is saved **only in the browser being used**. It is not shared across devices or users.

If you need shared school-wide data, you will need a real backend host or a hosted database service.

## Run locally with the shared SQLite server

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000`.

## Run on GitHub Pages

1. Publish the repository from the default branch with GitHub Pages.
2. Open the published site URL.
3. The app will automatically switch to browser-only storage mode.
