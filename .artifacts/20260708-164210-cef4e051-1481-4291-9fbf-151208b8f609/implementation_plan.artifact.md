# Individual Player Progress Tracker

Add a private/public progress tracker where players can manually log their daily, weekly, or session-based darts performance metrics and visualize them via graphs.

## User Review Required

- **Privacy Default**: I've planned for entries to be private to the user by default, with an optional toggle to make them public. Is this the preferred default?
- **Metric Formatting**:
    - Average (3-dart/9-dart): Decimal (e.g., 55.5)
    - Checkout Rate: Percentage (e.g., 20.0%)
    - Highest Checkout: Integer (max 170)
    - 180s: Integer
- **Graph Library**: Using `recharts` which is already a dependency in the project.

## Proposed Changes

### [Firebase/Firestore]

Update Firestore rules to secure the new collection.

#### [firestore.rules](file:///C:/Developer/Elite-Arrows/firestore.rules)
- Add rules for the `progressLogs` collection.
```javascript
    match /progressLogs/{logId} {
      allow read: if signedIn() && (resource.data.userId == request.auth.uid || resource.data.isPublic == true || isAdmin());
      allow create: if signedIn();
      allow update, delete: if signedIn() && (resource.data.userId == request.auth.uid || isAdmin());
    }
```

---

### [Utilities]

New service to handle Firestore operations for progress tracking.

#### [NEW] [progressService.js](file:///C:/Developer/Elite-Arrows/src/utils/progressService.js)
- `saveProgressLog(userId, logData)`: Saves a new progress entry.
- `fetchProgressLogs(userId)`: Retrieves all logs for a specific user.
- `deleteProgressLog(logId)`: Deletes a specific log.

---

### [Pages]

The main user interface for the progress tracker.

#### [NEW] [ProgressTracker.jsx](file:///C:/Developer/Elite-Arrows/src/pages/ProgressTracker.jsx)
- **Header**: Breadcrumbs and "Add Entry" button.
- **Form/Modal**: Input fields for the 5 metrics, date picker, type selector (Daily/Weekly/Session), and privacy toggle.
- **Visualization**: `ResponsiveContainer` with `LineChart` (recharts) showing the trends of the selected metric.
- **History List**: A table or card list showing previous entries with a delete option.

---

### [Navigation & Routing]

Integrate the new page into the app.

#### [App.jsx](file:///C:/Developer/Elite-Arrows/src/App.jsx)
- Add the `/progress-tracker` route.

#### [Sidebar.jsx](file:///C:/Developer/Elite-Arrows/src/components/Sidebar.jsx)
- Add "Progress Tracker" to the **Account** or **Compete** group (suggested: Compete).

#### [BottomNav.jsx](file:///C:/Developer/Elite-Arrows/src/components/BottomNav.jsx)
- (Optional) Could replace or add to the mobile navigation if desired, but sidebar is safer for space.

## Verification Plan

### Automated Tests
- No existing automated test suite detected for pages. Verification will be manual.

### Manual Verification
1. **Navigation**: Verify the link appears in the sidebar and routes to `/progress-tracker`.
2. **Data Entry**: Add a "Daily" log with specific metrics (e.g., 60.5 avg, 2 180s).
3. **Visualization**: Check if the graph updates to show the new data point.
4. **Privacy**:
    - Create a "Private" log. Verify it's not visible to another test user (if possible to test with two sessions).
    - Create a "Public" log. Verify it *is* visible (via a direct link or if a public view is added later).
5. **Persistence**: Refresh the page and ensure the logs are still there (fetched from Firestore).
6. **Deletion**: Delete a log and ensure it disappears from both the list and the graph.
