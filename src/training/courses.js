export const COURSES = [
  {
    id: 'foundation',
    title: 'Build a Repeatable Throw',
    tagline: 'Master your grip, stance and action so every dart leaves your hand the same way.',
    icon: '🎯',
    level: 'Beginner + Intermediate',
    color: '#4da8da',
    description: 'A consistent throw is the bedrock of a higher average. This course walks through the four checkpoints — stance, grip, release and follow-through — using the professional principles that underpin every top player.',
    lessons: [
      {
        id: 'your-throw-is-personal',
        title: 'Your Throw Is Personal',
        minutes: 6,
        coachId: 'mardle',
        summary: "Comfort and relaxation come first. Don't copy a pro's action — find the rhythm that your body can repeat.",
        sections: [
          {
            heading: 'Find your own comfort zone',
            paragraphs: [
              "Wayne Mardle, who has coached tour players for years, makes one point before anything else: \"You want a stance that is comfortable for you.\" He admits Phil Taylor's throw was never comfortable for him — but it was for Phil. The lesson is simple: what works for one body rarely transfers to another.",
              "Your job is not to imitate a professional. It is to find the setup — stance, grip, arm position — that feels natural and that you can copy throw after throw."
            ]
          },
          {
            heading: "Refine, don't reinvent",
            paragraphs: [
              "Mardle's coaching method is refinement, not reconstruction. Even the world's best players carry small technical 'flaws'. The difference is that their natural ability lets them repeat those actions consistently.",
              "Instead of tearing your throw apart, look for one small adjustment with the biggest payoff — a slight pause in the action, a simpler grip, a follow-through with more conviction."
            ]
          },
          {
            heading: 'Rhythm is the hardest thing to coach',
            paragraphs: [
              "Asked what is hardest to coach, Mardle doesn't say grip, stance or follow-through. He says rhythm. Every successful player has a natural fluency, however unconventional it looks — from Dennis Priestley's measured approach to Justin Pipe's famously deliberate routine.",
              "The goal is a routine that feels repeatable under pressure. 'Whilst it has to be natural, if it's not, you are swimming against the tide.'"
            ]
          }
        ],
        keyPoints: [
          'Comfort beats imitation — never copy a pro blindly',
          'Make one small, high-impact adjustment at a time',
          'Rhythm is the hardest thing to coach and the most valuable to build',
          "Identify mistakes by feel, not just by where darts land"
        ],
        sources: ["Mardle's Masterclass / Club 501", 'Darts World: Can Wayne Mardle Fix You?', 'Winmau Darts coaching series']
      },
      {
        id: 'stable-stance',
        title: 'Build a Stable Stance',
        minutes: 8,
        coachId: 'mardle',
        summary: 'Your feet and body are the platform. If the platform wobbles, the dart is already lost.',
        sections: [
          {
            heading: 'The stance is your foundation',
            paragraphs: [
              "Your arm might be great, but if your body shifts between throws it can't deliver the dart to the same place twice. Every top player shares one trait: they stay incredibly still. Only the throwing arm moves.",
              "Mardle's emphasis on comfort applies here too — an uncomfortable stance creates tension, and tension kills accuracy."
            ]
          },
          {
            heading: 'Set it once, set it every time',
            paragraphs: [
              "Place your lead foot on the same spot at the oche every visit. Use a mark — a tile line, a scuff, a piece of tape. This is your reference point.",
              "Put most of your weight on the front foot (around 60-75%). Your back foot stays planted for balance. Both feet stay locked; no rocking, bouncing or stepping.",
              "Align everything above the feet too: consistent hip angle, consistent shoulder line. When hips and shoulders point the same way every visit, the arm can repeat naturally. When only the feet are consistent, the arm starts compensating mid-throw."
            ]
          },
          {
            heading: 'The eyes-closed test',
            paragraphs: [
              "Stand at the oche in your normal throwing position and close your eyes for five seconds. Open them. If you swayed, shifted weight or moved your feet, your stance isn't stable enough.",
              "A solid stance should feel locked in place even without visual reference. Repeat until you can hold perfectly still for a full five-count."
            ]
          }
        ],
        keyPoints: [
          'Same foot position every visit — use a floor mark',
          '60-75% of weight on the front foot',
          'Align feet, hips and shoulders on the same target line',
          'Hold the eyes-closed test for five seconds'
        ],
        sources: ['Mardle\'s Masterclass', 'Published coaching guides on stance stability']
      },
      {
        id: 'grip',
        title: 'The Grip That Fits You',
        minutes: 7,
        coachId: 'academy',
        summary: 'Firm enough to control the dart, loose enough that it leaves your fingers cleanly.',
        sections: [
          {
            heading: 'Pressure that works',
            paragraphs: [
              "Your grip connects your hand to the dart. Grip too tightly and you tense your whole chain — hand, forearm, shoulder — and the dart loses accuracy. Grip too loosely and the dart slips early and flies high.",
              "A useful test: someone should be able to pull the dart from your fingers with a gentle tug. White knuckles mean a death grip and bad darts."
            ]
          },
          {
            heading: 'How many fingers?',
            paragraphs: [
              "Three fingers (thumb, index, middle) is the most common and gives the cleanest release. Four fingers add stability on longer barrels. There is no single correct answer — the right number depends on your barrel length and what feels natural.",
              "Your thumb sits underneath as the support; your index finger on top guides the dart. Keep the pinky away from the barrel."
            ]
          },
          {
            heading: 'Hold the balance point',
            paragraphs: [
              "Hold the dart at or near its centre of gravity — the point where it balances level on your fingertip. Too far forward and the dart drops nose-up; too far back and it dives.",
              "Test it: extend your arm and look at the dart. If the point tilts down, your grip is too far back. If it tilts up, too far forward. The barrel should sit level or slightly nose-up.",
              "Grip consistency also helps: place your thumb on the same groove or ring every throw. A knurled or ring-grip barrel gives your fingers a reliable reference point."
            ]
          }
        ],
        keyPoints: [
          'Firm but relaxed — the gentle-tug test',
          'Start with three fingers; add a fourth only if it feels better',
          'Grip at the balance point of the barrel',
          'Same grip position every throw'
        ],
        sources: ['Published coaching guides on grip mechanics', 'Academy curriculum review']
      },
      {
        id: 'smooth-effortless-throw',
        title: 'A Smooth, Effortless Throw',
        minutes: 8,
        coachId: 'taylor',
        summary: "Phil Taylor on throwing like you're cutting a knife through butter — effortlessness over power.",
        sections: [
          {
            heading: "Don't try to hit it harder",
            paragraphs: [
              "Phil Taylor's most counterintuitive advice: overexertion is a mistake. \"It's like hitting a golf ball — if you try to hit it too hard, the ball won't do what you want.\"",
              "The dartboard is only 7 feet 9 inches away. Power is never the problem. Tension is. A smooth, controlled throw beats a fast, jerky one every single time."
            ]
          },
          {
            heading: "Throw like you're cutting a knife through butter",
            paragraphs: [
              "Taylor's favourite mental image: the throw should feel easy, effortless — like drawing a knife smoothly through butter. You are not 'throwing' the dart at the board; you are guiding it there on a relaxed, continuous motion.",
              "Let the forearm and wrist do the work while the elbow stays still as a hinge. Nothing should be forced."
            ]
          },
          {
            heading: 'Finish through the target',
            paragraphs: [
              "Follow-through matters enormously. After releasing the dart, let your arm extend naturally toward the target and hold it there for a moment. Your hand should finish pointing where you aimed.",
              "A clean follow-through eliminates wobble and ensures the dart travels true. If your arm pulls back early or sways sideways, that's a follow-through breakdown — and a bad visit.",
              "Testing it: throw and freeze. Is your index finger pointing at your target? Is your hand above the line between your eye and the target? If not, reset the motion."
            ]
          }
        ],
        keyPoints: [
          'Power is never the goal — smoothness is',
          "Think: knife through butter, not a hammer",
          'Elbow as a still hinge; forearm and wrist supply the motion',
          'Hold a full follow-through pointing at the target'
        ],
        sources: ['Phil Taylor coaching piece (Modus Super Series, 2025)']
      },
      {
        id: 'muscle-memory',
        title: 'Repeatability Before Perfection',
        minutes: 7,
        coachId: 'taylor',
        summary: "Taylor's core rule: throw your darts in exactly the same way every time, until it runs on autopilot.",
        sections: [
          {
            heading: 'Same throw, every time',
            paragraphs: [
              "\"The most important thing is to throw your darts in exactly the same way every time,\" says Phil Taylor. \"That has to happen on autopilot. Your brain should be so used to the movement that you're not even thinking about it.\"",
              "This is the single principle everything else serves. Stance, grip, rhythm, follow-through — all designed so the throw can repeat."
            ]
          },
          {
            heading: 'Build muscle memory through repetition',
            paragraphs: [
              "Muscle memory develops through deliberate repetition and removes doubt. Taylor compared it to driving a car — the instinct is so embedded that you don't think about each movement.",
              "\"You practice so much that your muscles know where they're supposed to be. Sometimes I'd lift my arm and it would move itself into the right position. That's how you know it's locked in.\"",
              "The accent here is deliberate: repetition with a fixed target and a fixed routine, not aimless throwing."
            ]
          },
          {
            heading: 'A routine to anchor it',
            paragraphs: [
              "Every throw should follow the same sequence: step to the oche, place your feet, pick up the dart with the same grip, raise your arm, pause, pull back, throw, follow through.",
              "The specific steps matter less than doing them in the same order at the same speed every time. If you feel like you're hurrying, slow down. If you're overthinking, speed up. Find the rhythm you can repeat."
            ]
          }
        ],
        keyPoints: [
          'Same action in the same order — every dart',
          'Repetition builds instinct; instinct removes doubt',
          'Make the routine so strong it runs without thinking',
          'Beat hurrying by slowing down, not forcing pace'
        ],
        sources: ['Phil Taylor coaching piece (Modus Super Series, 2025)']
      }
    ]
  },
  {
    id: 'scoring',
    title: 'Lift Your 3-Dart Average',
    tagline: 'Stop leaking points to bad darts and build a scoring game that holds under pressure.',
    icon: '📈',
    level: 'All Levels',
    color: '#22c55e',
    description: 'Your average is built in the scoring visits. This course teaches the counter-intuitive truth about averages — reducing bad darts lifts your number more than hitting extra trebles — and gives you a proven scoring session.',
    lessons: [
      {
        id: 'reduce-bad-darts',
        title: 'Reduce Bad Darts, Not Just Hit Trebles',
        minutes: 8,
        coachId: 'academy',
        summary: "More trebles add points, but eliminating disasters saves more. One 26 ruins a visit; three ugly darts leak a leg.",
        sections: [
          {
            heading: 'The math that changes how you practice',
            paragraphs: [
              "Here is the counter-intuitive truth at the heart of scoring well: adding one treble a visit nets you roughly 40 points a leg. Cleaning up three bad darts a leg saves you 45-57 points. Reducing bad darts is worth more than chasing trebles.",
              "That's why a 45-average player becomes a 65-average player not by suddenly hitting T20 like a pro, but by stopping the visits that score 26 and 41 — the 5, 1, 20 and the scattered misses."
            ]
          },
          {
            heading: 'What counts as a bad dart?',
            paragraphs: [
              "Throwing at 20s, your target is the whole 20 segment. A single 20 is a neutral result. A 5 or 1 is a miss that costs you — 26 (5, 1, 20) is the most expensive kind of visit because it looks like a scoring visit but bleeds points.",
              "Your first goal in training is to keep every dart inside the segment you're aiming at. Singles, doubled — it doesn't matter. Group them, then work up to the treble."
            ]
          },
          {
            heading: 'Grouping beats the occasional hero dart',
            paragraphs: [
              "Three darts in the 20 bed, even all singles, is better than one treble and two scattered misses. The world's best scorers group so tightly that even their misses stay in the single 20.",
              "Practice the T20 Volume and Big 20s sessions in this course until your misses are good misses."
            ]
          }
        ],
        keyPoints: [
          'One treble a visit adds ~40 points/leg; three clean bad darts save 45-57',
          'Keep darts in your target segment before chasing trebles',
          'A 26 that starts in the 5 is the most expensive visit to leak',
          'Grouping is the skill that raises averages'
        ],
        sources: ['Shot Darts / Practise & Play coaching article', 'Published coaching guides on scoring practice']
      },
      {
        id: 'the-scoring-session',
        title: 'The 30-Minute Scoring Session',
        minutes: 10,
        coachId: 'academy',
        summary: 'A structured scoring routine proven to build treble-hitting volume and consistency.',
        sections: [
          {
            heading: 'Block 1 — Five minutes warming up (not optional)',
            paragraphs: [
              "Most players skip the warm-up and go straight to T20. That's a mistake. The first five minutes set the tone for the whole session.",
              "Run a round-the-clock progression (1-20 and bull) to activate your shoulder, elbow and wrist through the full range of motion. Your first dart of a session should never be a treble 20 attempt."
            ]
          },
          {
            heading: 'Block 2 — T20 Volume (40 darts)',
            paragraphs: [
              "Throw 40 darts at treble 20. Count your trebles and nothing else. A single 20 is neutral. A 5 or 1 is a miss. A treble is a win.",
              "The goal isn't to hit every treble — it's volume at your primary scoring target until hitting T20 feels automatic. Beginners hit 1-3 trebles in 40 darts; intermediate players 4-7; advanced 8-12; professionals 15+.",
              "Track your treble percentage, not your score. If you hit 5 of 40, that's 12.5%. Write it down and beat it next session."
            ]
          },
          {
            heading: 'Block 3 — Big 20s (10 rounds)',
            paragraphs: [
              "Ten rounds where every dart goes at the 20 segment. Score each round and track the total. Unlike T20 Volume, every dart that stays in the 20 bed counts — singles, doubles and trebles.",
              "This drills grouping, not glory. A good target for intermediate players is 400+ across 10 rounds (average 40+ per visit). Advanced players should aim for 500+ — meaning most visits contain at least one treble."
            ]
          },
          {
            heading: 'When to progress',
            paragraphs: [
              "Once you're hitting 6+ trebles in a T20 Volume session, alternate between T20 and T19 between visits to build adaptability. Then add pressure: give yourself three visits to score 300, or restart. That trains clutch scoring.",
              "Run this routine 3-4 times a week on scoring days, alternating with doubles/checkout sessions on other days. If you only have time for one routine, this is the one that raises your average fastest."
            ]
          }
        ],
        keyPoints: [
          'Warm up with round-the-clock first — never open on T20',
          'T20 Volume: 40 darts, count only trebles, log your %',
          'Big 20s: 10 rounds, score every dart that stays in the 20',
          'Progress by alternating T20/T19, then adding score-or-restart pressure'
        ],
        sources: ['Published 30-minute scoring routine (DartsVA)', 'Shot Darts / Practise & Play coaching article']
      },
      {
        id: 'the-100s-game',
        title: 'The 100s Game — Hold Your Floor',
        minutes: 8,
        coachId: 'academy',
        summary: 'Score 100+ for eight consecutive rounds. When a bad first dart lands, the 100s Game teaches you to recover.',
        sections: [
          {
            heading: 'The rules',
            paragraphs: [
              "Score 100 or more with three darts for eight consecutive rounds. If you score under 100, that visit doesn't count — restart the run.",
              "A visit of 100 requires at least one treble plus two decent singles (for example T20 + 20 + 20). The discipline is what matters: if your first dart misses the treble, you still need 100 from your remaining two darts."
            ]
          },
          {
            heading: 'The skill it builds: recovery',
            paragraphs: [
              "This is the single most important skill in scoring darts: the ability to salvage a visit after a bad first dart. If you can consistently score 100+ when your first dart lands in the 5, your average jumps dramatically.",
              "The best scorers don't chase a missed treble. They reset, breathe, and throw the next dart with the same routine. A stray single 5 is fine; a rushed second dart that misses everything is not."
            ]
          },
          {
            heading: 'The pause is discipline, not weakness',
            paragraphs: [
              "When your first dart lands in the 1 or 5, pause. Step off the oche if you need to. Come back and throw the next dart with intent.",
              "This pause trains the exact behaviour you need in a real leg. The players who spiral after a 26 are the ones who rush the next visit to 'make up for it' — and breed another bad visit."
            ]
          }
        ],
        keyPoints: [
          'Eight consecutive 100+ visits, restart on any score under 100',
          'Practise rescuing a visit after a bad first dart',
          'Step off the oche, breathe, then throw with intent',
          'The pause is discipline — never rush a recovery visit'
        ],
        sources: ['Published 30-minute scoring routine (DartsVA)']
      },
      {
        id: 'equipment-weight',
        title: 'Find Your Weight, Find Your Line',
        minutes: 6,
        coachId: 'taylor',
        summary: 'Phil Taylor on choosing the dart weight that suits your throw — comfort and control over fashion.',
        sections: [
          {
            heading: "There's no universal rule",
            paragraphs: [
              "Taylor is clear on equipment: \"It's all about finding the dart and the weight that suits you. Some players throw better with heavier darts, some with lighter ones. It's about what feels right and gives you confidence.\"",
              "Copying the weight a professional uses is a mistake. Copying a dart setup is copying the wrong thing — your throw is your own."
            ]
          },
          {
            heading: 'The simple weight experiment',
            paragraphs: [
              "If your darts keep dropping below the treble, try a heavier set. If they drop even more, go lighter.",
              "Taylor's own example: throwing 22 grams and dropping low, try 23; if that drops, go to 21. Small changes in weight change your trajectory — and your grouping.",
              "Spend a week with each weight before judging it. Note your treble count and average across sessions, not in one night."
            ]
          },
          {
            heading: 'Comfort and control decide',
            paragraphs: [
              "The right equipment is whatever you can repeat without thinking. A dart that feels wrong in your hand will be thrown tensely, and tension is the enemy of every principle in this course.",
              "When you find a weight and barrel that groups, lock the setup in and stop experimenting mid-season."
            ]
          }
        ],
        keyPoints: [
          'Weight is personal — comfort and control beat copying pros',
          'Experiment one weight at a time, judge over a week',
          'Dropping low? Try heavier. Dropping lower still? Go lighter',
          'Lock in a setup that groups and stop changing it'
        ],
        sources: ['Phil Taylor coaching piece (Modus Super Series, 2025)']
      }
    ]
  },
  {
    id: 'finishing',
    title: 'Finishing — Win Legs at the Double',
    tagline: 'Checkouts decide matches. Learn the routes, the alternatives and how to see the board.',
    icon: '🔥',
    level: 'All Levels',
    color: '#f97316',
    description: 'A player who averages 55 but hits 40% of doubles beats someone averaging 65 who hits 25%. This course uses Wayne Mardle\'s proven board-on-the-lap method and structured doubles games to turn your finishing into a weapon.',
    lessons: [
      {
        id: 'board-on-lap',
        title: 'Mardle\'s Board-on-the-Lap Method',
        minutes: 9,
        coachId: 'mardle',
        summary: "One of Mardle's favourite ways to improve finishing doesn't involve throwing a single dart.",
        sections: [
          {
            heading: 'The setup',
            paragraphs: [
              "Get a spare board, or take the board off the wall. Put it on your lap, sit somewhere comfortable, and go through every finish from 2 to 170 — physically placing your three darts into the board instead of throwing them.",
              "You're not practising your throw. You're practising your recognition of the board — where each route goes and what every miss leaves."
            ]
          },
          {
            heading: 'Play the scenarios visually',
            paragraphs: [
              "Say you're on 93. The conventional route is 57 for 36. But if you hit 19, you're on 74 — 42 for 32. Mardle's point: \"When you're doing it with the darts in your hand, you're seeing it visually and you're learning so much quicker.\"",
              "Work through what happens after every first dart, not just the perfect one: treble 7 leaves 72 — do you go double 18, double 18, or next door for 48, or 60, or 36?"
            ]
          },
          {
            heading: 'You\'re learning where you want to miss',
            paragraphs: [
              "\"Yes, you're not practising, but you're learning about you and the board. You're actually learning about where you want to miss,\" says Mardle. \"I'm the biggest advocate of this in the world.\"",
              "Know the standard route, yes — but more importantly, understand the alternatives when things don't go to plan. That's what wins legs."
            ]
          }
        ],
        keyPoints: [
          'Physically place darts in the board for finishes 2-170',
          'Practise every scenario: perfect first dart and the misses',
          'Learning where you want to miss is learning the board',
          'Do it while watching TV — it builds recognition without throwing'
        ],
        sources: ['Wayne Mardle / Winmau Darts coaching video']
      },
      {
        id: 'flexible-routes',
        title: 'Flexible Checkout Routes',
        minutes: 8,
        coachId: 'mardle',
        summary: 'Choose the route that keeps options alive if the first dart goes astray.',
        sections: [
          {
            heading: '104 — the Mardle example',
            paragraphs: [
              "Wayne Mardle, echoing Michael van Gerwen: \"104, there's only one right way, and that's 48. If you do not go that way, you're not giving yourself options.\"",
              "48 off 104 leaves 56. From there you may choose tops (20, 36, 16) or even two 48s — the checkout stays alive however you proceed.",
              "Start on 20s instead and a wayward first dart can kill the visit: \"104 on 20s, can't hit that, can't hit that, you're in trouble.\""
            ]
          },
          {
            heading: 'Why the flexible route wins',
            paragraphs: [
              "A checkout is not a single path — it's a decision tree. The best route is the one that leaves the most doubles reachable after a miss.",
              "This is the core of Mardle's coaching: rejecting a route because it looks conventional when a route that survives a bad dart exists keeps the leg alive.",
              "Lay out the common checkouts below 100 and learn two routes for each: the standard one and the escape route."
            ]
          },
          {
            heading: 'Drill it without throwing',
            paragraphs: [
              "Back to the board-on-the-lap method for this: if you're on 93 and hit treble 7, what now? If you're on 61 and hit 13, what does the 48 leave?",
              "Play these scenarios every night. When the same situations appear in a match, you'll already know the answer — without thinking."
            ]
          }
        ],
        keyPoints: [
          '104: start on 48 — it leaves 56 and keeps all routes alive',
          'Learn a decision tree for every checkout, not one path',
          'Prefer the route that survives a bad first dart',
          'Rehearse scenarios on the lap board until they are automatic'
        ],
        sources: ['Wayne Mardle / Winmau Darts coaching video']
      },
      {
        id: 'doubles-under-pressure',
        title: 'Doubles Under Pressure',
        minutes: 9,
        coachId: 'academy',
        summary: "Structured doubles games — including the proven 'score to earn your double' format.",
        sections: [
          {
            heading: 'Find your line on doubles first',
            paragraphs: [
              "The 6-8-4-2 game: find the line your body naturally throws on each double and work from there. Start on your strongest doubles and build confidence in your positioning before adding difficulty.",
              "Keep the routine simple. Add no variables that have nothing to do with confidence and a controlled line. You are finding where your body feels strong — most doubles players stand on a natural line that makes the dart arrive flat and straight."
            ]
          },
          {
            heading: 'Game 3 — score to earn your double',
            paragraphs: [
              "The highest-value doubles game: go around the board hitting each double once, but you must score 60 or more with your first or second dart to earn a shot at the double you're on. Score under 60 and the visit is just scoring.",
              "This adds the two things practice usually lacks: pressure and movement. You're not just doubling — you're scoring, then finishing under a self-imposed pressure that mirrors match conditions.",
              "Most coaches recommend staying within ranks 1-3 of doubles for this game at the start, only extending to the hard doubles (11, 12, 15, 16) once the rest feel automatic."
            ]
          },
          {
            heading: 'Schedule it like a plan',
            paragraphs: [
              "Practise doubles at least twice a week when you have time to work through your lines. Play the full score-to-earn game at least once a week — many players run it daily in the two weeks before a tournament.",
              "The moment to start finishing practice in every session: when you can comfortably score, your average is only half the story."
            ]
          }
        ],
        keyPoints: [
          'Find your natural doubles line with the 6-8-4-2 game',
          'Score 60+ with your first two darts to earn shots at doubles',
          'Around-the-board doubles adds pressure and movement',
          'Doubles practice twice weekly; score-to-earn game at least once a week'
        ],
        sources: ['Shot Darts / Practise & Play coaching article']
      }
    ]
  },
  {
    id: 'mindset',
    title: 'Mindset & Match Routine',
    tagline: 'Routine, breathing and process — the mental game that protects your average when it matters.',
    icon: '🧠',
    level: 'All Levels',
    color: '#a78bfa',
    description: 'Distractions and pressure are everywhere. This course builds the routine that keeps your body calm and your mind on the process — not on the numbers.',
    lessons: [
      {
        id: 'pre-throw-routine',
        title: 'Build a Pre-Throw Routine',
        minutes: 7,
        coachId: 'pipe',
        summary: 'A repeatable sequence before every dart anchors your focus and keeps you on autopilot.',
        sections: [
          {
            heading: 'Same routine, every dart',
            paragraphs: [
              "Justin Pipe is one of the most consistent routines on tour — and deliberate about it. The value of a routine is not the specific steps; it's that the same sequence happens before every dart, drowning out distraction.",
              "A simple anchor: lock your eyes on the target, set your stance, take a breath, bring the dart up smoothly, pause, throw."
            ]
          },
          {
            heading: 'Mental triggers',
            paragraphs: [
              "Elite players use small mental triggers to signal 'time to focus': a deep breath, a phrase like 'smooth', tapping the dart, setting the feet deliberately, pausing before release.",
              "Pick one cue you repeat before every throw. Over time it becomes a switch that turns competing noise off and the process on."
            ]
          },
          {
            heading: 'Practise with intent',
            paragraphs: [
              "Pipe's guidance: practice should be enjoyable, not a chore. The moment you're just going through the motions, you've stopped improving. Every session — even five minutes — should have a purpose.",
              "Your pre-throw routine should be identical in practice and in matches. If you skip it in practice, it won't exist under pressure."
            ]
          }
        ],
        keyPoints: [
          'Same routine before every dart, in practice and matches',
          'Use a mental trigger — breath, phrase, tap, pause',
          'Practise with intent; stop when you are just going through the motions',
          'Routine is what survives pressure'
        ],
        sources: ['Justin Pipe guidance via Darts Aim', 'Published coaching guides on pre-throw routines']
      },
      {
        id: 'breathe',
        title: 'Breathe Before You Throw',
        minutes: 6,
        coachId: 'academy',
        summary: "Under pressure players tense up and breathe shallowly in the chest. Diaphragmatic breathing is the fix.",
        sections: [
          {
            heading: 'Why breathing matters',
            paragraphs: [
              "Under pressure, players tense, breathe shallowly from the chest, and feel the shoulders rise. That tension travels straight into the throwing arm and ruins the release.",
              "Diaphragmatic (belly) breathing does the opposite: it keeps the body relaxed, the shoulders down and the arm free — exactly what your mechanics need."
            ]
          },
          {
            heading: 'A five-second routine',
            paragraphs: [
              "Before stepping into the throw: breathe slowly through your nose, let your stomach expand naturally, exhale slowly, and as you do, relax your shoulders and soften your grip.",
              "That's it. A few seconds that dramatically improve composure — especially on doubles."
            ]
          },
          {
            heading: 'Breathe on the doubles, not at them',
            paragraphs: [
              "The slow exhale is the anchor. It steadies the arm and times the throw. Many professionals deliberately build breathing into their routine so the release happens naturally on the exhale.",
              "If your heart rate spikes on a finishing double, that's the signal to slow the breath — not to speed up the dart."
            ]
          }
        ],
        keyPoints: [
          'Pressure = shallow chest breathing = tension in the arm',
          'Belly-breathe in, exhale slowly, soften the shoulders',
          'Release naturally on the exhale',
          'Use breathing deliberately on doubles'
        ],
        sources: ['Published coaching guides on breathing and composure']
      },
      {
        id: 'stop-chasing-average',
        title: 'Stop Chasing the Average',
        minutes: 7,
        coachId: 'nicholson',
        summary: "Paul Nicholson: the average is a reflection of what you've done, not what you can do.",
        sections: [
          {
            heading: 'The average is a rear-view mirror',
            paragraphs: [
              "Paul Nicholson's advice cuts straight through the noise: don't obsess over averages. Focus on winning matches. \"The average is just a reflection of what you've done, not a reflection of what you can do.\"",
              "Chasing a number makes you throw at the wrong target. Your job each visit is the process — stance, grip, smooth throw, follow-through — and the average looks after itself."
            ]
          },
          {
            heading: 'Process over outcome',
            paragraphs: [
              "You cannot directly control whether the dart hits. You can control whether you execute properly. Every visit, the only question is: did I run my routine?",
              "Players who measure themselves by averages get frustrated by variance — a 55 average night feels like failure even when the mechanics were solid. Players who measure the process improve steadily."
            ]
          },
          {
            heading: 'Set reachable goals',
            paragraphs: [
              "Improvement takes time. A realistic short-term goal (1-3 months) is technique consistency and a 5-point average lift with regular practice. Medium-term (3-12 months), 10-15 points is on the table as muscle memory builds.",
              "Unrealistic targets breed frustration, and frustration is what drags averages back down."
            ]
          }
        ],
        keyPoints: [
          'The average reflects what you did, not what you can do',
          'Control the process, not the outcome',
          'Measure execution per visit, not your number after it',
          'Set realistic goals — 5 points in 1-3 months, 10-15 in a year'
        ],
        sources: ['Paul Nicholson via Darts Aim', 'Published coaching guidance on goal setting']
      },
      {
        id: 'the-bad-visit',
        title: 'How to Handle the Bad Visit',
        minutes: 7,
        coachId: 'academy',
        summary: 'A 26 breeds panic, panic breeds rushed visits, and the spiral begins. Break it before it starts.',
        sections: [
          {
            heading: 'The spiral',
            paragraphs: [
              "A 26 (5, 1, 20) feels bad, so players rush the next visit to make up for it. That breeds more bad visits — rushed throws, no routine, no breath — and by the third visit they're frustrated and throwing recklessly.",
              "This is the most common reason practice sessions (and match legs) spiral. Recognise the pattern and break it before it starts."
            ]
          },
          {
            heading: 'The reset sequence',
            paragraphs: [
              "After a bad visit: step off the oche. Take a breath (belly breathing, not chest). Reset your stance and routine. Then throw the next dart with intent.",
              "The walk back to the oche is a full reset. Never throw the next dart while the anger from the last one is still in your arm."
            ]
          },
          {
            heading: 'Treat every visit as independent',
            paragraphs: [
              "The visit that just happened is gone. Your opponent doesn't care about your last 26 — they care about the next three darts.",
              "In practice, use the pause deliberately. It is discipline, not procrastination. The best scorers recover quickly after a bad dart — that single skill shows up in every average you'll ever read."
            ]
          }
        ],
        keyPoints: [
          'A bad visit triggers rushing — the spiral starts there',
          'Step off, breathe, reset your routine, throw with intent',
          'Every visit is independent — the last one is gone',
          'The pause after a 26 is discipline, not weakness'
        ],
        sources: ['Published coaching guidance on scoring recovery', 'Academy curriculum review']
      }
    ]
  }
]

export const getCourse = (id) => COURSES.find(c => c.id === id)
export const getLesson = (lessonId) => {
  for (const course of COURSES) {
    const lesson = course.lessons.find(l => l.id === lessonId)
    if (lesson) return { ...lesson, course }
  }
  return null
}