export const TIPS = [
  {
    id: 'tip-1',
    coachId: 'taylor',
    category: 'consistency',
    title: 'Throw it the same way, every time',
    body: "\"The most important thing is to throw your darts in exactly the same way every time,\" says Phil Taylor. \"That has to happen on autopilot — your brain should be so used to the movement that you're not even thinking about it.\"",
    actionStep: 'Film yourself for 10 throws. Now repeat your routine 30 times. The goal is throws that look identical on tape.'
  },
  {
    id: 'tip-2',
    coachId: 'taylor',
    category: 'consistency',
    title: 'Effortless beats powerful',
    body: "\"It's like hitting a golf ball — if you try to hit it too hard, the ball won't do what you want. It's all about following through. Throw like you're cutting a knife through butter.\" — Phil Taylor",
    actionStep: 'Next session, throw one full round at 70% effort and compare the grouping to 100%. The scores will surprise you.'
  },
  {
    id: 'tip-3',
    coachId: 'taylor',
    category: 'equipment',
    title: 'Let the weight tell you',
    body: "\"It's all about finding the dart and the weight that suits you. If you're throwing 22 grams and it's dropping below the treble, try a 23. If that drops even more, go lighter — maybe a 21.\" — Phil Taylor",
    actionStep: 'Buy a set 1g heavier and a set 1g lighter. Give each a week with the T20 Volume drill and keep the weight that groups.'
  },
  {
    id: 'tip-4',
    coachId: 'mardle',
    category: 'consistency',
    title: 'Find your comfort zone',
    body: "\"You want a stance that is comfortable for you. The way Phil Taylor threw wasn't comfortable for me, but it was for Phil. So you've got to find your own comfort zone.\" — Wayne Mardle",
    actionStep: 'Stand at the oche with your eyes closed and shift your weight until it feels locked. That is your starting stance.'
  },
  {
    id: 'tip-5',
    coachId: 'mardle',
    category: 'consistency',
    title: 'Free the shoulder and chest',
    body: "Mardle on Gary Anderson's famously smooth throw: \"It's all about freeing up your shoulder, freeing up your chest and making yourself feel relaxed and comfortable.\"",
    actionStep: 'Before every dart, roll your shoulders back and down once, loosen your grip, then start the routine.'
  },
  {
    id: 'tip-6',
    coachId: 'mardle',
    category: 'checkouts',
    title: 'Learn where you want to miss',
    body: "Mardle's favourite training method requires no throw at all: \"Get a spare board, put it on your lap, and go through the finishes from two to 170. You're actually learning about where you want to miss.\"",
    actionStep: 'Tonight, sit the board on your lap and physically work finishes 40 to 100. Learn both the perfect line and the escape route.'
  },
  {
    id: 'tip-7',
    coachId: 'mardle',
    category: 'checkouts',
    title: '104 only has one right way',
    body: "\"Michael van Gerwen will tell you this. 104, there's only one right way, and that's 48. If you do not go that way, you're not giving yourself options.\" — Wayne Mardle. 48 leaves 56; 20s can end your visit.",
    actionStep: 'For every checkout 40-110, write down the first dart that leaves the most options if you miss it.'
  },
  {
    id: 'tip-8',
    coachId: 'mardle',
    category: 'consistency',
    title: 'Darts is coachable — but refine, don\'t rebuild',
    body: "\"Darts is coachable. I wouldn't say everyone needs coaching. They just need the odd tip here and there.\" The objective is small adjustments, not a throw transplant. \"It's not about tearing apart players' actions or insisting there's one 'correct' way.\"",
    actionStep: 'Identify your single worst-repeating miss. Change ONE thing about your setup to fix it for a week. Only one.'
  },
  {
    id: 'tip-9',
    coachId: 'academy',
    category: 'scoring',
    title: 'The average is built on erasing 26s',
    body: 'Adding one treble a visit nets you about 40 points a leg. Cleaning up three bad darts saves you 45-57. Your quickest win is stopping the 5-1-20 disasters, not hunting more T20s.',
    actionStep: 'Log your 26s (and worse) for three sessions. Just watching the number usually halves it within a week.'
  },
  {
    id: 'tip-10',
    coachId: 'academy',
    category: 'scoring',
    title: 'Track treble percentage, not score',
    body: 'When you practice T20 volume, the metric that matters is trebles per 40 darts registered and beaten weekly. What you track, you improve.',
    actionStep: 'Keep a notes entry: "T20 40-darts: 6 trebles = 15%". Try to beat it each session for two weeks.'
  },
  {
    id: 'tip-11',
    coachId: 'academy',
    category: 'pressure',
    title: 'The pause after a bad first dart is discipline',
    body: 'A stray 5 is fine; a rushed second dart that misses everything is not. Step off the oche, breathe, reset, then throw with intent.',
    actionStep: 'Give yourself permission: after any first dart in the 1 or 5, mentally say "reset" and slow your next shot down.'
  },
  {
    id: 'tip-12',
    coachId: 'pipe',
    category: 'pressure',
    title: 'Practise like you mean it',
    body: 'Justin Pipe keeps practice enjoyable precisely because that sustains it: "The moment you\'re just going through the motions, you\'ve stopped improving."',
    actionStep: 'End any practice session that has lost its purpose. A sharp 15 minutes beats a bored hour every time.'
  },
  {
    id: 'tip-13',
    coachId: 'nicholson',
    category: 'mindset',
    title: 'The average is a reflection, not a limit',
    body: "Paul Nicholson: \"The average is just a reflection of what you've done, not a reflection of what you can do.\" Measure your execution per visit; keep the numbers in the rear-view.",
    actionStep: 'For one month, score each visit 0 or 1: 1 if you ran your full routine, 0 if you rushed. Watch the pattern.'
  }
]

export const getTip = (id) => TIPS.find(t => t.id === id)