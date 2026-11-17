// Bramka #7: panel admina weryfikuje status ADMIN, ale nie zarządza statusami.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "..", "admin.html");
const html = fs.readFileSync(file, "utf8");

const required = [
  'getDoc(doc(db, "users", user.uid))',
  'snap.data().status === "ADMIN"',
  "if (!currentUser || !isAdmin) return;",
  "await signOut(auth);",
];

const missing = required.filter((snippet) => !html.includes(snippet));
const forbidden = html.includes('setDoc(doc(db, "users"') ||
  html.includes('"status": "APPROVED"');

if (missing.length || forbidden) {
  console.error("ADMIN_GUARD_FAIL", {
    missing,
    writesUserStatus: forbidden,
  });
  process.exit(1);
}

console.log("ADMIN_GUARD_OK");
