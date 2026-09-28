// Firebase web config (Project settings > General > Your apps). These values are
// public by design; firestore.rules is what keeps the data safe.
export const firebaseConfig = {
  apiKey: "AIzaSyDLBJrig05xyJQrzKJtihmbJ-Ms6JGjgHo",
  authDomain: "lostandfound-e5e91.firebaseapp.com",
  projectId: "lostandfound-e5e91",
  storageBucket: "lostandfound-e5e91.firebasestorage.app",
  messagingSenderId: "785223982869",
  appId: "1:785223982869:web:b6eaf77aa48ab0aade531c"
};

// Staff sign in with their own account (Authentication > Users) on this email domain.
// Must match isStaff() in firestore.rules.
export const STAFF_DOMAIN = "mis-munich.de";

// Only the published site uses the live database. Anywhere else (e.g. localhost)
// uses the Firebase emulators, so local testing never touches real records.
export const LIVE_HOST = "munich-international-school.github.io";
