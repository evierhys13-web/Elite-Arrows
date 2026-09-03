/* One-off admin script: add a second group-stage match for every pairing in
 * Jedi/Padawan cups, so each player plays everyone in their group twice.
 *
 * New cups already generate two round-robins. This fixes cups that were created
 * before that change ("The Padawan Division", "The Jedi Division", etc.).
 *
 * Run with:
 *   node scripts/fix-jedi-padawan-groups.js your.admin.email@example.com
 *
 * You will be prompted for your admin account password (used to sign in to
 * Firebase so the update is performed with your admin permissions).
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  updateDoc,
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

const isJediOrPadawan = (name) =>
  String(name || "").toLowerCase().includes("jedi") ||
  String(name || "").toLowerCase().includes("padawan");

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/fix-jedi-padawan-groups.js <admin-email>");
    process.exit(1);
  }

  const password = await readPassword("Admin password: ");
  const app = initializeApp(firebaseConfig, "group-fix");
  const auth = getAuth(app);
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    console.error("Sign-in failed:", e.message);
    process.exit(1);
  }

  const db = getFirestore(app);
  const cupsSnap = await getDocs(collection(db, "cups"));
  const cups = cupsSnap.docs.map((d) => ({ ref: d.ref, ...d.data() }));

  const targets = cups.filter((c) => isJediOrPadawan(c.name));
  console.log(`Found ${targets.length} Jedi/Padawan cup(s):`);
  targets.forEach((c) => console.log(`  - ${c.name}`));

  let totalAdded = 0;

  for (const cup of targets) {
    const matches = Array.isArray(cup.matches) ? cup.matches : [];
    const groups = Array.isArray(cup.groups) ? cup.groups : [];
    const newMatches = [...matches];

    const groupById = {};
    groups.forEach((g) => {
      groupById[String(g.id)] = g;
    });

    // Track which (group, pairing) already have a second-round match.
    const hasSecond = new Set();
    matches.forEach((m) => {
      if (m.stage === "groups" && m.iteration && Number(m.iteration) >= 2) {
        hasSecond.add(
          `${String(m.group)}|${[String(m.player1), String(m.player2)].sort().join("|")}`,
        );
      }
    });

    const addedForCup = [];
    matches.forEach((m) => {
      if (m.stage !== "groups" || Number(m.iteration) >= 2) return;
      if (!m.player1 || !m.player2) return;
      const gId = String(m.group);
      const key = `${gId}|${[String(m.player1), String(m.player2)].sort().join("|")}`;
      if (hasSecond.has(key)) return;
      hasSecond.add(key);

      // Build a second-round match sharing the same pairing + group.
      const groupPlayers = (groupById[gId]?.players || []).map((p) => String(p));
      const i1 = groupPlayers.indexOf(String(m.player1));
      const i2 = groupPlayers.indexOf(String(m.player2));
      const j = Math.min(i1, i2);
      const k = Math.max(i1, i2);
      const newId = `g_${gId}_2_${j}_${k}`;
      const clone = {
        ...m,
        id: newId,
        iteration: 2,
        winner: null,
        score1: null,
        score2: null,
        resultId: null,
      };
      newMatches.push(clone);
      addedForCup.push(`${gId}: ${m.player1} vs ${m.player2} -> ${newId}`);
    });

    if (addedForCup.length > 0) {
      await updateDoc(cup.ref, { matches: newMatches });
      totalAdded += addedForCup.length;
      console.log(`\nUpdated "${cup.name}" - added ${addedForCup.length} second-round group match(es):`);
      addedForCup.forEach((a) => console.log(`   + ${a}`));
    } else {
      console.log(`\n"${cup.name}" already has 2 matches per group pairing. No changes.`);
    }
  }

  console.log(`\nDone. Added ${totalAdded} second-round group match(es).`);
  await auth.signOut();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});