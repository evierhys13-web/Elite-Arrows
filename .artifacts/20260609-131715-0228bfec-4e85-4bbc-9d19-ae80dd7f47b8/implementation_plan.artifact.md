# Practice Hub & Highlights Reel Implementation Plan

This plan introduces two major features: a **Practice Hub** for daily training and a **Highlights Reel** for sharing video clips of top darts moments.

## Proposed Changes

### [Practice Hub]

A new dedicated section for solo training games.

#### [NEW] [PracticeHub.jsx](file:///C:/Developer/Elite-Arrows/src/pages/PracticeHub.jsx)
- Landing page for practice modes.
- Selection between: **Around the Clock**, **170 Drill**, and **Score Practice**.
- Daily goals/challenges integration.

#### [NEW] [PracticeGame.jsx](file:///C:/Developer/Elite-Arrows/src/pages/PracticeGame.jsx)
- Generic engine for practice games.
- Interactive scorer optimized for fast solo play.
- Stats tracking: Darts thrown, accuracy, time taken.

#### [NEW] [practiceService.js](file:///C:/Developer/Elite-Arrows/src/utils/practiceService.js)
- Logic for different practice modes.
- Functions to save practice sessions and update leaderboards in Firestore.

---

### [Highlights Reel]

Video integration on user profiles to showcase 180s and high checkouts.

#### [Profile.jsx](file:///C:/Developer/Elite-Arrows/src/pages/Profile.jsx)
- Add a new "Highlights Reel" tab.
- Integrated video player for uploaded clips.
- Support for YouTube/TikTok/Spotify links OR direct video upload (base64 compressed/limited).

#### [NEW] [HighlightReel.jsx](file:///C:/Developer/Elite-Arrows/src/components/HighlightReel.jsx)
- Component to display a gallery of short video clips.
- Upvote/Like functionality to foster community engagement.

#### [SubmitResult.jsx](file:///C:/Developer/Elite-Arrows/src/pages/SubmitResult.jsx)
- Allow users to upload a short video clip instead of just an image for proof/highlights.

---

### [Social & Rewards]

#### [Leaderboards.jsx](file:///C:/Developer/Elite-Arrows/src/pages/Leaderboards.jsx)
- Add a "Practice" tab to see top performers in Around the Clock and other drills.

#### [Rewards.jsx](file:///C:/Developer/Elite-Arrows/src/pages/Rewards.jsx)
- Add "Practice Milestones" to earn Elite Tokens (e.g., "Complete 5 days of practice in a row").

## Verification Plan

### Automated Tests
- Unit tests for practice scoring logic (`practiceService.js`).
- Validation of video upload constraints (size/type).

### Manual Verification
1. **Practice Hub**:
   - Start an "Around the Clock" session.
   - Complete the game and verify that the result is saved to the leaderboard.
   - Check if Elite Tokens are awarded for completion.
2. **Highlights Reel**:
   - Upload a short clip on the profile page.
   - Verify it plays correctly.
   - View the profile as another user and check if the video is visible.
3. **Admin Check**:
   - Verify that admins can see highlight videos in the result approval queue.
