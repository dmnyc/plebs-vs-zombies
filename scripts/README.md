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

## Follow List Cleaner Tools

Tools to diagnose and fix invalid pubkeys in your Nostr follow list.

### Quick Start

**1. Analyze your follow list (no changes):**
```bash
node scripts/analyze-follow-list.js npub1yourpubkey...
```

**2. Export a cleaned version (Plebs vs Zombies compatible):**
```bash
node scripts/analyze-follow-list.js npub1yourpubkey... --clean --export
```
This creates a JSON file you can import at https://plebsvszombies.cc

**3. Republish your follow list to all relays (fixes inconsistency):**
```bash
node scripts/republish-follow-list.js nsec1yourprivkey...
```

**4. Clean and republish automatically:**
```bash
NOSTR_NSEC=nsec1yourkey... node scripts/clean-follow-list.js npub1yourpubkey... --backup
```

### Full Documentation

See [docs/FOLLOW-LIST-CLEANER.md](../docs/FOLLOW-LIST-CLEANER.md) for complete documentation including:
- How the tools work
- Step-by-step workflow
- Understanding the output
- Troubleshooting
- Advanced usage

### Why Use These Tools?

If you've received a message about invalid pubkeys in your follow list, or if you're experiencing:
- Different follow counts in different Nostr clients
- Errors when viewing your follows
- Sync issues between apps
- Apps failing to load your contact list
- Different relays serving different versions of your follow list

These tools can help identify and fix the problem.

### republish-follow-list.js

**Purpose**: Republish your most recent follow list to all configured relays to ensure consistency.

**Usage**:
```bash
node scripts/republish-follow-list.js <nsec-or-hex-privkey>
```

**Example**:
```bash
node scripts/republish-follow-list.js nsec1abc...
```

**What it does**:
1. Derives your public key from your private key
2. Fetches your NIP-65 relay list to find YOUR configured relays
3. Connects to YOUR relays (not generic defaults)
4. Fetches your most recent follow list
5. Shows you the details (number of follows, creation date, etc.)
6. Asks for confirmation before proceeding
7. Signs a new event with the same follows but updated timestamp
8. Publishes to YOUR write-capable relays
9. Verifies that the event was received by each relay
10. Reports success/failure for each relay

**When to use**:
- When `analyze-follow-list.js` shows multiple versions across relays
- After recovering from a relay outage
- When adding new relays to your configuration
- If some clients show outdated follow lists

**Safety features**:
- Shows what will be published before signing
- Requires explicit confirmation (yes/no prompt)
- Verifies publication across all relays
- Does not modify your follow list content
- Only updates the timestamp

**⚠️ Security Note**: Your private key (nsec) is required to sign the event. The key is used only for signing and is never stored or transmitted except to create the signature.

### test-relay-response.js

**Purpose**: Test a specific relay's response to your follow list event and capture detailed diagnostic information.

**Usage**:
```bash
node scripts/test-relay-response.js <relay-url> <nsec>
```

**Example**:
```bash
node scripts/test-relay-response.js wss://nostr.bitcoiner.social nsec1abc...
```

**What it does**:
1. Fetches your most recent follow list
2. Creates a new event with updated timestamp
3. Connects directly to the specified relay via WebSocket
4. Sends the EVENT message
5. Captures and displays the raw relay response
6. Shows OK/NOTICE messages with detailed information
7. Reports event size and number of tags

**When to use**:
- To diagnose why a specific relay is rejecting your events
- To see the exact error message from a relay
- To verify if a relay silently rejects large events
- To test if relay configuration changes worked

**Output includes**:
- Raw WebSocket messages
- OK message breakdown (accepted: true/false, reason)
- NOTICE messages from the relay
- Event size in bytes and KB
- Number of tags

**Example output**:
```
📥 Response from relay:
   Raw: ["OK","d1a61f88...","false","error: event too large"]
   Type: OK
   Event ID: d1a61f88...
   Accepted: false
   Message: error: event too large
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
