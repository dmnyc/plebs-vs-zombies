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
- [ ] `/public/competition.html` - Competition details and prizes page ✅ MARKED
- [ ] `/scripts/fetch-leaderboard-profiles.js` - Leaderboard data fetcher (competition data source)

### Documentation
- [ ] `/COMPETITION-OCTOBER-2025.md` - This file

---

## In-App Components to Remove

### Components Requiring Code Removal

#### 1. Competition Banners in Purge Celebration Modal ✅ MARKED
**Location**: `/src/components/ZombiePurgeCelebration.vue`
**Purpose**:
- Banner 1 (lines 85-105): Shows BEFORE posting - encourages participation
- Banner 2 (lines 150-170): Shows AFTER posting - confirms entry
**Removal**: Delete both marked code blocks
**Marker**: `[TEMPORARY - October 2025 Competition]`
**Note**: Banners toggle based on `posted` state

#### 2. Competition Details Page ✅ MARKED
**Location**: `/public/competition.html`
**Purpose**: Display competition rules, prizes, and sponsor info
**Removal**: Delete entire file

---

## Routing Changes to Revert

### Vercel Configuration
**File**: `/vercel.json` ✅ MARKED

**Current temporary routes** (lines 6-16):
```json
// [TEMPORARY - October 2025 Competition] START
// Remove these routes after October 31, 2025
{
  "source": "/leaderboard",
  "destination": "/leaderboard.html"
},
{
  "source": "/competition",
  "destination": "/competition.html"
}
// [TEMPORARY - October 2025 Competition] END
```

**Action**: Remove these rewrite rules after October 31, 2025
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

---

## Implementation Summary

### What Was Added

1. **Competition Details Page** (`/public/competition.html`)
   - Complete competition information
   - Prize tiers (100,000 sats total)
   - Sponsor section with Rizful logo
   - Rules and how to enter
   - Links to leaderboard and main app
   - Fully marked with temporary markers

2. **Purge Celebration Banners** (`/src/components/ZombiePurgeCelebration.vue`)
   - Pre-post banner: Encourages users to enter competition (shown before posting)
   - Post-post banner: Confirms entry and shows kill count (shown after posting)
   - Both link to competition details page
   - Banners toggle based on `posted` state
   - Marked with temporary comment blocks

3. **Helper Scripts**
   - `check-competition-markers.sh` - Find all competition code
   - `remove-competition-components.sh` - Automated cleanup
   - Scripts documentation in `/scripts/README.md`

4. **Documentation**
   - This comprehensive tracking document
   - Updated vercel.json with temporary markers
   - Updated leaderboard files with markers

### Verification

Run verification script:
```bash
./scripts/check-competition-markers.sh
```

Expected markers found:
- ✅ `src/components/ZombiePurgeCelebration.vue` (lines 130-150)
- ✅ `public/competition.html` (header comment)
- ✅ `public/leaderboard.html` (header comment)
- ✅ `charts/top-zombie-challenge-october-2025.html` (header comment)
- ✅ `vercel.json` (lines 6-12)

### Sponsor Information

- **Sponsor**: Rizful
- **npub**: npub1jluy3twvf338v6zlujzzdhjkzjy8ezj34ksydr8vw8a6jwp89ygshpp2kq
- **Logo**: `/public/rizful_logo_white.png`
- **Prize Pool**: 100,100 sats across top 10 hunters
  - 1st: 42,000 sats
  - 2nd: 21,000 sats
  - 3rd: 14,000 sats
  - 4th: 8,400 sats
  - 5th: 4,200 sats
  - 6th-10th: 2,100 sats each

### Eligibility Rules
- **Only zombie kills from personal purges count**
- Users must be logged in and purge their own follow list
- Must share purge results to Nostr using "Post to Nostr" button
- Scout Mode results are NOT eligible

---

**Last Updated**: October 8, 2025
**Next Review**: October 31, 2025 (Competition End)
**Responsible**: Development Team
**Status**: ✅ Fully Implemented & Documented
