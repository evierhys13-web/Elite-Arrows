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
    console.error("Usage: node scripts/inspect-season.js <admin-email>");
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

  const seasonsSnap = await getDocs(collection(db, "seasons"));
  const s4 = seasonsSnap.docs.find((s) => s.data().name === "Season 4" && !s.data().isArchived);
  // There are two Season 4 docs; pick the non-archived active one that has staging
  let s4Staged = {};
  seasonsSnap.docs.filter((s) => s.data().name === "Season 4").forEach((s) => {
    const st = s.data().stagedDivisions || {};
    if (Object.keys(st).length) s4Staged = st;
  });
  console.log("Season 4 staged division count:", Object.keys(s4Staged).length);

  const usersSnap = await getDocs(collection(db, "users"));
  console.log("Total users:", usersSnap.size);

  const usersById = {};
  for (const u of usersSnap.docs) {
    usersById[u.id] = u.data();
  }

  // Which Season 4 staged players are currently Unassigned vs assigned?
  let s4StagedUnassigned = 0, s4StagedAssigned = 0;
  const s4StagedUnassignedList = [];
  for (const [pid, div] of Object.entries(s4Staged)) {
    const u = usersById[pid] || {};
    const cur = u.division || "null";
    if (cur === "Unassigned" || cur === "null") {
      s4StagedUnassigned++;
      s4StagedUnassignedList.push(`${u.username || pid}: was ${div} -> now ${cur}`);
    } else {
      s4StagedAssigned++;
    }
  }
  console.log("S4 staged players now Unassigned:", s4StagedUnassigned);
  console.log("S4 staged players still Assigned:", s4StagedAssigned);
  s4StagedUnassignedList.forEach((x) => console.log("  " + x));
  console.log("");

  // Full dump of every user: username, current division, S4 staged division (if any)
  console.log("=== ALL USERS ===");
  const rows = [];
  for (const u of usersSnap.docs) {
    const d = u.data();
    rows.push({
      name: d.username || u.id,
      current: d.division || "null",
      s4: s4Staged[u.id] || null,
      email: d.email || "",
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of rows) {
    console.log(`${r.name}\tcurrent=${r.current}\ts4=${r.s4}\t${r.email}`);
  }

  await auth.signOut();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
