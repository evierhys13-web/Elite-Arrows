/* Diagnostic: break down approved results per historical season by gameType to
 * see which results are excluded from league standings.
 *
 * Run: node scripts/gametype-breakdown.js your.admin.email@example.com
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

const readPassword = (query) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => { rl.question(query, (answer) => { rl.close(); resolve(answer); }); });
};

const normalizeText = (v) => String(v || "").trim().toLowerCase();

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
  if (!email) { console.error("Usage: node scripts/gametype-breakdown.js <admin-email>"); process.exit(1); }
  const password = await readPassword("Admin password: ");
  const app = initializeApp(firebaseConfig, "gt-breakdown");
  const auth = getAuth(app);
  try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { console.error("Sign-in failed:", e.message); process.exit(1); }
  const db = getFirestore(app);

  for (const season of ["Season 1", "Season 2", "Season 3"]) {
    const resSnap = await getDocs(
      query(collection(db, "results"), where("season", "==", season), where("status", "==", "approved"))
    );
    const allRes = resSnap.docs.map((d) => d.data());
    const byType = {};
    const byProps = {};
    allRes.forEach((r) => {
      const gt = normalizeText(r.gameType);
      const key = gt || "(empty)";
      if (!byType[key]) byType[key] = 0;
      byType[key]++;
      const isLeague = isLeagueResult(r);
      const props = [
        gt.includes("league") ? "L" : "-",
        (r.cupId || r.matchId || r.tournamentId) ? "CUP" : "-",
        (r.score1 === undefined || r.score2 === undefined) ? "NOSCORE" : "-",
        isLeague ? "IN" : "OUT",
      ].filter(Boolean).join("|");
      const propKey = `${key} | ${props}`;
      if (!byProps[propKey]) byProps[propKey] = 0;
      byProps[propKey]++;
    });

    console.log(`\n=== ${season} (${allRes.length} approved) ===`);
    Object.entries(byProps)
      .sort((a, b) => b[1] - a[1])
      .forEach(([k, n]) => console.log(`  ${n.toString().padStart(4)}  ${k}`));
  }

  await auth.signOut();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });