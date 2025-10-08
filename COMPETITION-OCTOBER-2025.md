# Top Zombie Challenge - October 2025

**Competition Period**: October 1-31, 2025
**Branch**: `top-zombie-challenge-october-2025`
**Status**: Active

## ⚠️ TEMPORARY COMPONENTS - REMOVE AFTER OCTOBER 31, 2025

This document tracks all temporary in-app components and files added for the October 2025 Top Zombie Challenge competition. All items marked with `[TEMPORARY]` must be removed or reverted after the competition concludes.

---

## 🛠️ Helper Scripts

### Check Competition Markers
Find all competition-related code and files:
```bash
./scripts/check-competition-markers.sh
```

### Remove Competition Components (After Oct 31)
Automated cleanup script:
```bash
./scripts/remove-competition-components.sh
```

⚠️ Only run the removal script AFTER the competition ends!

---

## Files to Remove After Competition

### Leaderboard Files
- [ ] `/public/leaderboard.html` - Main leaderboard page (October 2025 version) ✅ MARKED
- [ ] `/charts/top-zombie-challenge-october-2025.html` - Competition chart/redirect page ✅ MARKED
- [ ] `/scripts/fetch-leaderboard-profiles.js` - Leaderboard data fetcher (competition data source)

### Documentation
- [ ] `/COMPETITION-OCTOBER-2025.md` - This file

---

## In-App Components to Remove

### Components Requiring Code Removal

#### 1. Competition Banner/Notification
**Location**: TBD
**Purpose**: Display competition info to users
**Removal**: Delete component and all references

#### 2. Leaderboard Link in Navigation
**Location**: TBD
**Purpose**: Link to competition leaderboard
**Removal**: Remove navigation item

#### 3. Competition-specific Modals/Popups
**Location**: TBD
**Purpose**: Competition announcements/rules
**Removal**: Delete modal components

---

## Routing Changes to Revert

### Vercel Configuration
**File**: `/vercel.json` ✅ MARKED

**Current temporary routes** (lines 6-12):
```json
// [TEMPORARY - October 2025 Competition] START
// Remove this route after October 31, 2025
{
  "source": "/leaderboard",
  "destination": "/leaderboard.html"
}
// [TEMPORARY - October 2025 Competition] END
```

**Action**: Remove this rewrite rule after October 31, 2025
**Verification**: Run `./scripts/check-competition-markers.sh` to confirm
**Automated Removal**: `./scripts/remove-competition-components.sh` handles this

---

## Code Markers

All temporary code should be marked with comments:

```javascript
// [TEMPORARY - October 2025 Competition] START
// This code is for the Top Zombie Challenge competition
// Remove after October 31, 2025
const showCompetitionBanner = true;
// [TEMPORARY - October 2025 Competition] END
```

```vue
<!-- [TEMPORARY - October 2025 Competition] START -->
<CompetitionBanner v-if="competitionActive" />
<!-- [TEMPORARY - October 2025 Competition] END -->
```

---

## Removal Checklist - After October 31, 2025

### Automated Removal (Recommended)

**Run the automated cleanup script:**
```bash
./scripts/remove-competition-components.sh
```

This script will:
- Create a removal branch
- Remove all competition files
- Revert vercel.json changes
- Archive competition data
- Create a commit with all changes

### Manual Removal (Alternative)

If you prefer manual removal:

#### Pre-Removal
- [ ] Backup competition data/statistics
- [ ] Archive leaderboard final standings
- [ ] Export any analytics/metrics
- [ ] Screenshot final leaderboard for records

#### Code Cleanup
- [ ] Run `./scripts/check-competition-markers.sh` to find all markers
- [ ] Remove all marked code blocks
- [ ] Remove files listed in "Files to Remove" section
- [ ] Revert routing changes in vercel.json (lines 6-12)
- [ ] Remove competition-specific dependencies (if any)
- [ ] Update navigation to remove leaderboard links

#### Testing
- [ ] Test app functionality after removal
- [ ] Verify no broken links or references
- [ ] Check navigation flows correctly
- [ ] Ensure no console errors

#### Git Cleanup
- [ ] Create removal branch: `remove-october-2025-competition`
- [ ] Commit all cleanup changes
- [ ] Test thoroughly
- [ ] Merge to main
- [ ] Delete competition branch: `top-zombie-challenge-october-2025`

---

## Competition Details

### Prize Pool
- Total: 97,000+ sats
- Distribution: TBD

### Participants
- Tracked in `/public/leaderboard.html`
- Updated via `/scripts/fetch-leaderboard-profiles.js`

### Current Leader
- See live leaderboard at: https://plebsvszombies.cc/leaderboard

---

## Development Notes

### Adding Temporary Features
1. Always mark with `[TEMPORARY - October 2025 Competition]` comments
2. Document in this file under appropriate section
3. Keep changes modular and easy to remove
4. Avoid deep integration with core features

### Best Practices
- Prefer feature flags over conditional compilation
- Use separate components rather than modifying existing ones
- Keep competition logic isolated
- Document all changes thoroughly

---

## Archive Location (After Removal)

Final competition data will be archived in:
- `/archive/competitions/october-2025/`
  - Final leaderboard snapshot
  - Statistics and analytics
  - Screenshots and media
  - Participant list

---

**Last Updated**: October 8, 2025
**Next Review**: October 31, 2025 (Competition End)
**Responsible**: Development Team
