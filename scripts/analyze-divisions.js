import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
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
    console.error("Usage: node scripts/analyze-divisions.js <admin-email>");
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

  // Users
  const usersSnap = await getDocs(collection(db, "users"));
  const userById = {};
  for (const u of usersSnap.docs) userById[u.id] = u.data();

  // Results
  const resultsSnap = await getDocs(collection(db, "results"));
  const seasonCounts = {};
  // playerId -> Set of divisions seen in results (only League results, current/prev season)
  const divByPlayer = {};
  const addDivision = (pid, div) => {
    if (!pid || !div) return;
    if (!divByPlayer[pid]) divByPlayer[pid] = new Set();
    divByPlayer[pid].add(div);
  };
  const seasonResults = {};

  for (const r of resultsSnap.docs) {
    const d = r.data();
    const season = d.season || "no-season";
    seasonCounts[season] = (seasonCounts[season] || 0) + 1;
    if (season === "Elite Arrows Season 5" || season === "Season 4") {
      if (!seasonResults[season]) seasonResults[season] = [];
      if (d.gameType === "League") {
        seasonResults[season].push({
          p1: d.player1Id,
          p1n: d.player1,
          p2: d.player2Id,
          p2n: d.player2,
          div: d.division,
        });
        addDivision(d.player1Id, d.division);
        addDivision(d.player2Id, d.division);
      }
    }
  }

  console.log("=== Result counts by season ===");
  Object.entries(seasonCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  console.log("\n=== League results (Season 5 + Season 4) ===");
  ["Elite Arrows Season 5", "Season 4"].forEach((season) => {
    const list = seasonResults[season] || [];
    console.log(`\n--- ${season} (${list.length} league results) ---`);
    list.forEach((r) => {
      const n1 = userById[r.p1]?.username || r.p1n;
      const n2 = userById[r.p2]?.username || r.p2n;
      console.log(`  ${n1} | ${n2} | div=${r.div}`);
    });
  });

  // Per player inferred division for the currently unassigned players
  console.log("\n=== Inferred divisions for UNASSIGNED players ===");
  const unassigned = [];
  for (const [pid, d] of Object.entries(userById)) {
    if (!d.division || d.division === "Unassigned") {
      const divs = divByPlayer[pid] ? [...divByPlayer[pid]] : [];
      unassigned.push({
        name: d.username || pid,
        divs,
        email: d.email || "",
        isAdmin: d.isAdmin,
      });
    }
  }
  unassigned.sort((a, b) => a.name.localeCompare(b.name));
  for (const u of unassigned) {
    console.log(`  ${u.name}\tdivs=[${u.divs.join(",")}]\t${u.email}${u.isAdmin ? " [ADMIN]" : ""}`);
  }

  await auth.signOut();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});