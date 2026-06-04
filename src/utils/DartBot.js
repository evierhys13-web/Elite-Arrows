const PRO_BOTS = [
  { id: 'custom', name: 'Custom', avg: 50, check: 20, icon: '⚙️', desc: 'Adjust avg & checkout sliders below' },
  { id: 'luke_littler', name: 'Luke Littler', avg: 105, check: 45, icon: '👑', desc: 'The Nuke — teenage phenom, relentless T20 scorer' },
  { id: 'luke_humphries', name: 'Luke Humphries', avg: 100, check: 42, icon: '🏆', desc: 'Cool Hand — clinical doubles, ice-cool under pressure' },
  { id: 'mvg', name: 'Michael van Gerwen', avg: 102, check: 46, icon: '🐍', desc: 'Mighty Mike — explosive scoring, fierce finisher' },
  { id: 'phil_taylor', name: 'Phil Taylor', avg: 100, check: 44, icon: '🎯', desc: 'The Power — 16x world champ, legendary composure' },
  { id: 'gerwyn_price', name: 'Gerwyn Price', avg: 98, check: 40, icon: '🦁', desc: 'The Iceman — aggressive, high-pressure competitor' },
  { id: 'michael_smith', name: 'Michael Smith', avg: 97, check: 38, icon: '🎯', desc: 'Bully Boy — silky smooth scoring, lethal on tops' },
  { id: 'peter_wright', name: 'Peter Wright', avg: 96, check: 36, icon: '🦜', desc: 'Snakebite — colorful, unpredictable, always dangerous' },
  { id: 'gary_anderson', name: 'Gary Anderson', avg: 95, check: 37, icon: '🎯', desc: 'The Flying Scotsman — effortless, natural scorer' },
  { id: 'james_wade', name: 'James Wade', avg: 92, check: 35, icon: '🎯', desc: 'The Machine — relentless, never-say-die attitude' },
  { id: 'nathan_aspinall', name: 'Nathan Aspinall', avg: 93, check: 34, icon: '🎯', desc: 'The Asp — big-stage performer, heart of a lion' },
  { id: 'rob_cross', name: 'Rob Cross', avg: 91, check: 32, icon: '⚡', desc: 'Voltage — 2018 world champ, powerful scoring' },
  { id: 'danny_noppert', name: 'Danny Noppert', avg: 90, check: 33, icon: '🎯', desc: 'The Freeze — Dutch precision under pressure' },
  { id: 'jose_de_sousa', name: 'Jose de Sousa', avg: 92, check: 31, icon: '🎯', desc: 'The Special One — Portuguese flair, big finishes' },
  { id: 'dirk_van_duijvenbode', name: 'Dirk van Duijvenbode', avg: 94, check: 30, icon: '🐻', desc: 'Aubergenius — raw power, physical presence' },
  { id: 'jonny_clayton', name: 'Jonny Clayton', avg: 93, check: 33, icon: '🎯', desc: 'The Ferret — Welsh wizard, silky consistency' },
  { id: 'dave_chisnall', name: 'Dave Chisnall', avg: 95, check: 28, icon: '🎯', desc: 'Chizzy — brilliant scorer, streaky doubles' },
  { id: 'joe_cullen', name: 'Joe Cullen', avg: 93, check: 30, icon: '🎯', desc: 'The Rockstar — flashy, talented big-stage player' },
  { id: 'stephen_bunting', name: 'Stephen Bunting', avg: 91, check: 32, icon: '🎯', desc: 'The Bullet — consistent, experienced campaigner' },
  { id: 'krzysztof_ratajski', name: 'Krzysztof Ratajski', avg: 90, check: 30, icon: '🎯', desc: 'The Polish Eagle — methodical, steady scorer' },
];

const DOUBLE_SEQUENCES = {
  default: [20, 16, 12, 8, 4, 2, 10, 6, 18, 14, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40],
  tops_first: [20, 10, 5, 16, 8, 4, 2, 12, 6, 18, 14, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40],
  bull_hunter: [25, 20, 10, 16, 8, 4, 2, 12, 6, 18, 14, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40],
};

const PLAYER_STYLES = {
  luke_littler: { treblePref: 20, aggression: 0.9, doublePref: 'tops_first', delay: 600 },
  luke_humphries: { treblePref: 20, aggression: 0.7, doublePref: 'default', delay: 800 },
  mvg: { treblePref: 20, aggression: 0.85, doublePref: 'bull_hunter', delay: 700 },
  phil_taylor: { treblePref: 20, aggression: 0.75, doublePref: 'default', delay: 750 },
  gerwyn_price: { treblePref: 20, aggression: 0.8, doublePref: 'tops_first', delay: 900 },
  michael_smith: { treblePref: 20, aggression: 0.7, doublePref: 'tops_first', delay: 800 },
  peter_wright: { treblePref: 19, aggression: 0.65, doublePref: 'default', delay: 1000 },
  gary_anderson: { treblePref: 20, aggression: 0.7, doublePref: 'default', delay: 750 },
  james_wade: { treblePref: 20, aggression: 0.55, doublePref: 'default', delay: 850 },
  nathan_aspinall: { treblePref: 20, aggression: 0.65, doublePref: 'default', delay: 800 },
  rob_cross: { treblePref: 20, aggression: 0.6, doublePref: 'default', delay: 800 },
  danny_noppert: { treblePref: 20, aggression: 0.6, doublePref: 'default', delay: 850 },
  jose_de_sousa: { treblePref: 20, aggression: 0.7, doublePref: 'default', delay: 900 },
  dirk_van_duijvenbode: { treblePref: 20, aggression: 0.75, doublePref: 'default', delay: 850 },
  jonny_clayton: { treblePref: 20, aggression: 0.6, doublePref: 'default', delay: 800 },
  dave_chisnall: { treblePref: 20, aggression: 0.7, doublePref: 'default', delay: 750 },
  joe_cullen: { treblePref: 20, aggression: 0.65, doublePref: 'default', delay: 850 },
  stephen_bunting: { treblePref: 20, aggression: 0.55, doublePref: 'default', delay: 800 },
  krzysztof_ratajski: { treblePref: 20, aggression: 0.5, doublePref: 'default', delay: 850 },
};

export class DartBot {
  constructor(options = {}) {
    this.id = options.id || 'custom';
    this.name = options.name || 'Custom Bot';
    this.targetAverage = options.targetAverage || 50;
    this.checkoutRate = options.checkoutRate || 0.2;
    this.setupRate = options.setupRate || 0.4;
    this.style = PLAYER_STYLES[this.id] || { treblePref: 20, aggression: 0.5, doublePref: 'default', delay: 800 };
    this.trebleSegments = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  }

  static getProBots() {
    return PRO_BOTS;
  }

  async takeTurn(currentScore, onDart) {
    const turnDarts = [];
    let remaining = currentScore;

    for (let i = 0; i < 3; i++) {
      const delay = this.style.delay + Math.random() * 400;
      await new Promise(r => setTimeout(r, delay));

      const dart = this.calculateDart(remaining, i);
      turnDarts.push(dart);
      if (onDart) onDart(dart, turnDarts);
      remaining -= dart.value;

      if (remaining <= 0) break;
    }

    return turnDarts;
  }

  calculateDart(remaining, dartIndex) {
    if (remaining <= 50) {
      return this.attemptCheckout(remaining);
    }

    if (remaining <= 100) {
      return this.attemptSetup(remaining);
    }

    return this.attemptScoring();
  }

  attemptCheckout(remaining) {
    const preferred = DOUBLE_SEQUENCES[this.style.doublePref] || DOUBLE_SEQUENCES.default;
    const isBullFinish = remaining === 50 || remaining === 25;
    const doubleVal = remaining <= 40 && remaining % 2 === 0 ? remaining / 2 : null;

    if (remaining === 50) {
      const success = Math.random() < (this.checkoutRate * 0.7);
      if (success) return { value: 50, label: 'BULL', isDouble: true };
      return { value: 25, label: '25' };
    }

    if (remaining === 25) {
      const success = Math.random() < (this.checkoutRate * 0.4);
      if (success) return { value: 25, label: '25', isDouble: true };
      return { value: 0, label: 'MISS' };
    }

    if (doubleVal) {
      const success = Math.random() < this.checkoutRate;
      if (success) return { value: remaining, label: `D${doubleVal}`, isDouble: true };
      const missType = Math.random();
      if (missType < 0.6) return { value: doubleVal, label: doubleVal.toString() };
      return { value: 0, label: 'MISS' };
    }

    if (remaining % 2 === 1 && remaining < 40) {
      const oddFinish = Math.random() < 0.5;
      if (oddFinish) return { value: remaining - 1, label: `D${(remaining - 1) / 2}` };
      return { value: remaining, label: remaining.toString() };
    }

    if (remaining <= 40 && remaining % 2 !== 0) {
      const singleVal = Math.min(remaining, 20);
      return { value: singleVal, label: singleVal.toString() };
    }

    return this.attemptScoring();
  }

  attemptSetup(remaining) {
    const agg = this.style.aggression;
    if (Math.random() < this.setupRate * agg) {
      if (remaining > 40) {
        for (const target of [40, 32, 36, 28, 24, 20]) {
          const diff = remaining - target;
          if (diff >= 0 && diff <= 180) {
            const treb = this.nearestTreble(diff);
            if (treb) return treb;
            return { value: diff, label: diff.toString() };
          }
        }
      }
    }
    return this.attemptScoring();
  }

  attemptScoring() {
    const roll = Math.random() * 100;
    const t20Prob = Math.max(5, Math.min(70, (this.targetAverage - 30) / 0.65));

    if (roll < t20Prob) {
      const seg = this.trebleSegments[Math.floor(Math.random() * this.trebleSegments.length)];
      const val = seg * 3;
      return { value: val, label: `T${seg}` };
    }
    if (roll < t20Prob + 25) {
      const base = Math.random() < 0.7 ? 20 : this.trebleSegments[Math.floor(Math.random() * 5)];
      return { value: base, label: base.toString() };
    }
    if (roll < t20Prob + 40) {
      const big = [20, 19, 18][Math.floor(Math.random() * 3)];
      return { value: big * 2, label: `D${big}` };
    }
    if (roll < t20Prob + 55) {
      const val = Math.floor(Math.random() * 20) + 1;
      return { value: val, label: val.toString() };
    }
    if (roll < t20Prob + 70) {
      return { value: 5, label: '5' };
    }
    if (roll < t20Prob + 80) {
      return { value: 1, label: '1' };
    }

    return { value: 20, label: '20' };
  }

  nearestTreble(target) {
    for (const seg of this.trebleSegments) {
      if (seg * 3 <= target) return { value: seg * 3, label: `T${seg}` };
    }
    return null;
  }
}
