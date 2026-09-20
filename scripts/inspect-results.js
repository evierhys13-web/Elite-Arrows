import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  limit,
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
    console.error("Usage: node scripts/inspect-results.js <admin-email>");
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

  // Check orphaned pids
  const orphanPids = ["WPkJ6gzRWmexFKdM36FCnzdMZ0w1", "etBzSJ0SrigU5UaFAgqN3gdtQKO2", "DD4z3ffhtEQiL0FNqB2oR8ca1SV2"];
  console.log("=== Orphaned staging pid lookup ===");
  for (const pid of orphanPids) {
    const d = await getDoc(doc(db, "users", pid));
    console.log(`${pid}: exists=${d.exists()}`, d.exists() ? JSON.stringify(d.data()) : "");
  }

  // Sample results for current season
  console.log("\n=== Sample results (Elite Arrows Season 5) ===");
  const q = query(collection(db, "results"), where("season", "==", "Elite Arrows Season 5"), limit(3));
  const resultsSnap = await getDocs(q);
  console.log("Total matching (capped):", resultsSnap.size);
  for (const r of resultsSnap.docs) {
    console.log("--- result doc ---");
    console.log(JSON.stringify(r.data(), null, 2));
  }

  // Check what seasons exist across results and whether division info appears anywhere
  console.log("\n=== seasons field across results ===");
  const allResults = await getDocs(collection(db, "results"));
  const seasonCounts = {};
  for (const r of allResults.docs) {
    const s = r.data().season || "no-season";
    seasonCounts[s] = (seasonCounts[s] || 0) + 1;
  }
  Object.entries(seasonCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v}`);
  });

  // Does any result embed division info?
  console.log("\n=== Sample full result from any season (keys check) ===");
  const anyResult = allResults.docs[0];
  console.log("Keys:", Object.keys(anyResult.data()));

  await auth.signOut();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});