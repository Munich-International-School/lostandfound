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

// The shared staff login. The staff code is this account's password.
// Must match isStaff() in firestore.rules.
export const STAFF_EMAIL = "staff@example.com";
