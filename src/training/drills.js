export const DRILL_CATEGORIES = {
  scoring: { id: 'scoring', label: 'Scoring', icon: '📈', color: '#22c55e' },
  consistency: { id: 'consistency', label: 'Consistency', icon: '🎯', color: '#4da8da' },
  finishing: { id: 'finishing', label: 'Finishing', icon: '🔥', color: '#f97316' },
  checkouts: { id: 'checkouts', label: 'Board Work', icon: '🧠', color: '#a78bfa' }
}

export const DRILLS = [
  {
    id: 't20-volume',
    name: 'T20 Volume',
    category: 'scoring',
    minutes: 5,
    summary: 'Volume at your primary scoring target until hitting treble 20 feels automatic.',
    howTo: [
      'Throw 40 darts at treble 20.',
      'Count only your trebles. A single 20 is neutral; a 5 or 1 is a miss.',
      'Log your treble percentage: trebles ÷ 40, written down.'
    ],
    targets: { beginner: '1-3 trebles', intermediate: '4-7', advanced: '8-12', professional: '15+' },
    why: 'Builds treble-hitting volume and tracks the metric that predicts scoring — treble percentage, not score.',
    coachRef: 'Grounded in published coaching practice routines'
  },
  {
    id: 'big-20s',
    name: 'Big 20s',
    category: 'consistency',
    minutes: 10,
    summary: 'Ten rounds at the 20 segment — every dart that stays in the 20 bed counts.',
    howTo: [
      'Throw 10 rounds, all three darts at the 20 segment.',
      'Score each round; singles, doubles and trebles all count.',
      'Track your total across the 10 rounds.'
    ],
    targets: { beginner: '350+ total', intermediate: '400+ (avg 40+/visit)', advanced: '500+ (avg 50+/visit)' },
    why: 'This is the grouping drill. Three singles in the 20 beat one treble and two scattered misses.',
    coachRef: 'Published 30-minute scoring routine'
  },
  {
    id: '100s-game',
    name: 'The 100s Game',
    category: 'scoring',
    minutes: 10,
    summary: 'Score 100+ for eight consecutive rounds — the recovery drill.',
    howTo: [
      'Score 100 or more with three darts for eight consecutive rounds.',
      'Any visit under 100 does not count — restart the run.',
      'When your first dart misses badly, pause, step off, breathe, then finish the visit with intent.'
    ],
    targets: { beginner: '3 consecutive 100s', intermediate: '8 consecutive 100s', advanced: '8 consecutive 100s with only treble-openers' },
    why: 'Teaches you to salvage a visit after a bad first dart — the single most average-raising skill there is.',
    coachRef: 'Published 30-minute scoring routine'
  },
  {
    id: 'round-clock',
    name: 'Around the Clock',
    category: 'consistency',
    minutes: 5,
    summary: 'Hit numbers 1 through 20 in order, then finish on bull. Core warm-up and range drill.',
    howTo: [
      'Work through 1-20 in sequence, then finish with the bullseye.',
      'Score a point for a single, more for a treble if tracking.',
      'Run it as a warm-up before any serious session.'
    ],
    targets: { beginner: 'Finish in 90+ darts', intermediate: 'Under 70 darts', advanced: 'Under 55 darts' },
    why: 'Activates the shoulder, elbow and wrist through the full range of motion. Never start a session cold on T20.',
    coachRef: 'Standard professional warm-up, echoed across published routines'
  },
  {
    id: 'doubles-line',
    name: 'Find Your Doubles Line (6-8-4-2)',
    category: 'finishing',
    minutes: 10,
    summary: 'Establish the body line on your key doubles and build confidence in your positioning.',
    howTo: [
      'Work on doubles 6, 8, 4 and 2 first — your most common finishing doubles.',
      'Find the natural line you throw on each and experiment with stance until it feels strong.',
      'Keep the routine simple: no extra variables until confidence is built.'
    ],
    targets: { beginner: '3 of each double', intermediate: '5 of each double', advanced: '8 of each double' },
    why: 'Confidence on the body-line doubles carries into every other double on the board.',
    coachRef: 'Shot Darts coaching article'
  },
  {
    id: 'score-to-earn',
    name: 'Score to Earn Your Double',
    category: 'finishing',
    minutes: 15,
    summary: 'Hit every double from 1 to 20 — but score 60+ first to earn each shot.',
    howTo: [
      'Go around the board on doubles, hitting each once.',
      'You must score 60 or more with your first or second dart to get a shot at the double.',
      'Under 60 and the visit is scoring only. Ranks 1-3 recommended at the start.'
    ],
    targets: { beginner: 'Complete doubles 1-8', intermediate: 'Complete 1-16', advanced: 'Complete 1-20 + bull' },
    why: 'Adds pressure and movement to doubles practice — the two things casual doubles practice lacks.',
    coachRef: 'Shot Darts coaching article (Game 3)'
  },
  {
    id: 'board-on-lap',
    name: 'Board on the Lap',
    category: 'checkouts',
    minutes: 15,
    summary: 'Mardle\'s favourite: work every finish from 2 to 170 with the board on your lap. No throwing required.',
    howTo: [
      'Take the board down, sit it on your lap.',
      'Physically place your three darts through every finish from 2 to 170.',
      'For each, play the scenarios: perfect first dart and every bad miss. Where do you go next?'
    ],
    targets: { beginner: 'Memorise the standard routes', intermediate: 'Know the escape route for every finish under 100', advanced: 'Rehearsed solutions for every miss pattern' },
    why: 'You are learning where you want to miss. Recognition of the board wins more legs than a hot throw.',
    coachRef: 'Wayne Mardle (Winmau Darts)'
  },
  {
    id: 'checkout-scenarios',
    name: 'Checkout Scenarios',
    category: 'checkouts',
    minutes: 10,
    summary: 'Lesson 2 of finishing: flexible routes for 104, 93 and the awkward mid-50s scores.',
    howTo: [
      'Lay out the common checkouts under 100 on the lap board.',
      'For each, learn the standard route AND the route that survives a bad first dart.',
      'Example: 104 starts on 48 (leaves 56). 93 — if you hit 19, you\'re on 74.'
    ],
    targets: { beginner: 'Know the first dart of each checkout 40-100', intermediate: 'Know the second-dart options', advanced: 'Instant recovery from any miss' },
    why: 'Pick the route that keeps options alive — it turns a miss into a repairable visit.',
    coachRef: 'Wayne Mardle (Winmau Darts)'
  },
  {
    id: 'bobs-27',
    name: 'Bob\'s 27',
    category: 'finishing',
    minutes: 10,
    summary: 'The classic doubles test: start on 27, work through every double, add a hit and subtract a miss.',
    howTo: [
      'Start with 27 points.',
      'Beginning at double 1, throw three darts at each double in sequence up to double 20, then bull.',
      'Hit a double: add its value. Miss all three: subtract its value.',
      'A positive finish is respectable; over 100 is excellent.'
    ],
    targets: { beginner: 'Finish positive', intermediate: 'Score 50+', advanced: 'Score 100+' },
    why: 'Pressure-free environment to measure your all-round doubling — essential checkouts practice.',
    coachRef: 'Published coaching guides (Bob\'s 27)'
  },
  {
    id: 'fifteen-dart-legs',
    name: '15-Dart Legs',
    category: 'scoring',
    minutes: 15,
    summary: 'Try to complete a leg of 501 in 15 darts or fewer — simulates match scoring pressure.',
    howTo: [
      'Play short legs of 501 solo.',
      'Track how many darts each leg takes.',
      'A 15-dart leg means averaging 100+ while finishing — scoring and doubling combined.'
    ],
    targets: { beginner: '17-18 darts', intermediate: '15 darts', advanced: '13-14 darts' },
    why: 'Puts scoring and finishing together under self-imposed pressure.',
    coachRef: 'Published coaching guides'
  }
]

export const getDrill = (id) => DRILLS.find(d => d.id === id)
export const getCategory = (id) => DRILL_CATEGORIES[id]