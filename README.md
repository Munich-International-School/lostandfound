# Lost & Found

School lost-and-found site. The page is hosted on GitHub Pages and the data is stored in Firebase (Firestore). Both run on free plans, and there is no server.

## How it works

- Anyone can browse items and claim one with their name and class.
- Staff click **Staff** and enter the staff code to add, unclaim and delete items.
- [`firestore.rules`](firestore.rules) enforces all of this in the database itself. The Firebase config in [`js/firebase-config.js`](js/firebase-config.js) is public by design.
- Claimers' names and classes are stored separately from items, and only staff can read them.

## Firebase setup

1. Create a Firebase project on the free Spark plan.
2. **Firestore Database:** Standard edition, location in Europe, production mode.
3. **Authentication:**
   - Turn on the Email/Password provider.
   - Under Settings → User actions, turn off "Enable create (sign-up)".
   - Add the user `staff@example.com`. Its password is the staff code.
4. **Publish the rules:** run `firebase deploy --only firestore:rules`, or paste `firestore.rules` into Firestore → Rules and click Publish.
5. Put the project's web config into `js/firebase-config.js`.

**Changing the staff code:** in Authentication → Users, delete `staff@example.com`, then add it again with the new code.

## Hosting

GitHub Pages serves the `main` branch root (Settings → Pages). Every push to `main` updates the site.

## Run locally

The page uses JavaScript modules, so serve it over HTTP instead of opening the file directly:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The page uses the real Firebase database.
