# Absorbio Mobile App - Architecture Overview

## Project Structure

Absorbio is a React Native game built with Expo that combines two backend systems to provide authentication, gameplay features, and cloud synchronization.

## Backend Architecture

### 1. Firebase (Client-Facing Gameplay Backend)

**Purpose**: Real-time gameplay data, user profiles, leaderboards, and inventory management

**Components**:
- **Firebase Authentication**: Handles user sign-in via Google, Facebook, and anonymous login
- **Firestore Database**: Cloud storage for user game data

**Data Model** (Firestore `absorbio_users` collection):
```typescript
{
  uid: string;                    // Firebase UID
  name?: string;                  // Player name
  email?: string;                 // User email
  level: number;                  // Current level
  xp: number;                     // Experience points
  coins: number;                  // In-game currency
  provider?: string;              // Auth provider (google, facebook, anonymous)
  createdAt?: Timestamp;          // Account creation timestamp
  inventory?: {
    magnet?: number;              // Power-up inventory
    speed?: number;
    double?: number;
  };
}
```

**Key Features**:
- Real-time leaderboard queries (ordered by level, then XP)
- Offline-first support with AsyncStorage fallback
- Automatic user initialization on first login
- Guest mode with local-only storage

**Files**:
- `lib/firebase.ts` - Firebase SDK initialization
- `lib/firebase-db.ts` - Firestore data access layer
- `lib/auth-context.tsx` - React context for authentication state

### 2. Express Server (Backend API & OAuth)

**Purpose**: OAuth integration, Manus platform features, and server-side user management

**Technology Stack**:
- **Framework**: Express.js
- **Database**: MySQL with Drizzle ORM
- **API**: tRPC for type-safe client-server communication
- **Authentication**: JWT tokens via cookies

**Endpoints**:
- `/api/health` - Health check
- `/api/trpc/*` - tRPC router endpoints
- `/api/oauth/callback` - OAuth callback handler
- `/api/oauth/login` - OAuth login initiation

**Server Routers**:
- `system` - System operations (image generation, LLM, voice transcription)
- `auth` - User session management (me, logout)

**Key Features**:
- OAuth flow management for Manus platform
- Server-side user identity persistence
- Integration with Manus services (LLM, image generation, voice)
- Session token management

**Files**:
- `server/_core/index.ts` - Express server setup
- `server/routers.ts` - tRPC router definitions
- `server/db.ts` - MySQL/Drizzle data access
- `server/_core/oauth.ts` - OAuth flow handlers

## Client Architecture

### Frontend Stack

- **Framework**: React Native with Expo
- **Routing**: Expo Router
- **State Management**: 
  - React Context (Authentication)
  - TanStack React Query (Server state)
  - AsyncStorage (Local persistence)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **UI Components**: Lucide React Native, Expo Vector Icons
- **Game Engine**: React Native Game Engine
- **Physics**: Shopify Skia for rendering

### Provider Hierarchy

```
RootLayout
├── ThemeProvider
├── SafeAreaProvider
├── GestureHandlerRootView
├── AuthProvider (Firebase + Firestore)
├── tRPC Provider (Express server)
└── QueryClientProvider (React Query)
```

### Authentication Flow

**Online (Firebase)**:
1. User initiates sign-in (Google/Facebook)
2. Firebase Auth handles OAuth with provider
3. User data initialized in Firestore
4. Session persisted via Firebase

**Offline Guest**:
1. User selects guest mode
2. AsyncStorage stores guest flag
3. Local-only game data
4. Can upgrade to full account later

## Data Synchronization

### Real-time Updates
- Firestore listeners for leaderboard changes
- Automatic stats sync on gameplay events
- Conflict resolution: server-side data wins on conflicts

### Offline Support
- AsyncStorage caches user data locally
- Guest mode works completely offline
- Automatic sync when connection restored

## Environment Configuration

Required environment variables (see `.env.example`):

**Firebase**:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

**Server**:
- `DATABASE_URL` - MySQL connection string
- `EXPO_PUBLIC_OAUTH_PORTAL_URL` - OAuth portal URL
- `EXPO_PUBLIC_OAUTH_SERVER_URL` - OAuth server URL
- `EXPO_PUBLIC_API_BASE_URL` - API base URL
- `EXPO_PUBLIC_APP_ID` - Unique app identifier
- `EXPO_PUBLIC_OWNER_OPEN_ID` - Owner identification
- `EXPO_PUBLIC_OWNER_NAME` - Owner name
- `PORT` - Server port (default: 3000)

## Development Workflow

### Starting Development

```bash
# Install dependencies
pnpm install

# Start development servers (server + Metro bundler)
pnpm dev

# Run on specific platform
pnpm android
pnpm ios
pnpm dev:metro  # Web
```

### Database Management

```bash
# Generate migrations
drizzle-kit generate

# Run migrations
drizzle-kit migrate

# Or combined
pnpm db:push
```

### Type Safety

- Full TypeScript support
- tRPC provides end-to-end type safety between client and server
- Firestore types defined in `lib/firebase-db.ts`

## Dependency Versions

### Critical Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| expo | ~54.0.29 | Stable release |
| react-native | 0.79.0 | Compatible with Expo 54 |
| react | 18.3.1 | Stable, pre-React 19 |
| firebase | ^10.13.0 | Stable JS SDK |
| @trpc/server | 11.7.2 | Type-safe RPC |
| drizzle-orm | ^0.44.7 | TypeScript ORM |

### Experimental Features

- **New Architecture**: Enabled in `app.config.ts` for better performance
- **React Compiler**: Disabled (experimental, not yet fully compatible)

## Known Limitations

1. **Feature Completeness**: Core gameplay features (game canvas, physics, HUD) are not yet implemented
2. **Leaderboard**: Currently supports basic queries; pagination/filtering needs implementation
3. **Shop System**: Not yet implemented
4. **Daily Rewards**: Not yet implemented
5. **Offline Sync**: Guest data cannot be synced to account after login

## Future Improvements

1. Implement remaining game features (see `todo.md`)
2. Add real-time multiplayer support via Firebase Realtime Database
3. Optimize Firestore queries with proper indexing
4. Implement advanced caching strategies
5. Add analytics integration
6. Performance optimization for 60 FPS gameplay

## Security Considerations

1. **Firebase Rules**: Configure Firestore security rules to restrict user data access
2. **API Keys**: Keep Firebase config in `.env` file, never commit to repository
3. **OAuth Secrets**: Store server OAuth secrets securely
4. **Database Credentials**: Use environment variables for MySQL connection
5. **CORS**: Server CORS policy configured for development; restrict in production

## Deployment

### Pre-deployment Checklist

- [ ] All environment variables configured
- [ ] Firebase security rules reviewed
- [ ] Database migrations applied
- [ ] API endpoints tested
- [ ] Performance profiling completed
- [ ] Error handling verified

### Build Commands

```bash
# Build for production
pnpm build

# Generate APK (Android)
eas build --platform android

# Generate IPA (iOS)
eas build --platform ios
```
