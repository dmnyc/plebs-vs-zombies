# Plebs vs. Zombies

A Nostr utility for managing dormant follows and cleaning up your follow list.

## About

Over time, the users you follow on Nostr become dormant zombies. Since npubs can never be deleted, it creates a burden for users to carry around all the dead weight of a growing following count that hungrily eats bandwidth (brains in our metaphor!), overwhelming relays whenever we connect to them presenting our bloated follow list filled with so many undead users that refuse to rest in peace.

Plebs vs. Zombies helps you identify and manage these dormant accounts to maintain a healthier follow list.

## Features

- **Zombie Detection**: Scan your follow list to identify accounts with no activity
- **Customizable Time Thresholds**: Set your own definition of "dormant" (90, 180, 365 days)
- **Batch Processing**: Purge zombies in manageable batches
- **Follow List Backup**: Safely back up your existing follow list before making changes
- **Export Zombie Lists**: Export your zombie lists in JSON or TXT format for sharing or record-keeping
- **Statistics**: Track your zombie hunting progress and bandwidth savings
- **Resurrector**: A tool to recover your Nostr profile if it has been accidentally marked as "deleted". It works by finding the delete flag event, publishing a new event to delete the deletion, and then republishing a clean profile event. This feature is available as both a standalone tool for quick access and as part of the main application, with the in-app version being recommended for better security.

## Getting Started

### Prerequisites

- A modern web browser
- A NIP-07 compatible Nostr extension (nos2x, Alby, etc.)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/plebs-vs-zombies.git
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

1. Connect your Nostr extension
2. Scan your follow list for zombies
3. Set thresholds for zombie classification
4. Create a backup of your follow list
5. Select zombies to purge in manageable batches
6. Sign the unfollow event with your Nostr extension

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
