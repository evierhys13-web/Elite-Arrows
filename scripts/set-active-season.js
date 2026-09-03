/* One-off admin script: set the live league season to "Elite Arrows Season 5".
 *
 * This fixes users being "stuck" in an older season when submitting league
 * results, by updating adminData.currentSeason in Firestore.
 *
 * Run with:
 *   node scripts/set-active-season.js your.admin.email@example.com
 *
 * You will be prompted for your admin account password (used only to sign in
 * to Firebase so the update is performed with your admin permissions).
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
import readline from "node:readline";

const firebaseConfig = {
  apiKey: "AIzaSyBRAM_91550mH8OUGiVlaL1ewWjrCWhgkY",
  authDomain: "elitearrowsapp.firebaseapp.com",
  projectId: "elitearrowsapp",
  storageBucket: "elitearrowsapp.firebasestorage.app",
  messagingSenderId: "848326452210",
  appId: "1:848326452210:web:3626c7f4214167d51ec16b",
  measurementId: "G-6BPQKR71P5",
};

const TARGET_SEASON = "Elite Arrows Season 5";

const readPassword = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error(
      "Usage: node scripts/set-active-season.js <admin-email>"
    );
    process.exit(1);
  }

  const password = await readPassword("Admin password: ");

  const app = initializeApp(firebaseConfig, "season-fix");
  const auth = getAuth(app);

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    console.error("Sign-in failed:", e.message);
    process.exit(1);
  }

  const db = getFirestore(app);
  await updateDoc(doc(db, "adminData", "main"), {
    currentSeason: TARGET_SEASON,
  });

  console.log(`Done! adminData.currentSeason set to "${TARGET_SEASON}".`);
  console.log(
    "Users should now be able to submit league games against the live season."
  );
  await auth.signOut();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
