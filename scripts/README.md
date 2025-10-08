# Scripts Directory

## Competition Management Scripts

### check-competition-markers.sh
**Purpose**: Find all competition-related temporary code markers and files

**Usage**:
```bash
./scripts/check-competition-markers.sh
```

**When to use**:
- During development to verify all temporary components are marked
- Before removing competition components to ensure nothing is missed
- Periodic checks during the competition period

**Output**:
- Lists all files with `[TEMPORARY - October 2025 Competition]` markers
- Shows competition files that exist
- Identifies competition routes in vercel.json
- Searches for competition-related code references

---

### remove-competition-components.sh
**Purpose**: Automated cleanup of all October 2025 Competition temporary components

**Usage**:
```bash
./scripts/remove-competition-components.sh
```

**⚠️ IMPORTANT**: Only run this AFTER October 31, 2025!

**What it does**:
1. Creates a removal branch: `remove-october-2025-competition`
2. Removes all competition files:
   - `public/leaderboard.html`
   - `charts/top-zombie-challenge-october-2025.html`
3. Reverts `vercel.json` to remove leaderboard route
4. Archives all competition data to `archive/competitions/october-2025/`
5. Checks for remaining markers
6. Creates a cleanup commit

**After running**:
- Review changes with `git diff main`
- Test the application thoroughly
- If everything looks good:
  ```bash
  git checkout main
  git merge remove-october-2025-competition
  git push origin main
  git branch -d top-zombie-challenge-october-2025
  git push origin --delete top-zombie-challenge-october-2025
  ```

---

## Other Scripts

### fetch-leaderboard-profiles.js
**Purpose**: Fetch Nostr profile data for leaderboard participants

**Usage**:
```bash
node scripts/fetch-leaderboard-profiles.js
```

**Note**: This script is used for the competition leaderboard and may be removed after October 31, 2025 if no longer needed.

---

## Related Documentation

- `/COMPETITION-OCTOBER-2025.md` - Complete competition tracking document
- Competition details, files to remove, code markers, and removal checklist
