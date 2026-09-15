# Relay Settings Storage Implementation Plan (NIP-78)

## Overview

Implement persistent relay storage for Plebs vs Zombies settings using NIP-78 (Application-specific Data), similar to Mutable's implementation. This will enable multi-device synchronization of all user preferences and settings.

## Goals

1. **Cross-device sync** - Save settings to Nostr relays for access from any browser/device
2. **Auto-publish** - All settings changes automatically sync to relays
3. **Encrypted backups** - Store 1-3 most recent backups in encrypted format
4. **Recovery** - Users can retrieve settings even after losing local browser storage
5. **Non-blocking** - Sync operations don't prevent app usage

## Settings to Sync

### 1. Zombie Classification Settings
**D-tag**: `plebs-vs-zombies:zombie-classification`
**Encryption**: No (non-sensitive scoring rules)
**Structure**:
```typescript
{
  version: 1,
  timestamp: number,
  settings: {
    inactivityPenalty: number,        // Default: 10
    postFrequencyWeight: number,      // Default: 5
    followerRatioWeight: number,      // Default: 3
    contentQualityWeight: number,     // Default: 8
    zombieThreshold: number,          // Default: 30
    enableAdvancedScoring: boolean    // Default: false
  }
}
```

### 2. Scan Settings
**D-tag**: `plebs-vs-zombies:scan-settings`
**Encryption**: No
**Structure**:
```typescript
{
  version: 1,
  timestamp: number,
  settings: {
    maxFollowsToScan: number,         // Default: 1000
    autoRefreshEnabled: boolean,      // Default: false
    refreshIntervalMinutes: number,   // Default: 60
    showOnlyZombies: boolean,         // Default: false
    sortBy: 'score' | 'name' | 'date' // Default: 'score'
  }
}
```

### 3. Batch Settings
**D-tag**: `plebs-vs-zombies:batch-settings`
**Encryption**: No
**Structure**:
```typescript
{
  version: 1,
  timestamp: number,
  settings: {
    batchSize: number,                // Default: 50
    delayBetweenBatches: number,      // Default: 2000 (ms)
    autoConfirm: boolean,             // Default: false
    preserveImportantFollows: boolean // Default: true
  }
}
```

### 4. Relay Configuration
**D-tag**: `plebs-vs-zombies:relay-config`
**Encryption**: No
**Structure**:
```typescript
{
  version: 1,
  timestamp: number,
  relays: string[],                   // Manual relay list
  useNIP65: boolean,                  // Use NIP-65 relay list if available
  preferredRelays: string[]           // Preferred relays for this app
}
```

### 5. Immunity Lists (Protected Users)
**D-tag**: `plebs-vs-zombies:immunity-list`
**Encryption**: Yes (NIP-04)
**Structure**:
```typescript
{
  version: 1,
  timestamp: number,
  immuneUsers: [{
    pubkey: string,
    addedAt: number,
    reason?: string,
    npub?: string                     // For convenience
  }]
}
```

### 6. App Preferences
**D-tag**: `plebs-vs-zombies:preferences`
**Encryption**: No
**Structure**:
```typescript
{
  version: 1,
  timestamp: number,
  preferences: {
    theme?: 'light' | 'dark',
    hasCompletedOnboarding?: boolean,
    showWelcomeModal?: boolean,
    language?: string,
    [key: string]: unknown
  }
}
```

## Encrypted Backups

### Backup Structure
**D-tag**: `plebs-vs-zombies:backup-{timestamp}`
**Encryption**: Yes (NIP-04)
**Purpose**: Store complete snapshots for recovery

```typescript
{
  version: 1,
  timestamp: number,
  backupData: {
    zombieClassification: {...},
    scanSettings: {...},
    batchSettings: {...},
    relayConfig: {...},
    immunityList: {...},
    preferences: {...}
  },
  metadata: {
    deviceInfo?: string,
    appVersion?: string,
    backupReason: 'manual' | 'auto' | 'pre-delete'
  }
}
```

### Backup Strategy
1. **Keep 3 most recent backups** - Delete older backups automatically
2. **Auto-backup triggers**:
   - Major settings change (e.g., immunity list modification)
   - Before bulk unfollow operation
   - Manual backup via Settings UI
3. **Backup naming**: Use timestamp in d-tag for sorting
4. **Recovery**: List available backups, allow user to restore

## Architecture

### Core Components

#### 1. `relayStorage.js`
Low-level NIP-78 implementation
- Publishes kind:30078 events with app-specific d-tags
- Handles encryption/decryption using NIP-04
- Fetches and syncs data from relays

#### 2. `syncManager.js`
Coordination service
- Orchestrates syncing across all data types
- Provides status tracking and error reporting
- Exposes unified API for sync operations
- Manages backup creation and cleanup

#### 3. Service Layer
Data-specific services:
- `zombieClassificationService.js`
- `scanSettingsService.js`
- `batchSettingsService.js`
- `relayConfigService.js`
- `immunityListService.js`
- `preferencesService.js`
- `backupService.js` (enhanced with relay backup)

#### 4. Vue Composable: `useRelaySync.js`
React-style hook for Vue 3 Composition API
- Provides relay-aware methods for components
- Auto-publishes changes after modifications
- Simplifies integration

#### 5. Integration Points
- Trigger automatic sync on login (in `nostrService.js`)
- Sync on session restore
- Fire-and-forget approach (non-blocking)

### Data Flow

```
User Action (e.g., change zombie threshold)
    ↓
Component calls useRelaySync composable
    ↓
Service updates localStorage
    ↓
Service publishes to relay (async, non-blocking)
    ↓
Relay storage updated across devices
```

## Sync Behavior

### Automatic Sync
- **On Login**: After successful NIP-07/NIP-46 connection
- **On Session Restore**: Page reload with existing session
- **On Settings Change**: Any modification to synced settings
- **Non-blocking**: Doesn't prevent user from using the app

### Manual Sync
- "Sync Now" button in Settings page
- Shows real-time sync status
- Displays synced services and any errors

### Conflict Resolution
- **Strategy**: Timestamp-based (newest wins)
- **Process**:
  1. Fetch data from relay
  2. Compare timestamps
  3. Use newer version
  4. Merge if necessary (for additive lists like immunity)
  5. Publish if local is newer

### Offline Behavior
- localStorage serves as offline cache
- Changes are saved locally immediately
- Synced to relay when connection is available
- Queue failed publishes for retry

## Security

### Encrypted Data (NIP-04)
- Immunity lists (contains pubkeys of protected users)
- Backups (complete settings snapshot)
- Encrypted to user's own pubkey (self-encryption)
- Requires NIP-07 extension with nip04 support

### Non-Encrypted Data
- All other settings (zombie scoring, scan settings, etc.)
- Contains non-sensitive configuration data
- Allows for future public statistics or analytics

### Privacy Considerations
- User controls what gets synced
- Option to disable relay sync entirely (local-only mode)
- Clear UI indication when syncing is active
- Ability to delete all relay data

## UI Integration

### Settings Page Enhancements

#### Relay Storage Sync Section
```
┌─ Relay Storage Sync ────────────────────────────┐
│ ● Online                                        │
│ Last synced: 2 minutes ago                      │
│                                                 │
│ Synced Services:                                │
│ ✓ Zombie Classification Settings               │
│ ✓ Scan Settings                                 │
│ ✓ Batch Settings                                │
│ ✓ Relay Configuration                           │
│ ✓ Immunity List (encrypted)                     │
│ ✓ Preferences                                   │
│                                                 │
│ Backups: 3 available                            │
│                                                 │
│ [Sync Now]  [Create Backup]  [Restore Backup]  │
└─────────────────────────────────────────────────┘
```

#### Backup Management
```
┌─ Backups ───────────────────────────────────────┐
│ 📦 Latest Backups (encrypted)                   │
│                                                 │
│ • Dec 7, 2025 2:30 PM (1 hour ago)              │
│   Device: Chrome/MacOS · Auto                   │
│   [Restore] [Delete]                            │
│                                                 │
│ • Dec 7, 2025 10:15 AM (5 hours ago)            │
│   Device: Firefox/Windows · Manual              │
│   [Restore] [Delete]                            │
│                                                 │
│ • Dec 6, 2025 8:00 PM (yesterday)               │
│   Device: Chrome/MacOS · Pre-delete             │
│   [Restore] [Delete]                            │
│                                                 │
│ [Create Manual Backup]                          │
└─────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)
- [ ] Create `relayStorage.js` with NIP-78 implementation
- [ ] Create `syncManager.js` for coordination
- [ ] Implement `useRelaySync.js` composable
- [ ] Add sync trigger to login flow

### Phase 2: Settings Services (Week 1-2)
- [ ] Implement zombie classification settings service
- [ ] Implement scan settings service
- [ ] Implement batch settings service
- [ ] Implement relay config service
- [ ] Implement immunity list service
- [ ] Implement preferences service

### Phase 3: Backup System (Week 2)
- [ ] Enhance `backupService.js` with relay backup
- [ ] Implement backup creation and encryption
- [ ] Implement backup listing and restoration
- [ ] Implement automatic backup cleanup (keep 3)

### Phase 4: UI Integration (Week 2-3)
- [ ] Add Relay Storage Sync section to Settings page
- [ ] Add backup management UI
- [ ] Add sync status indicators
- [ ] Add manual sync/backup buttons
- [ ] Add restore functionality

### Phase 5: Testing & Polish (Week 3)
- [ ] Test multi-device sync
- [ ] Test encryption/decryption
- [ ] Test conflict resolution
- [ ] Test backup/restore
- [ ] Add error handling and retry logic
- [ ] Performance optimization

## Testing Strategy

### Manual Testing Checklist
- [ ] Login triggers automatic sync
- [ ] Page reload restores and syncs data
- [ ] Changing zombie threshold syncs to relay
- [ ] Adding immunity user syncs to relay
- [ ] Manual sync button works
- [ ] Sync status updates correctly
- [ ] Multi-device sync works (same account, different browsers)
- [ ] Offline changes sync when back online
- [ ] Encrypted data is encrypted (check relay events)
- [ ] Non-encrypted data is readable (check relay events)
- [ ] Creating backup works
- [ ] Restoring backup works
- [ ] Old backups are deleted (keep 3 max)

### Automated Testing
- Unit tests for each service
- Integration tests for sync flow
- E2E tests for multi-device scenarios

## Migration Strategy

### Existing Users
1. On first sync, read all current localStorage settings
2. Publish to relay as initial sync
3. Add migration version flag to prevent re-migration
4. Preserve existing data in localStorage as fallback

### New Users
1. Start with default settings
2. Sync immediately on first login
3. No migration needed

## Known Limitations

1. **Large Immunity Lists**: No pagination for very large lists (1000+ users)
2. **Sync Conflicts**: Automatic resolution only (no manual conflict UI initially)
3. **Backup Storage**: Limited to 3 backups (relay storage constraints)
4. **NIP-04 Requirement**: Requires browser extension with encryption support

## Future Enhancements

1. **Selective Sync**: Allow users to choose which settings to sync
2. **Sync Scheduling**: Periodic background sync
3. **Compression**: Compress large datasets before publishing
4. **Delta Sync**: Only sync changes instead of full state
5. **Conflict Resolution UI**: Let users manually resolve conflicts
6. **Export/Import**: Download settings as JSON file
7. **Sharing**: Share settings configurations with others

## References

- [NIP-78: Application-specific Data](https://github.com/nostr-protocol/nips/blob/master/78.md)
- [NIP-04: Encrypted Direct Messages](https://github.com/nostr-protocol/nips/blob/master/04.md)
- [NIP-07: Browser Extension](https://github.com/nostr-protocol/nips/blob/master/07.md)
- [Mutable Relay Storage Implementation](file:///Users/daniel/GitHub/mutable/RELAY_STORAGE.md)

## Success Criteria

✅ Users can access settings from any device after logging in
✅ Settings changes auto-save to relays without user intervention
✅ Users can create and restore from encrypted backups
✅ Sync operations don't block or slow down the app
✅ Multi-device sync works reliably (tested across 2+ devices)
✅ Encrypted data is properly encrypted (verified via relay inspection)
✅ Settings survive browser data clearing

---

*Implementation guided by Mutable's relay storage pattern and adapted for Plebs vs Zombies use cases.*
