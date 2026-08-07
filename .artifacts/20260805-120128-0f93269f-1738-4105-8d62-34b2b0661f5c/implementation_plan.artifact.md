# Enhanced "Accurate" Scoring System (Dartsmind Inspired)

Following a study of Dartsmind, this plan outlines improvements to the Elite Arrows scoring system to move from "Total Score" input to a more accurate and data-rich "Dart-by-Dart" model.

## User Review Required

- **Input Method**: Should "Dart-by-Dart" be the *only* way to score live matches, or should we keep a "Total Score" toggle for those who prefer speed?
- **Checkout Suggestions**: Should we display a "Suggested Checkout" (e.g., T20-T19-D12 for 155) in real-time?
- **Detailed Stats**: Are "First 9 Average" and "Double Success Rate" metrics you'd like to see on player profiles?

## Proposed Changes

### [Core Logic]

Update the result tracking logic to handle dart-by-dart data.

#### [leagueResults.js](file:///C:/Developer/Elite-Arrows/src/utils/leagueResults.js)
- Add functions to calculate `first9Avg` and `doubleAccuracy` from a sequence of darts.

---

### [Live Match Enhancements]

Refactor the live match interface to support granular input.

#### [LiveMatch.jsx](file:///C:/Developer/Elite-Arrows/src/pages/LiveMatch.jsx)
- **New Component**: `DartboardInput` - A visual segment-based input (S/D/T for numbers 1-20 + Bull).
- **Turn State**: Track each dart individual (up to 3) per turn.
- **Validation**: Prevent "illegal" scores (e.g., trying to finish with a single dart if double is required).
- **UI**: Display the specific darts thrown in the turn (e.g., "T20, S20, S5").

---

### [Practice Mode Enhancements]

Bring the same accuracy to practice games.

#### [PracticeGame.jsx](file:///C:/Developer/Elite-Arrows/src/pages/PracticeGame.jsx)
- Update `handleInput` to support dart-by-dart logging.
- For "Around the Clock", track exactly which darts hit the target.

---

### [Statistics & Visualization]

Leverage the new granular data.

#### [Analytics.jsx](file:///C:/Developer/Elite-Arrows/src/pages/Analytics.jsx)
- Add new charts for:
    - **Heatmaps**: Showing common landing zones.
    - **Checkout Success**: A bar chart of percentage success per double.
    - **First 9 vs Overall Average**: A line chart comparing starting strength to finishing strength.

## Verification Plan

### Automated Tests
- No existing unit test framework detected. I will perform manual verification of scoring logic.

### Manual Verification
1. **Live Match**:
    - Start a match. Input darts one-by-one (e.g., T20, T20, T20).
    - Verify the total (180) is calculated correctly.
    - Verify "First 9" stats are updated after the first 3 turns.
2. **Finishing**:
    - Try to finish a leg with a single. Verify the app requires a double to finish.
3. **Analytics**:
    - Complete a match and verify the "Double Success" stat reflects the actual darts thrown.
