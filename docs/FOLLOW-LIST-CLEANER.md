# Follow List Cleaner Tools

This documentation covers the follow list diagnostic and cleaning tools to help fix issues with invalid pubkeys and inconsistent contact lists across Nostr relays.

## The Problem

When you have invalid entries in your Nostr follow list (kind 3 events), it can cause issues:

1. **Invalid pubkeys** - Non-hex values, wrong length, or empty entries in your "p" tags
2. **Multiple versions** - Different relays serving different versions of your contact list
3. **Client compatibility** - Some clients may fail when encountering invalid data

These issues happen when:
- Manual editing introduces errors
- Corrupted data gets published
- Relay synchronization problems
- Client bugs that publish malformed events

## Available Tools

### 1. Analyze Follow List (`analyze-follow-list.js`)

**Purpose**: Diagnose your follow list and identify problems without making changes.

**Usage**:
```bash
# Basic analysis
node scripts/analyze-follow-list.js npub1...

# or with hex pubkey
node scripts/analyze-follow-list.js ee6ea13ab9fe5c4a68eaf9b1a34fe014a66b40117c50ee2a614f4cda959b6e74

# Show cleaned version (no publishing)
node scripts/analyze-follow-list.js npub1... --clean

# Export cleaned version to JSON (Plebs vs Zombies compatible format)
node scripts/analyze-follow-list.js npub1... --clean --export

# Show detailed tag information
node scripts/analyze-follow-list.js npub1... --verbose
```

**What it does**:
- Fetches all your contact list events from 13+ major relays
- Validates each pubkey (must be 64 hex characters)
- Identifies invalid entries with reasons
- Compares different versions across relays
- Provides recommendations
- Shows debug tool links
- **Exports cleaned list in Plebs vs Zombies compatible format** - can be imported directly on the website!

**Example Output**:
```
🔍 Follow List Analyzer
════════════════════════════════════════════════════════════

👤 Analyzing follow list for:
   npub: npub1ae...
   hex:  ee6ea13ab9fe5c4a...

📊 Summary:
   Total events found: 13
   Unique versions: 3

📋 Version 1 (Most Recent ✨)
   Valid follows: 1847
   Invalid entries: 12 ⚠️
   Other tags: 45

   ⚠️  Invalid Entries Detected:
      1. "nostr:npub1abc..."
         Reason: Wrong length (68 chars instead of 64)
      2. "(empty)"
         Reason: Empty pubkey

💡 Recommendations:
   ⚠️  ISSUE: Your follow list contains 12 invalid entries
```

### 2. Clean Follow List (`clean-follow-list.js`)

**Purpose**: Remove invalid entries and republish a clean contact list to all relays.

**Usage**:
```bash
# Dry run (show what would happen)
node scripts/clean-follow-list.js npub1... --dry-run

# Clean with backup
NOSTR_NSEC=nsec1... node scripts/clean-follow-list.js npub1... --backup

# Clean with auto-approval (no prompt)
NOSTR_NSEC=nsec1... node scripts/clean-follow-list.js npub1... --yes --backup

# Full example with all options
NOSTR_NSEC=nsec1yourprivatekey... \
  node scripts/clean-follow-list.js npub1yourpubkey... \
  --backup --yes
```

**What it does**:
- Fetches your most recent contact list
- Identifies and removes invalid pubkeys
- **Preserves** all other tags (topics, relay hints, etc.)
- **Preserves** the content field
- Creates a **Plebs vs Zombies compatible backup** JSON file (if `--backup` flag)
- Shows you exactly what will change
- Asks for confirmation (unless `--yes` flag)
- Signs and publishes the cleaned list to all relays

**Options**:
- `--dry-run` - Show changes without publishing
- `--backup` - Save original to JSON file
- `--yes` - Skip confirmation prompt

**Signing**:
This script requires signing capability. You must set the `NOSTR_NSEC` environment variable:

```bash
export NOSTR_NSEC=nsec1yourprivatekeyhere...
node scripts/clean-follow-list.js npub1...
```

**Security Note**: Never share your nsec with anyone. The scripts only use it locally for signing.

## Workflow

### Step 1: Analyze (Diagnose the Problem)

```bash
node scripts/analyze-follow-list.js npub1ae6ea13ab9fe5c4a68eaf9b1a34fe014a66b40117c50ee2a614f4cda959b6e74
```

This will show you:
- How many invalid entries you have
- What's wrong with each one
- Whether you have multiple versions across relays

### Step 2: Test Clean (See What Would Happen)

```bash
node scripts/clean-follow-list.js npub1... --dry-run
```

This shows exactly what would be removed without making any changes.

### Step 3: Backup and Clean

```bash
NOSTR_NSEC=nsec1... node scripts/clean-follow-list.js npub1... --backup
```

This will:
1. Create a backup JSON file
2. Show you the changes
3. Ask for confirmation
4. Sign and publish the cleaned list

### Step 4: Verify

After cleaning, run the analyzer again:

```bash
node scripts/analyze-follow-list.js npub1...
```

You should see:
```
✅ Your follow list looks healthy!
   - No invalid pubkeys detected
   - Consistent across relays
   - 1847 valid follows
```

## Understanding the Output

### Valid Pubkey

A valid Nostr pubkey must be:
- Exactly 64 characters long
- Contain only hexadecimal characters (0-9, a-f, A-F)
- Example: `ee6ea13ab9fe5c4a68eaf9b1a34fe014a66b40117c50ee2a614f4cda959b6e74`

### Invalid Entries

Common reasons for invalid entries:

1. **Wrong length**: `nostr:npub1...` (68+ chars) - prefix should not be in pubkey field
2. **Not hex**: Contains non-hex characters
3. **Empty**: No pubkey value in the tag
4. **Partial**: Truncated or corrupted pubkey

### Other Tags

Your contact list may include other types of tags:
- `t` tags: Topic/hashtag interests
- `r` tags: Relay recommendations
- `relay` tags: Preferred relays for contacts

**These are preserved** by the cleaner - only invalid `p` (pubkey) tags are removed.

## Troubleshooting

### "No signing method available"

Set your private key:
```bash
export NOSTR_NSEC=nsec1yourkey...
```

Or use the web interface at plebsvszombies.cc which can use browser extensions.

### "No contact list found"

- Double-check your npub/pubkey is correct
- Make sure you've published a contact list before (kind 3 event)
- Try using a different npub encoding of your pubkey

### "Published to 0 relays"

- Check your internet connection
- Some relays may be temporarily down
- The script tries 13+ relays, at least some should succeed

### "Signer pubkey doesn't match target pubkey"

The nsec you provided doesn't match the npub you're trying to clean.
Make sure you're using the correct private key for your account.

## Advanced Usage

### Custom Relay List

Edit the `RELAYS` array in either script to use your preferred relays:

```javascript
const RELAYS = [
  'wss://relay.damus.io',
  'wss://your-custom-relay.com',
  // ... more relays
];
```

### Automated Cleaning

For automation (CI/CD, cron jobs):

```bash
#!/bin/bash
# Auto-clean follow list script

export NOSTR_NSEC="nsec1..."
NPUB="npub1..."

node scripts/analyze-follow-list.js $NPUB --clean --export

# Only clean if issues found
if node scripts/analyze-follow-list.js $NPUB | grep -q "invalid entries"; then
  node scripts/clean-follow-list.js $NPUB --backup --yes
fi
```

### Backup Recovery

All exported JSON files are in **Plebs vs Zombies compatible format** and can be imported directly on the website:

1. Go to https://plebsvszombies.cc
2. Sign in with your Nostr identity
3. Navigate to Backup Manager
4. Click "Import Backup"
5. Select your JSON file

**JSON Format**:
```json
{
  "pubkey": "ee6ea13ab9fe5c4a...",
  "npub": "npub1ae...",
  "timestamp": 1733097600000,
  "createdAt": 1733097600000,
  "followCount": 1847,
  "follows": [
    "hex_pubkey_1...",
    "hex_pubkey_2...",
    ...
  ],
  "notes": "Cleaned follow list - removed 12 invalid entries",
  "_metadata": {
    "originalEventId": "abc123...",
    "removedInvalid": 12,
    "invalidEntriesRemoved": [...],
    "cleanedBy": "analyze-follow-list.js",
    "cleanedAt": "2024-12-01T12:00:00.000Z"
  }
}
```

The `_metadata` field contains additional diagnostic information but is not required for import.

## Debug Tools

The analyzer provides links to external debug tools:

1. **nostrdebug.com** - Query your contact lists across relays
2. **njump.me** - View your latest contact list event

Use these to verify the cleaning worked across the network.

## Safety

These scripts:
- ✅ Only remove invalid pubkeys
- ✅ Preserve all valid follows
- ✅ Preserve all other tags (topics, relays, etc.)
- ✅ Preserve the content field
- ✅ Show you changes before publishing
- ✅ Support dry-run mode
- ✅ Support backup creation
- ✅ Work locally (your keys never leave your machine)

## Related Issues

If you're experiencing:
- Different follow counts in different clients
- Missing follows
- Sync issues between apps
- Errors when viewing follows

These tools can help identify and fix the underlying data quality issues.

## Support

For issues or questions:
- GitHub Issues: https://github.com/dmnyc/plebs-vs-zombies/issues
- Website: https://plebsvszombies.cc

## License

MIT
