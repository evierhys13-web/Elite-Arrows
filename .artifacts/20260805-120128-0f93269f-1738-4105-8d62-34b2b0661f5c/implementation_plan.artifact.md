# Real-Time Online Lobby & Multiplayer Matches

Following the implementation of the dart-by-dart scoring system, this plan outlines the technical steps to enable live real-time matches between players.

## User Review Required

- **Lobby Visibility**: Should the lobby show all online users, or only those who have explicitly marked themselves as "Looking for Game"?
- **Game Types**: Should we support "Best of X" legs for online play immediately, or start with single-leg matches?
- **Rematch Feature**: Should players have a "Rematch" button at the end of an online game?

## Proposed Changes

### [Database Schema Enhancements]

Extend existing collections to support real-time sync.

#### `liveGames` Collection
- **`currentDarts`**: Store the array of darts (max 3) for the active turn.
- **`lastDarts`**: Store the previous turn's darts for visual confirmation.
- **`history`**: Array of turn objects, each containing 3 darts and the resultant score.
- **`turn`**: The UID of the player whose turn it is.

---

### [Online Lobby Interface]

Create a functional lobby within the "Play Online" page.

#### [PlayOnline.jsx](file:///C:/Developer/Elite-Arrows/src/pages/PlayOnline.jsx)
- **Lobby Component**:
    - Real-time list of "Ready" players (using Firestore `onSnapshot`).
    - "Host Game" button to create a public invite.
    - "Join" button next to other players to send a challenge.
- **Game Component**:
    - Listener for `liveGames` document.
    - Update local UI (scores, darts, turn) instantly when the opponent throws.
    - Broadcast local dart throws to Firestore.

---

### [Authentication & Context]

Update context to handle live game state more robustly.

#### [AuthContext.jsx](file:///C:/Developer/Elite-Arrows/src/context/AuthContext.jsx)
- Add `updateLiveGame` function to push dart-by-dart data.
- Ensure `acceptGameInvite` correctly initializes the new data fields.

### [Online & Local Camera Integration]

Enable device camera for all match types (Bot, Local, Online).

#### [PlayOnline.jsx](file:///C:/Developer/Elite-Arrows/src/pages/PlayOnline.jsx)
- **Camera Module**:
    - "Enable Camera" toggle in the match header.
    - Mini-preview/HUD overlay showing the live camera feed.
    - Zoom and Flip controls (similar to legacy `LiveMatch`).
    - Optimization for mobile browsers (using `environment` camera by default).

---

### [UX & Feedback]

- **Thinking Indicator**: Show "Opponent is throwing..." when the other player is active.
- **Victory Screen**: Shared celebration/stats summary at the end of the match.
- **Bust Alerts**: Synchronized bust animations for both players.

## Verification Plan

### Manual Verification
1. **Matchmaking**:
    - Open the app in two different browsers/accounts.
    - Host a game on Account A.
    - Join the game on Account B.
    - Verify both enter the same `liveGame` session.
2. **Real-time Sync**:
    - Throw a T20 on Account A.
    - Verify Account B sees "T20" in the current turn slot instantly.
    - Complete turn on Account A and verify turn switches to Account B on both screens.
3. **Finish/Bust**:
    - Attempt a checkout. Verify both players see the "Match Shot" notification simultaneously.
