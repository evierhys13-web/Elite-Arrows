import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
} from "firebase/firestore";
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
    console.error("Usage: node scripts/inspect-fixtures.js <admin-email>");
    process.exit(1);
  }
  const password = await readPassword("Admin password: ");
  const app = initializeApp(firebaseConfig, "inspect");
  const auth = getAuth(app);
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    console.error("Sign-in failed:", e.message);
    process.exit(1);
  }
  const db = getFirestore(app);

  const usersSnap = await getDocs(collection(db, "users"));
  const userById = {};
  for (const u of usersSnap.docs) userById[u.id] = u.data();

  const fixturesSnap = await getDocs(collection(db, "fixtures"));
  console.log("Total fixtures:", fixturesSnap.size);

  // Sample a few to see structure
  let printed = 0;
  const fixtureCountBySeason = {};
  for (const f of fixturesSnap.docs) {
    const d = f.data();
    const season = d.season || "no-season";
    fixtureCountBySeason[season] = (fixtureCountBySeason[season] || 0) + 1;
    if (season === "Elite Arrows Season 5" && printed < 3) {
      console.log("--- sample S5 fixture ---");
      console.log(JSON.stringify(d, null, 2).substring(0, 1200));
      printed++;
    }
  }
  console.log("\nFixture counts by season:");
  Object.entries(fixtureCountBySeason).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // Dump S5 fixtures with player names + any division fields
  console.log("\n=== Season 5 fixtures ===");
  let count = 0;
  for (const f of fixturesSnap.docs) {
    const d = f.data();
    if ((d.season || "") !== "Elite Arrows Season 5") continue;
    count++;
    const p1 = userById[d.player1Id]?.username || d.player1;
    const p2 = userById[d.player2Id]?.username || d.player2;
    console.log(`  ${p1} | ${p2} | div=${d.division || "-"} | played=${d.played || "-"}`);
  }
  console.log("(S5 fixtures total:", count + ")");

  await auth.signOut();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});