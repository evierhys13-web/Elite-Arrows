# Elite Arrows - Darts League Web App

## Project Overview
- **Project Name:** Elite Arrows
- **Type:** Single Page Application (SPA)
- **Core Functionality:** A darts league management web app with authentication, user profiles, league tables, results, and match logging
- **Target Users:** Darts players in a league system

## Tech Stack
- React 18 with Vite
- React Router v6 for routing
- Context API for state management (auth, theme)
- CSS Modules for styling
- LocalStorage for data persistence

---

## 1. Authentication

### Sign Up / Sign In Page
- Route: `/auth`
- Landing page for unauthenticated users
- Two tabs: "Sign In" and "Sign Up"

### Sign Up Form
- Username field (required, unique)
- Email field (required, valid format)
- Password field (required, min 6 chars)
- Confirm password field
- "Remember me" checkbox

### Sign In Form
- Email field
- Password field
- "Remember me" checkbox
- Submit button

### Admin Role Request
- Form on profile/settings page to apply for admin role
- Admin approval pending status indicator

---

## 2. User Profile System

### Profile Fields
- Profile picture (upload/change)
- Username
- Bio (text area)
- DartCounter link (URL)
- 3-dart average (number)

---

## 3. Home Page (Dashboard)

### Route: `/home`
- Profile picture (clickable - links to /profile)
- Username
- Rating / 3-dart average
- Season overview card
- No editing fields on this page

---

## 4. Sidebar Navigation

### Menu Items (in order):
1. Home (`/home`)
2. Subscription (`/subscription`)
3. Table (`/table`)
4. Results (`/results`)
5. Match Log (`/match-log`)
6. Players (`/players`)
7. Submit Result (`/submit-result`)
8. Open Chat (`/chat`)
9. Sign Out

### Design
- Fixed sidebar on desktop
- Hamburger menu on mobile
- Dark blue background matching app theme
- No light mode toggle in sidebar
- Active state indicator for current page

---

## 5. Profile Page

### Route: `/profile`
- Change profile picture (file upload)
- Edit username
- Edit bio
- Edit DartCounter link
- Edit 3-dart average
- Save changes button
- Apply for Admin role button (if not already admin)

---

## 6. Settings Page

### Route: `/settings`
- Theme toggle (Light / Dark)
- Language selector (English default)
- Link to profile settings
- Chat settings
- Sign Out button

---

## 7. Routing / Navigation

### All Routes:
- `/auth` - Sign In/Sign Up
- `/home` - Dashboard
- `/subscription` - Subscription page
- `/table` - League table with divisions
- `/results` - Match results
- `/match-log` - Match history log
- `/players` - Players list
- `/submit-result` - Submit match result
- `/chat` - Chat interface
- `/profile` - User profile edit
- `/settings` - App settings

### Protected Routes
All pages except `/auth` require authentication

---

## 8. Styling

### Colors
- **Background:** Dark blue (`#0a1628` primary, `#162236` secondary)
- **Buttons:** Light blue (`#4da8da` primary, `#3a8cc2` hover)
- **Text:** White/light gray (`#ffffff`, `#b0b8c4`)
- **Accent:** Cyan (`#00d4ff`)
- **Cards:** Dark with subtle border (`#1a2a42`)
- **Success:** Green (`#22c55e`)
- **Error:** Red (`#ef4444`)

### Design Principles
- Clean, modern UI
- Mobile-first responsive design
- DartCounter-inspired layout
- Card-based content sections
- Smooth transitions and hover states
- Consistent spacing and typography

---

## Data Structures

### User Object
```javascript
{
  id: string,
  username: string,
  email: string,
  password: string (hashed),
  profilePicture: string (URL),
  bio: string,
  dartCounterLink: string,
  threeDartAverage: number,
  isAdmin: boolean,
  adminRequestPending: boolean,
  createdAt: timestamp
}
```

### Match Object
```javascript
{
  id: string,
  player1Id: string,
  player2Id: string,
  player1Score: number,
  player2Score: number,
  date: timestamp,
  division: string
}
```

### League Table Entry
```javascript
{
  playerId: string,
  played: number,
  won: number,
  lost: number,
  points: number,
  average: number
}
```

---

## Acceptance Criteria

1. ✓ User can create account and sign in
2. ✓ "Remember me" persists session
3. ✓ User can apply for admin role
4. ✓ Profile page allows editing all fields
5. ✓ Home page displays profile pic (clickable), username, rating, season overview
6. ✓ Sidebar has all required items, no light mode toggle
7. ✓ Profile pic on home links to /profile
8. ✓ Settings page has theme toggle, language, chat settings, sign out
9. ✓ All routes work correctly without getting stuck
10. ✓ Dark blue background, light blue buttons
11. ✓ Mobile responsive