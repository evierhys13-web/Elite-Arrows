/* Diagnostic: reproduce Table.jsx standings logic for a season against the live
 * data to see how many results/players actually make it into the standings.
 *
 * Run: node scripts/reproduce-standings.js your.admin.email@example.com
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
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
  if (!email) {
    console.error("Usage: node scripts/reproduce-standings.js <admin-email>");
    process.exit(1);
  }
  const password = await readPassword("Admin password: ");
  const app = initializeApp(firebaseConfig, "repro");
  const auth = getAuth(app);
  try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { console.error("Sign-in failed:", e.message); process.exit(1); }
  const db = getFirestore(app);

  const usersSnap = await getDocs(collection(db, "users"));
  const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  for (const season of process.argv.slice(3) || ["Season 2"]) {
    const resSnap = await getDocs(
      query(collection(db, "results"), where("season", "==", season), where("status", "==", "approved"))
    );
    const allRes = resSnap.docs.map((d) => d.data());

    // Records both players' ids using same mapping as the app
    let canMapBoth = 0;
    let canMapOneMissing = 0;
    const unresolvedNames = new Set();
    const playerDivisions = {};
    const leagueMatches = [];

    allRes.forEach((r) => {
      const p1 = getResultPlayerId(r, 1, allUsers);
      const p2 = getResultPlayerId(r, 2, allUsers);
      if (!p1 || !p2) {
        if (!p1) unresolvedNames.add(r.player1 || `?${r.id}`);
        if (!p2) unresolvedNames.add(r.player2 || `?${r.id}`);
        if (isLeagueResult(r)) canMapOneMissing++;
        return;
      }
      if (isLeagueResult(r)) {
        leagueMatches.push({ r, p1, p2 });
        canMapBoth++;
        const div = typeof r.division === "string" && r.division.trim() && r.division.toLowerCase() !== "unassigned" ? r.division.trim() : null;
        if (div) {
          if (!playerDivisions[p1]) playerDivisions[p1] = div;
          if (!playerDivisions[p2]) playerDivisions[p2] = div;
        }
      }
    });

    const mappedPlayers = new Set();
    leagueMatches.forEach(({ p1, p2 }) => { mappedPlayers.add(p1); mappedPlayers.add(p2); });

    const unassigned = [...mappedPlayers].filter((p) => !playerDivisions[p]);

    console.log(`\n=== ${season} ===`);
    console.log(`approved results: ${allRes.length}`);
    console.log(`league results with both players mapped: ${canMapBoth}`);
    console.log(`league results where >=1 player could NOT be mapped: ${canMapOneMissing}`);
    console.log(`distinct players in mapped results: ${mappedPlayers.size}`);
    console.log(`players WITHOUT a recoverable division: ${unassigned.length}`);
    if (unassigned.length > 0) {
      console.log(`  sample unassigned: ${unassigned.slice(0, 15).join(", ")}`);
    }
    console.log(`unresolved player references (name/id): ${unresolvedNames.size}`);
    [...unresolvedNames].slice(0, 20).forEach((n) => console.log(`   - ${n}`));
  }

  await auth.signOut();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });