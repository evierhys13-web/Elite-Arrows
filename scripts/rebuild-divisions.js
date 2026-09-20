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
    console.error("Usage: node scripts/rebuild-divisions.js <admin-email>");
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

  // S4 staged divisions
  let s4Staged = {};
  const seasonsSnap = await getDocs(collection(db, "seasons"));
  seasonsSnap.docs.filter((s) => s.data().name === "Season 4").forEach((s) => {
    const st = s.data().stagedDivisions || {};
    if (Object.keys(st).length) s4Staged = st;
  });

  // Gather division evidence per player from League results
  // evidence = { division: {s5count, s4count} }
  const divEvidence = {};
  const getEv = (pid) => {
    if (!divEvidence[pid]) divEvidence[pid] = { "Elite": {s5:0,s4:0}, "Emerald": {s5:0,s4:0}, "Diamond": {s5:0,s4:0}, "Platinum": {s5:0,s4:0} };
    return divEvidence[pid];
  };
  const resultsSnap = await getDocs(collection(db, "results"));
  for (const r of resultsSnap.docs) {
    const d = r.data();
    if (d.gameType !== "League") continue;
    const s = d.season;
    const ev = (pid) => {
      const e = getEv(pid);
      if (s === "Elite Arrows Season 5" && d.division) e[d.division].s5++;
      if (s === "Season 4" && d.division) e[d.division].s4++;
    };
    ev(d.player1Id);
    ev(d.player2Id);
  }

  const divNames = ["Elite", "Emerald", "Diamond", "Platinum"];
  const pickS5 = (ev) => {
    const withS5 = divNames.filter((d) => ev[d].s5 > 0);
    if (withS5.length === 1) return withS5[0];
    if (withS5.length > 1) {
      let best = withS5[0], bestC = ev[best].s5;
      withS5.forEach((d) => { if (ev[d].s5 > bestC) { best = d; bestC = ev[d].s5; } });
      return `MIX(${withS5.join("/")})`;
    }
    return null;
  };

  console.log("username\tcurrent\tS4staged\tS5(inferred)\tS5Counts\tS4Counts\temail");
  const rows = [];
  for (const [pid, u] of Object.entries(userById)) {
    const name = u.username || pid;
    const current = u.division || "Unassigned";
    const s4 = s4Staged[pid] || null;
    const ev = divEvidence[pid] || {};
    const s5inf = pickS5(ev);
    const s5s = divNames.map((d) => ev[d]?.s5 || 0).join("/");
    const s4s = divNames.map((d) => ev[d]?.s4 || 0).join("/");
    rows.push({ name, current, s4, s5inf, s5s, s4s, email: u.email || "", admin: u.isAdmin });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  for (const r of rows) {
    console.log(`${r.name}\t${r.current}\t${r.s4 || "-"}\t${r.s5inf || "-"}\t${r.s5s}\t${r.s4s}\t${r.email}${r.admin ? " [ADMIN]" : ""}`);
  }

  await auth.signOut();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});