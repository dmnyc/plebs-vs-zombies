# Development Notes - Plebs vs. Zombies

## Session: October 8, 2025

### Top Zombie Challenge Leaderboard Update - RECORD SHATTERED!

**Branch**: main
**Status**: Completed, ready to commit and push

### Changes Made

#### Leaderboard Update with Record-Breaking Entry
**New Champion**: The Bitcoin Street Journal with 1,466 zombie kills - the highest score ever recorded!

**Files Modified**:
1. `/scripts/fetch-leaderboard-profiles.js`
   - Added The Bitcoin Street Journal at top of participant list
   - Updated to 27 total participants
   - Successfully fetched all 27 profiles from Nostr relays (100% success rate)

2. `/public/leaderboard.html`
   - Updated participants array with new champion and enriched profile data
   - Total zombies killed across all participants: 3,602
   - Leaderboard automatically sorts by kill count

**Top 10 Current Standings**:
1. The Bitcoin Street Journal - 1,466 kills (NEW RECORD! 🔥)
2. Antihumano - 320 kills
3. Undisciplined - 249 kills
4. inpc - 242 kills
5. n0>1 - 207 kills
6. Sergio - 191 kills
7. StellarStoic - 160 kills
8. Shirley Baby - 126 kills
9. negr0 - 97 kills
10. SuiGenerisJohn - 97 kills

**Profile Data Enriched**:
- All 27 participants have complete Nostr profile data
- Includes: display names, NIP-05 addresses, profile pictures
- Source: Multiple Nostr relays (relay.damus.io, relay.nostr.band, nos.lol, relay.primal.net, nostr.wine)

**Special Note**:
- Champion npub1qnmamgyup683z9ehn40jrdgryjhn8qlpntwzqsrk8r80n3xspdrq4r245g pledges to contribute winnings to npub1lrnvvs6z78s9yjqxxr38uyqkmn34lsaxznnqgd877j4z2qej3j5s09qnw5

#### Social Post Created
Breaking news announcement ready to share:
- Highlights the astonishing 1,466 kill record
- Notes the verification (6,961 follows checked)
- Full top 10 with nostr: tags for mentions
- Prize pool information (97,000+ sats)
- Mentions the generous donation pledge
- Link to full leaderboard

### Next Steps

1. **Commit changes**:
   ```bash
   git add scripts/fetch-leaderboard-profiles.js public/leaderboard.html dev-notes.md
   git commit -m "Update leaderboard with record-breaking 1466 kills

   - Add The Bitcoin Street Journal as new champion with 1,466 zombie kills
   - Update total participants to 27 with enriched Nostr profile data
   - Total zombies killed: 3,602
   - All profiles successfully fetched (100% success rate)

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>"
   ```

2. **Push to production**:
   ```bash
   git push origin main
   ```

3. **Share social post** on Nostr with the announcement text

### Technical Details

**Leaderboard Stats**:
- Total participants: 27
- Profiles found: 27/27 (100%)
- Total zombies killed: 3,602
- Highest score: 1,466 (21.06% zombie rate based on 6,961 follows)
- Display limit: 50 participants max

**Profile Fetch Process**:
- Script: `/scripts/fetch-leaderboard-profiles.js`
- Connects to 5 Nostr relays
- Fetches kind 0 (profile metadata) events
- Enriches with display_name, name, nip05, picture
- Outputs formatted JavaScript array ready for HTML

**Leaderboard Hosting**:
- Live at: https://plebsvszombies.cc/leaderboard
- Static HTML served from `/public/leaderboard.html`
- Vercel routing configured in `vercel.json`

### Files Modified This Session
- `/scripts/fetch-leaderboard-profiles.js` - Added new champion to participant list
- `/public/leaderboard.html` - Updated with enriched profile data for all 27 participants
- `/dev-notes.md` - This file

---
*Session ended: Computer reboot needed*
*Resume: Commit and push leaderboard updates*

---

## Session: September 21, 2025

### Branch: scout-post-fix
Current status: Completed and ready for merge

### Changes Made

#### 1. Scout Mode UI Fixes
**Problem**: Two UI bugs in Scout Mode were preventing smooth user experience

**Fix 1: Social Post Modal Persistence** (`src/views/ScoutModeView.vue:828`)
- **Issue**: After posting a scout report, clicking "Scout Different User" didn't hide the post modal, blocking view of new scan results
- **Solution**: Added `this.showPostModal = false;` to `showScoutNewUser()` method
- **Location**: Line 828 in ScoutModeView.vue

**Fix 2: Start Scouting Button Stalling** (`src/views/ScoutModeView.vue:833-925`)
- **Issue**: "Start Scouting" button in modal would sometimes hang/stall when trying to scout a new user
- **Root Cause**: Async operations (service shutdown, reset, profile fetch) could hang without timeouts
- **Solution**: 
  - Added timeout handling to all async operations:
    - Stop scan: 5 second timeout
    - Service shutdown: 5 second timeout
    - Service reset: 3 second timeout
    - Profile fetch: 8 second timeout
  - Added `processingNewUser` flag to prevent duplicate calls
  - Added visual feedback: button shows "⏳ Processing..." when working
  - Added extensive console logging for debugging
  - Better error handling with specific timeout messages

**Files Modified**:
- `src/views/ScoutModeView.vue`
  - Added `processingNewUser: false` to data (line 654)
  - Updated `showScoutNewUser()` to reset modal state (line 828)
  - Enhanced `scoutNewUser()` with timeout handling (lines 833-925)
  - Updated modal button UI for processing state (lines 89-97)

#### 2. Zombie Score Analytics Chart
Created standalone visualization for Scout Mode data analysis

**Files Created**:
- `/charts/zombie-score-analysis-2025-09-14-to-20.html` - Interactive chart with zombie theme
- `/charts/README-chart-creation.md` - Documentation for creating future charts

**Chart Features**:
- Fully self-contained HTML file (no external dependencies except Chart.js CDN)
- Dark gradient background matching app theme
- Interactive bar chart showing zombie score distribution
- Color-coded bars: Green (low scores) → Red (high scores)
- Zombie-themed styling with Creepster font and emojis (🧟‍♂️ 👁️ 🔍 🏹 💀)
- Animated loading effects
- Summary statistics cards
- Timestamped throughout (filename, page title, headers, footer)

**Chart Data (Sept 14-20, 2025)**:
- Total scans: 40
- Average zombie score: 22%
- Range: 3.0% - 41.0%
- Distribution:
  - 3.0-6.8%: 2 plebs
  - 6.8-10.6%: 5 plebs
  - 10.6-14.4%: 2 plebs
  - 14.4-18.2%: 7 plebs
  - 18.2-22.0%: 1 pleb
  - 22.0-25.8%: 9 plebs
  - 25.8-29.6%: 7 plebs
  - 29.6-33.4%: 3 plebs
  - 33.4-37.2%: 3 plebs
  - 37.2-41.0%: 1 pleb

**GitHub Pages Setup**:
- Enabled GitHub Pages for repo
- Chart accessible at: https://dmnyc.github.io/plebs-vs-zombies/charts/zombie-score-analysis-2025-09-14-to-20.html
- Auto-deploys on push to main branch

**Chart Creation Process** (documented in `/charts/README-chart-creation.md`):
1. Collect Scout Mode scan data over time period
2. Calculate distribution across percentage ranges
3. Copy chart template and update:
   - Date ranges (filename, title, headers)
   - Data arrays (labels and counts)
   - Summary statistics
4. Test locally then push to GitHub
5. GitHub Pages auto-deploys

### Commit Messages

**Scout Mode Fixes** (on scout-post-fix branch):
```
Fix Scout Mode UI issues: modal persistence and button stalling

- Fix social post modal not disappearing when clicking "Scout Different User"
- Add timeout handling to prevent "Start Scouting" button from stalling
- Add visual feedback and duplicate call prevention for new user scouting
- Improve error handling with specific timeout messages

Resolves issues where users couldn't see new scan results due to persistent 
modals and unresponsive UI during user switching operations.
```

**Chart Creation** (on main branch):
- Initial: "Created standalone Zombie Score Chart"
- Update: "Update zombie-score-analysis-2025-09-14-to-20.html" (fixed average from 18.4% to 22%)

### Next Steps

1. **Merge scout-post-fix branch**:
   ```bash
   git checkout main
   git merge scout-post-fix
   git push origin main
   ```

2. **Optional: Clean up branch**:
   ```bash
   git branch -d scout-post-fix
   git push origin --delete scout-post-fix
   ```

3. **Future Chart Updates**:
   - Follow process in `/charts/README-chart-creation.md`
   - Use existing chart as template
   - Update date ranges and data
   - Push to GitHub for auto-deployment

### Technical Notes

**Scout Mode Architecture**:
- Main component: `src/views/ScoutModeView.vue`
- Service layer: `src/services/scoutService.js`
- Uses NDK for Nostr profile fetching
- Implements aggressive retry logic for network operations

**Known Considerations**:
- Profile fetching can timeout (8 seconds) if relays are slow
- Service shutdown/reset operations have 3-5 second timeouts
- All timeouts are gracefully handled with error messages
- Processing flag prevents concurrent scout operations

**Dev Environment**:
- Branch: scout-post-fix (ready for merge)
- Multiple dev servers running (can be cleaned up with `killall node` if needed)
- Git status: clean, all changes committed

### Files to Review Before Merge
- `src/views/ScoutModeView.vue` - Main Scout Mode component with UI fixes
- `charts/zombie-score-analysis-2025-09-14-to-20.html` - Data visualization
- `charts/README-chart-creation.md` - Chart creation documentation

---
*Session ended: Computer restart needed*
*Resume: Merge scout-post-fix branch when ready*