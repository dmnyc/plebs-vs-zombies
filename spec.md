# Plebs vs. Zombies - Application Specification

## Overview
"Plebs vs. Zombies" is a Nostr-focused utility application that helps users manage their follow list by identifying and removing dormant accounts ("zombies") that consume bandwidth without providing new content. The app uses the metaphor of zombie hunting to make follow list maintenance more engaging and purposeful.

## Problem Statement
Over time, Nostr users accumulate follows who become inactive. Since npubs (Nostr public keys) cannot be deleted, these dormant accounts create unnecessary bandwidth consumption when clients load follow lists and request updates from relays. This creates a poor user experience as relays become overwhelmed with requests for inactive accounts.

## Core Features

### 1. Follow List Backup & Restoration
- **Automatic Backup**: Create timestamped backups of the user's current follow list and profile data
- **Manual Backup**: Allow users to trigger a backup at any time
- **Backup Format**: JSON exports that can be stored locally or in cloud storage
- **Restoration**: Simple one-click restoration of any previous backup
- **Scheduled Backups**: Optional weekly/monthly automatic backups

### 2. Zombie Detection
- **Dormancy Analysis**: Scan follow list to identify accounts with no activity
- **Customizable Time Thresholds**:
  - Preset intervals: 90 days, 120 days, 180 days, 365 days
  - Custom interval option
- **Zombie Classification**:
  - "Fresh Zombies" (inactive 90-180 days)
  - "Rotting Zombies" (inactive 181-365 days)
  - "Ancient Zombies" (inactive >365 days)
- **Visualization**: Display percentage of your follow list that consists of zombies

### 3. Controlled Zombie Purging
- **Batch Processing**: Limit unfollows to manageable groups (recommended: 20-50 accounts per batch)
- **Preview Mode**: Review accounts before confirming unfollow action
- **Filtering Options**:
  - Sort by last active date
  - Filter by interaction history (prioritize accounts you never interacted with)
  - Exclude accounts with specific tags/metadata
- **Safety Mechanism**: Confirm each batch with a signature before execution

### 4. Zombie Statistics
- **Follow List Health Score**: Visual indicator of your follow list's overall "health"
- **Purge History**: Track how many zombies you've purged over time
- **Bandwidth Savings**: Calculate estimated bandwidth saved after purging

## User Interface

### Main Dashboard
- **Follow List Overview**: Total follows, active follows, dormant follows
- **Zombie Hunter Status**: Progress and stats on zombie hunting activities
- **Quick Actions**: Backup, Scan for Zombies, Resume Purging

### Zombie Detection Screen
- **Time Threshold Selector**: Choose detection threshold
- **Scanning Progress**: Visual indicator of scanning progress
- **Results View**: List of identified dormant accounts with their last activity timestamp

### Zombie Purge Screen
- **Batch Size Selector**: Choose how many zombies to process at once (default: 30)
- **Zombie Selection**: Multi-select interface with account details
- **Confirmation Dialog**: Clear warning before signing unfollow event
- **Execution Feedback**: Success/failure notifications

### Settings Screen
- **Backup Configuration**: Set backup locations and schedule
- **Thresholds Customization**: Adjust zombie classification parameters
- **Relay Configuration**: Specify which relays to query for activity data
- **Theme Options**: Standard/Dark/Zombie Apocalypse visual themes

## Technical Specifications

### Nostr Integration
- **NIP-01**: Basic protocol support for follows/unfollows
- **NIP-07**: Web browser extension integration for signatures
- **NIP-65**: Relay list management
- **Custom Event**: Create a specialized event for batch unfollows (with appropriate client-side validation)

### Performance Considerations
- **Caching**: Store activity data locally to reduce relay queries
- **Background Processing**: Run zombie detection as a background task
- **Pagination**: Load large follow lists in chunks to maintain responsiveness

### Security Features
- **Encrypted Backups**: Option to encrypt backup files
- **Signature Verification**: Confirm all unfollow events are properly signed
- **Read-Only Mode**: Option to run analysis without making any changes

## Implementation Guidelines

### Batch Size Recommendation
- **Optimal Batch Size**: 30 accounts per unfollow event
  - Small enough to be manageable and not overwhelm relays
  - Large enough to make meaningful progress
  - Allows for careful review before execution

### User Experience Principles
- **Progressive Disclosure**: Start with basic features, reveal advanced options progressively
- **Visual Feedback**: Clear indicators for zombie status and purging progress
- **Gamification Elements**: Achievement badges for maintaining a "healthy" follow list
- **Educational Content**: Tips on managing follow lists effectively

## Future Enhancements
- **Zombie Rehabilitation**: Feature to temporarily unfollow but track accounts for potential future re-following
- **Smart Suggestions**: ML-based recommendations for which zombies to purge first
- **Community Rankings**: Anonymous aggregated data on which accounts tend to become zombies
- **Integration with other Nostr clients**: Export functionality for popular clients

## Success Metrics
- Number of dormant follows successfully identified
- Bandwidth savings after zombie purging
- User satisfaction with follow list quality
- Time saved in client loading/syncing

This specification provides a framework for developing "Plebs vs. Zombies" as a useful tool for Nostr users to maintain healthier follow lists while preserving the ability to restore previous configurations if needed.