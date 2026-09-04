/* One-off diagnostic script: list distinct `season` values found across the
 * results collection, so we can see what label Seasons 1-5 results actually use.
 *
 * Run with:
 *   node scripts/inspect-season-labels.js your.admin.email@example.com
 *
 * You will be prompted for your admin account password.
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, query, limit } from "firebase/firestore";
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
    console.error("Usage: node scripts/inspect-season-labels.js <admin-email>");
    process.exit(1);
  }

  const password = await readPassword("Admin password: ");
  const app = initializeApp(firebaseConfig, "season-inspect");
  const auth = getAuth(app);
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    console.error("Sign-in failed:", e.message);
    process.exit(1);
  }

  const db = getFirestore(app);
  const snap = await getDocs(query(collection(db, "results"), limit(1000)));

  const bySeason = {};
  const noSeasonCount = { pending: 0, approved: 0, other: 0 };
  snap.docs.forEach((d) => {
    const data = d.data();
    const s = data.season === undefined || data.season === null || data.season === "" ? "(none)" : String(data.season);
    const status = String(data.status || "").toLowerCase();
    if (!bySeason[s]) bySeason[s] = { total: 0, approved: 0, pending: 0, other: 0 };
    bySeason[s].total++;
    if (status === "approved") bySeason[s].approved++;
    else if (status === "pending" || status === "result_submitted") bySeason[s].pending++;
    else bySeason[s].other++;
  });

  console.log(`\nResults scanned: ${snap.size} (capped at 1000)`);
  console.log("Distinct 'season' values:");
  Object.entries(bySeason)
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .forEach(([label, counts]) => {
      console.log(`  "${label}" -> approved: ${counts.approved}, pending: ${counts.pending}, other: ${counts.other}, total: ${counts.total}`);
    });

  // Also list what seasons docs exist
  const seasonsSnap = await getDocs(collection(db, "seasons"));
  console.log("\nSeasons collection docs:");
  seasonsSnap.docs.forEach((d) => {
    const data = d.data();
    const stagedCount = Object.keys(data.stagedDivisions || {}).length;
    console.log(`  - id=${d.id} name=${JSON.stringify(data.name)} isArchived=${data.isArchived} stagedDivisions=${stagedCount}`);
  });

  // Show a few sample approved results from each of Seasons 1-3 to see player
  // fields (ids vs names) and division recording.
  const sampleBySeason = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    const s = String(data.season || "");
    if (["Season 1", "Season 2", "Season 3"].includes(s) && String(data.status || "").toLowerCase() === "approved") {
      if (!sampleBySeason[s]) sampleBySeason[s] = [];
      if (sampleBySeason[s].length < 3) sampleBySeason[s].push(data);
    }
  });
  console.log("\nSample approved results per historical season:");
  Object.entries(sampleBySeason).forEach(([s, rows]) => {
    rows.forEach((r) => {
      console.log(`  ${s}: p1=${JSON.stringify(r.player1)} p1Id=${JSON.stringify(r.player1Id)} p2=${JSON.stringify(r.player2)} p2Id=${JSON.stringify(r.player2Id)} div=${JSON.stringify(r.division)} score=${r.score1}-${r.score2}`);
    });
  });

  await auth.signOut();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});