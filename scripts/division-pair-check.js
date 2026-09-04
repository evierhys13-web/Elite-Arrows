/* Diagnostic: replicate Table.jsx division-pair filter to see how many league
 * matches are dropped when the two players' recorded divisions differ, and how
 * many players per division survive.
 *
 * Run: node scripts/division-pair-check.js your.admin.email@example.com
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
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

const readPassword = () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { rl.question("Admin password: ", (a) => { rl.close(); resolve(a); }); });
};

const normalizeText = (v) => String(v || "").trim().toLowerCase();

const getResultPlayerId = (result, n, users) => {
  const directId = result[`player${n}Id`];
  if (directId) return String(directId);
  const name = normalizeText(result[`player${n}`]);
  if (!name) return "";
  const user = users.find((u) => {
    const vals = [u.id, u.username, u.dartCounterUsername, u.name, u.displayName, u.email, u.nickname].map(normalizeText);
    return vals.includes(name) || vals.some((v) => v && name.includes(v));
  });
  return user?.id ? String(user.id) : "";
};

const isLeagueResult = (r) => {
  if (r.score1 === undefined || r.score2 === undefined) return false;
  const gt = normalizeText(r.gameType);
  const nonLeague = ["super league", "champions league", "cup", "friendly", "playoff", "tournament", "friendly league", "open league"];
  if (nonLeague.some((t) => gt.includes(t))) return false;
  if (r.cupId || r.matchId || r.tournamentId) return false;
  if (gt.includes("league")) return true;
  if (!gt || gt === "unknown" || gt === "") {
    const s1 = Number(r.score1) || 0;
    const s2 = Number(r.score2) || 0;
    return s1 + s2 <= 8 && s1 + s2 > 0;
  }
  return false;
};

async function main() {
  const email = process.argv[2];
  const password = await readPassword();
  const app = initializeApp(firebaseConfig, "pair-check");
  const auth = getAuth(app);
  try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { console.error("Sign-in failed:", e.message); process.exit(1); }
  const db = getFirestore(app);

  const usersSnap = await getDocs(collection(db, "users"));
  const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  for (const season of ["Season 1", "Season 2", "Season 3"]) {
    const resSnap = await getDocs(
      query(collection(db, "results"), where("season", "==", season), where("status", "==", "approved"))
    );
    const allRes = resSnap.docs.map((d) => d.data());

    // Division from results (same first-wins rule as Table.jsx)
    const resultDivisionMap = {};
    allRes.forEach((r) => {
      const div = typeof r.division === "string" && r.division.trim() ? r.division.trim() : null;
      if (!div || String(div).toLowerCase() === "unassigned") return;
      [1, 2].forEach((n) => {
        const pid = getResultPlayerId(r, n, allUsers);
        if (pid && !resultDivisionMap[String(pid)]) resultDivisionMap[String(pid)] = div;
      });
    });

    // divisionFilteredResults replica
    let kept = 0;
    let droppedDivMismatch = 0;
    let droppedUnassigned = 0;
    const byDiv = {};
    allRes.forEach((r) => {
      if (!isLeagueResult(r)) return;
      const p1 = getResultPlayerId(r, 1, allUsers);
      const p2 = getResultPlayerId(r, 2, allUsers);
      if (!p1 || !p2) return;
      const d1 = resultDivisionMap[String(p1)];
      const d2 = resultDivisionMap[String(p2)];
      const bad = (v) => !v || v === "Unassigned" || v === "Admin";
      if (bad(d1) || bad(d2)) { droppedUnassigned++; return; }
      if (d1 !== d2) { droppedDivMismatch++; return; }
      kept++;
      byDiv[d1] = byDiv[d1] || { matches: 0, players: new Set() };
      byDiv[d1].matches++;
      byDiv[d1].players.add(String(p1));
      byDiv[d1].players.add(String(p2));
    });

    console.log(`\n=== ${season} ===`);
    console.log(`league matches keepable: ${kept + droppedDivMismatch + droppedUnassigned}`);
    console.log(`  kept (same division): ${kept}`);
    console.log(`  dropped (division mismatch): ${droppedDivMismatch}`);
    console.log(`  dropped (unassigned/admin): ${droppedUnassigned}`);
    Object.entries(byDiv).sort((a, b) => b[1].matches - a[1].matches).forEach(([d, v]) => {
      console.log(`  ${d.padEnd(10)} matches=${v.matches} players=${v.players.size}`);
    });
  }

  await auth.signOut();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });