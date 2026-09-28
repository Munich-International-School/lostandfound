# Lost & Found

School lost-and-found site. The page is hosted on GitHub Pages and the data is stored in Firebase (Firestore). Both run on free plans, and there is no server.

## How it works

- Anyone can browse items and claim one with their name and class.
- Staff click **Staff** and sign in with their school email and password to add, unclaim and delete items.
- [`firestore.rules`](firestore.rules) enforces all of this in the database itself. The Firebase config in [`js/firebase-config.js`](js/firebase-config.js) is public by design.
- Claimers' names and classes are stored separately from items, and only staff can read them.

## Firebase setup

1. Create a Firebase project on the free Spark plan.
2. **Firestore Database:** Standard edition, location in Europe, production mode.
3. **Authentication:**
   - Turn on the Email/Password provider.
   - Under Settings → User actions, turn off "Enable create (sign-up)". This matters: any account on the school domain counts as staff, so only you should be able to create accounts.
   - Under Settings → Authorized domains, add `munich-international-school.github.io`.
4. **Publish the rules:** run `firebase deploy --only firestore:rules`, or paste `firestore.rules` into Firestore → Rules and click Publish.
5. Put the project's web config into `js/firebase-config.js`.

## Staff accounts

Staff are the accounts in Authentication → Users with an `@mis-munich.de` email.

- **Add a staff member:** click Add user and enter their school email and a password.
- **Remove a staff member:** delete their account.
- **Forgotten password:** use Reset password on their row, which emails them a reset link.

The domain is set in `STAFF_DOMAIN` in `js/firebase-config.js` and in `isStaff()` in `firestore.rules`. Change both together.

## Hosting

GitHub Pages serves the `main` branch root (Settings → Pages). Every push to `main` updates the site.

## Run locally

Only the published site uses the live database. Anywhere else, the page connects to the Firebase emulators, so local testing never touches real records.

```bash
firebase emulators:start       # local database and login, with the security rules
python3 -m http.server 8000    # in a second terminal
```

Then open `http://localhost:8000`. The emulated database starts empty. To log in as staff, add a user with an `@mis-munich.de` email at `http://localhost:4000/auth`.

This needs the Firebase CLI (`npm install -g firebase-tools`) and Java.
