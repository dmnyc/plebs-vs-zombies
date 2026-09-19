# Plebs vs. Zombies

A Nostr utility for managing dormant follows and cleaning up your follow list.

Live at [plebsvszombies.cc](https://plebsvszombies.cc)

## About

Over time, the users you follow on Nostr become dormant zombies. Since npubs can never be deleted, it creates a burden for users to carry around all the dead weight of a growing following count that hungrily eats bandwidth (brains in our metaphor!), overwhelming relays whenever we connect to them presenting our bloated follow list filled with so many undead users that refuse to rest in peace.

Plebs vs. Zombies helps you identify and manage these dormant accounts to maintain a healthier follow list.

## Features

- **Zombie Detection**: Scan your follow list to identify accounts with no activity. Any event a user signs counts as proof of life, so lurkers who only react or zap are not mistaken for zombies
- **Customizable Time Thresholds**: Set your own definition of "dormant" (90, 180, 365 days). Accounts that marked themselves deleted are classified separately as "burned"
- **Batch Processing**: Purge zombies in manageable batches
- **Immunity List**: Mark accounts that should never be flagged, no matter how quiet they get
- **Follow List Backup**: Safely back up your existing follow list before making changes
- **Follow List Recovery**: Restore a previous follow list from a backup if a purge went further than you wanted
- **Export Zombie Lists**: Export your zombie lists in JSON or TXT format for sharing or record-keeping
- **Statistics**: Track your zombie hunting progress and bandwidth savings
- **Zombie Check**: Look up any single account to see whether it is a zombie, how long it has been gone, and whether it has an outstanding deletion request. Results render as a self-contained card meant to be screenshotted and shared
- **Scout Mode**: Analyze any user's follow list without signing in at all
- **Relay-Synced Settings**: Your thresholds, immunity list, relay configuration and other preferences persist across devices using NIP-78, encrypted with NIP-04
- **Resurrector**: A tool to recover your Nostr profile if it has been accidentally marked as "deleted". It works by finding the delete flag event, publishing a new event to delete the deletion, and then republishing a clean profile event. This feature is available as both a standalone tool for quick access and as part of the main application, with the in-app version being recommended for better security.

Zombie Check and the Resurrector are also served as standalone pages at
`/zombiecheck` and `/resurrector`. These load without the app bundle, so they
stay fast and shareable as links.

## Getting Started

### Prerequisites

- A modern web browser
- A way to sign Nostr events. Any one of:
  - A NIP-07 browser extension (Sidecar, Alby, nos2x)
  - A NIP-46 remote signer (Amber, Clave, Primal)
  - An nsec, entered directly. It is used locally to sign and is never stored or transmitted

Scout Mode and Zombie Check are read-only and need no signer at all.

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/dmnyc/plebs-vs-zombies.git
   cd plebs-vs-zombies
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Build for production:
   ```
   npm run build
   ```

## Usage

1. Connect with a browser extension, a remote signer, or your nsec
2. Scan your follow list for zombies
3. Set thresholds for zombie classification, and grant immunity to any account you want kept
4. Create a backup of your follow list
5. Select zombies to purge in manageable batches
6. Sign the unfollow event with your signer

To check a single account instead, use Zombie Check. To analyze someone else's
follow list without signing in, use Scout Mode. Both accept an npub, an
nprofile, or a raw hex pubkey.

## Tech Stack

- Vue.js - Frontend framework
- Tailwind CSS - Styling
- NDK & nostr-tools - Nostr interaction
- LocalForage - Local data storage

## License

MIT

## Acknowledgments

- The Nostr community
- All the plebs fighting the zombie apocalypse

## Author

- Created by The Daniel⚡️
- Vibed with Claude
