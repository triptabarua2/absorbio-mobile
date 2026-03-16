# Absorbio Mobile App - Design Document

## Overview
Absorbio is a space-themed game platform featuring the Blackhole game with progression systems, leaderboards, daily rewards, and cosmetic customization. The mobile app will provide a native iOS/Android experience with touch-optimized controls.

---

## Screen List

### 1. **Login Screen**
- Google OAuth login
- Facebook OAuth login
- Guest play option
- Cosmic background with animated nebula effects
- Error message display

### 2. **Home Screen (Blackhole Hub)**
- Player stats display (Level, XP, Coins)
- Game mode selector (Infinity, Survival, Time)
- Theme selector with unlock progression
- Quick access buttons:
  - Play Game
  - Daily Rewards
  - Leaderboard
  - Shop
  - Settings
- User profile button
- Cosmic background with animated stars

### 3. **Blackhole Game Screen**
- Game canvas with Blackhole gameplay
- Customizable HUD elements:
  - Leaderboard (top-left)
  - Minimap (top-right)
  - Mass bar (bottom-right)
  - Death feed (left-center)
  - Score, coins, alive count displays (top-center)
  - Time display (top-right)
  - Event text (center)
- Touch joystick controls (dual stick or single stick options)
- Pause button
- Exit button

### 4. **Daily Rewards Screen**
- Reward calendar showing daily bonus progression
- Claim button for today's reward
- Streak counter
- Reward history

### 5. **Leaderboard Screen**
- Global leaderboard with top players
- Player ranking and stats
- Filter options (All-time, Weekly, Daily)
- Search player functionality

### 6. **Shop Screen**
- Power-ups and cosmetics for purchase
- Coin balance display
- Item descriptions and prices
- Purchase confirmation

### 7. **Settings Screen**
- Control customization:
  - Joystick type (Dual, Single)
  - Stick swap option
  - Joystick size adjustment
  - Joystick position customization
- Graphics quality settings
- Food style selection (Planet, Shapes)
- HUD customization mode
- Theme selection
- Legal pages (Terms, Privacy)
- Logout button

### 8. **Profile Screen**
- User information (Name, Email, Provider)
- Account statistics
- Inventory display
- Edit profile option

---

## Primary Content and Functionality

### Login Screen
- **Content**: Cosmic background, brand logo (Blackhole animation), login buttons
- **Functionality**: 
  - OAuth authentication (Google, Facebook)
  - Guest login with local storage
  - Error handling and display
  - Offline guest mode support

### Home Screen
- **Content**: 
  - Player stats (Level, XP bar, Coins)
  - Current theme display
  - Game mode cards
  - Navigation buttons
- **Functionality**:
  - Navigate to game, rewards, leaderboard, shop, settings
  - Switch game modes
  - Switch themes (with level unlock checks)
  - View profile
  - Real-time stats updates

### Game Screen
- **Content**:
  - Canvas-based game rendering
  - Customizable HUD overlays
  - Touch joystick controls
- **Functionality**:
  - Real-time game physics
  - Score and coin tracking
  - Pause/Resume
  - Exit to home
  - HUD element repositioning in customize mode

### Daily Rewards
- **Content**: Calendar grid, reward amounts, streak info
- **Functionality**:
  - Check-in and claim rewards
  - Streak tracking
  - Coin rewards

### Leaderboard
- **Content**: Player rankings, scores, avatars
- **Functionality**:
  - Display top 100 players
  - Filter by time period
  - Search players
  - View player profiles

### Shop
- **Content**: Item cards with prices, descriptions, icons
- **Functionality**:
  - Browse items
  - Purchase with coins
  - Inventory management
  - Confirmation dialogs

### Settings
- **Content**: Control options, graphics settings, HUD customization
- **Functionality**:
  - Save preferences to AsyncStorage
  - Real-time preview of changes
  - HUD customization mode
  - Theme unlock display

---

## Key User Flows

### Flow 1: First-Time User Onboarding
1. User opens app → Login Screen
2. User chooses login method (Google, Facebook, or Guest)
3. Account created / Guest data initialized
4. Redirected to Home Screen
5. User views stats and available game modes
6. User taps "Play" → Game Screen starts

### Flow 2: Playing a Game
1. User on Home Screen
2. Selects game mode (Infinity, Survival, or Time)
3. Taps "Play Game" → Game Screen loads
4. User controls Blackhole with touch joysticks
5. Game ends (death or time limit)
6. Score and coins awarded
7. Return to Home Screen with updated stats

### Flow 3: Claiming Daily Reward
1. User on Home Screen
2. Taps "Daily Rewards" → Rewards Screen
3. Views calendar and current streak
4. Taps "Claim Reward" button
5. Coins added to balance
6. Streak increments
7. Return to Home Screen

### Flow 4: Checking Leaderboard
1. User on Home Screen
2. Taps "Leaderboard" → Leaderboard Screen
3. Views top 100 players
4. Optionally filters by time period
5. Can search for specific players
6. Return to Home Screen

### Flow 5: Customizing Controls
1. User on Home Screen
2. Taps "Settings" → Settings Screen
3. Selects control type (Dual or Single joystick)
4. Adjusts joystick size and position
5. Toggles stick swap
6. Changes graphics quality
7. Saves preferences
8. Return to Home Screen

### Flow 6: Purchasing from Shop
1. User on Home Screen
2. Taps "Shop" → Shop Screen
3. Browses available items
4. Taps item → Shows details and price
5. Taps "Buy" → Confirmation dialog
6. Coins deducted, item added to inventory
7. Return to Shop or Home Screen

---

## Color Choices

### Primary Palette (Cosmic Theme)
- **Background**: Deep space black (`#000000`, `#050015`)
- **Primary Accent**: Purple (`#a855f7`, `#9333ea`)
- **Secondary Accent**: Pink (`#ec4899`, `#db2777`)
- **Tertiary Accent**: Cyan (`#06b6d4`, `#0891b2`)

### Theme Variants
- **Space**: Purple/Pink nebula with dark space
- **Neon**: Cyan/Blue with dark background
- **Dark**: Pure black with minimal highlights
- **Sunset**: Orange/Red gradient to dark
- **Cosmic**: Blue/Cyan with deep space

### UI Elements
- **Text**: White for primary, Purple-300 for secondary
- **Buttons**: Gradient backgrounds (Purple to Pink)
- **Cards**: Semi-transparent white with backdrop blur
- **Success**: Green (`#22c55e`)
- **Warning**: Orange (`#f59e0b`)
- **Error**: Red (`#ef4444`)

---

## Typography & Spacing

### Font Hierarchy
- **Headings**: Bold, 24-32px (game title, screen titles)
- **Subheadings**: Semi-bold, 16-20px (section titles)
- **Body**: Regular, 14-16px (descriptions, stats)
- **Small**: Regular, 12-14px (labels, secondary info)

### Spacing
- **Margins**: 8px, 16px, 24px, 32px (8px grid)
- **Padding**: 12px, 16px, 24px (cards and containers)
- **Gap**: 8px, 12px, 16px (between elements)

---

## Interaction Patterns

### Touch Feedback
- **Buttons**: Scale 0.97 on press, haptic feedback (light)
- **Cards**: Opacity 0.7 on press
- **Joysticks**: Visual knob movement with touch tracking

### Animations
- **Screen transitions**: Fade in/out (200ms)
- **Button press**: Scale + haptic (80ms)
- **Loading states**: Spinner animation
- **Cosmic background**: Continuous star animation

### Accessibility
- **Color contrast**: WCAG AA compliant
- **Touch targets**: Minimum 44x44pt
- **Text scaling**: Responsive to system font size
- **Haptic feedback**: Optional toggle in settings

---

## Technical Considerations

### State Management
- Use React Context for user data and game state
- AsyncStorage for local preferences and offline guest data
- Firebase Firestore for cloud user data (authenticated users)

### Performance
- Canvas rendering for game screen (60 FPS target)
- Lazy load leaderboard and shop data
- Optimize animations with `react-native-reanimated`
- Debounce HUD customization saves

### Platform-Specific
- iOS: Use SafeAreaView for notch handling
- Android: Handle back button for navigation
- Web: Responsive design for testing

### Data Persistence
- Local: AsyncStorage for settings, offline guest data
- Cloud: Firebase Firestore for authenticated user data
- Sync: Automatic sync when online

---

## Success Metrics

- User can log in and play within 2 taps
- Game runs at 60 FPS on mid-range devices
- Leaderboard loads in < 2 seconds
- All settings persist across app restarts
- Offline guest mode fully functional
