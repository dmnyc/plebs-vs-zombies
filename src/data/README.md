# Well-Known Profiles

This directory contains data files for the application.

## wellKnownProfiles.json

**⚠️ DEPRECATED**: This cache is currently used as a fallback, but will likely be removed once Vertex API integration is complete. We now use Primal's cache API as the primary search method.

A curated list of popular Nostr profiles that are prioritized in search results.

### Why This Exists

Nostr relays only return the most recent profile metadata events (usually ~6,000-7,000 events). Popular profiles that haven't updated their metadata recently won't appear in relay search results. This list ensures well-known accounts are always findable.

### Format

Each entry includes:
- `npub`: The profile's npub identifier
- `names`: Array of search terms that should match this profile (lowercase)
- `note`: Optional description of who this person is

### Example

```json
{
  "npub": "npub1q3sle0kvfsehgsuexttt3ugjd8xdklxfwwkh559wxckmzddywnws6cd26p",
  "names": ["alex gleason", "alex", "gleason"],
  "note": "Soapbox, Ditto developer"
}
```

### How to Add a Profile

1. Find the user's npub (from their Nostr profile or nip05)
2. Add an entry to the JSON array
3. Include their common name variations in the `names` array (all lowercase)
4. Add a brief note about who they are
5. Test by searching for them in the app
6. Submit a PR!

### Guidelines

- Only add genuinely well-known Nostr community members
- Include prominent developers, Bitcoin advocates, and influential users
- Names should be lowercase for case-insensitive matching
- Include common variations (e.g., "jack", "jack dorsey")
- Keep the list focused - not everyone needs to be here

### Updating the List

We have a script that fetches trending profiles from nostr.band:

```bash
npm run update-profiles
# or
node scripts/fetch-well-known-profiles.js
```

This will:
1. Fetch trending profiles from nostr.band API (~50 profiles due to API pagination limitations)
2. Process and clean the profile names (removes emojis, extracts usernames)
3. Combine with ~20 critical well-known profiles (hardcoded in the script)
4. Generate a new `wellKnownProfiles.json` file with ~70 profiles
5. Fall back to a manual list if the API is unavailable

**Note**: The nostr.band trending API currently has broken pagination - it returns the same 50 profiles regardless of offset parameter. Until this is fixed, we rely on a curated list of critical profiles combined with the 50 trending ones.

#### Automated Updates

We use **GitHub Actions** to automatically update the list monthly:
- Runs on the 1st of each month at 3am UTC
- Creates a PR with the updated profiles
- You can also trigger manually from the GitHub Actions tab

This means the list stays fresh without manual intervention!

### Finding Popular Profiles Manually

- [Nostr.band Top Profiles](https://nostr.band/stats/profile)
- [Primal Explore](https://primal.net/explore)
- [Nostr.directory](https://nostr.directory)
- The Plebs vs Zombies Competition Leaderboard
