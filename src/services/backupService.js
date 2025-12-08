import localforage from 'localforage';
import nostrService from './nostrService';
import { format } from 'date-fns';

// Configure localforage for backups
localforage.config({
  name: 'plebs-vs-zombies',
  storeName: 'backups'
});

class BackupService {
  constructor() {
    this.backups = [];
  }

  /**
   * Create a new backup of the user's follow list
   */
  async createBackup(notes = '') {
    try {
      // Get the follow list backup data
      const backupData = await nostrService.backupFollowList();
      
      // Add metadata
      const backup = {
        ...backupData,
        id: this.generateBackupId(),
        notes: notes || '',
        createdAt: Date.now()
      };
      
      // Store the backup
      await this.storeBackup(backup);
      
      return {
        success: true,
        backup
      };
    } catch (error) {
      console.error('Failed to create backup:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Generate a unique backup ID
   */
  generateBackupId() {
    return `backup-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Store a backup in local storage
   */
  async storeBackup(backup) {
    // Get existing backups
    const backups = await this.getBackups();
    
    // Add the new backup
    backups.push(backup);
    
    // Store the updated backups
    await localforage.setItem('backups', backups);
    
    // Update the cached backups
    this.backups = backups;
  }

  /**
   * Get all backups
   */
  async getBackups(forceReload = false) {
    if (this.backups.length === 0 || forceReload) {
      const backups = await localforage.getItem('backups') || [];
      this.backups = backups;
    }
    
    return this.backups;
  }

  /**
   * Get a specific backup by ID
   */
  async getBackupById(id) {
    const backups = await this.getBackups();
    return backups.find(backup => backup.id === id);
  }

  /**
   * Delete a backup
   */
  async deleteBackup(id) {
    const backups = await this.getBackups();
    const filteredBackups = backups.filter(backup => backup.id !== id);
    
    await localforage.setItem('backups', filteredBackups);
    this.backups = filteredBackups;
    
    return {
      success: true,
      message: 'Backup deleted successfully'
    };
  }

  /**
   * Export a backup as a JSON file
   */
  exportBackupToJson(backup) {
    const filename = `nostr-backup-${format(backup.createdAt, 'yyyy-MM-dd')}.json`;
    const jsonString = JSON.stringify(backup, null, 2);
    
    // Create a blob with the JSON data
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Simulate a click on the link
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    return {
      success: true,
      message: `Backup exported as ${filename}`
    };
  }

  /**
   * Import a backup from a JSON file
   */
  async importBackupFromJson(fileContent) {
    try {
      console.log('📥 Starting backup import from JSON...');
      const backup = JSON.parse(fileContent);
      
      console.log('📋 Parsed backup data:', {
        hasPubkey: !!backup.pubkey,
        hasFollows: !!backup.follows,
        followsLength: backup.follows ? backup.follows.length : 'N/A',
        existingId: backup.id,
        existingCreatedAt: backup.createdAt,
        backupKeys: Object.keys(backup)
      });
      
      // Validate the backup data
      if (!backup.pubkey || !backup.follows || !Array.isArray(backup.follows)) {
        throw new Error('Invalid backup file format');
      }
      
      // Check if the backup belongs to the current user
      const currentUserPubkey = await this.getCurrentUserPubkey();
      if (currentUserPubkey && backup.pubkey !== currentUserPubkey) {
        console.log('🔍 Pubkey validation:', {
          currentUser: currentUserPubkey.substring(0, 8) + '...',
          backupOwner: backup.pubkey.substring(0, 8) + '...',
          match: backup.pubkey === currentUserPubkey
        });
        throw new Error(`This backup belongs to a different Nostr identity.\n\nBackup owner: ${backup.pubkey.substring(0, 8)}...\nCurrent identity: ${currentUserPubkey.substring(0, 8)}...\n\nYou can only import backups that belong to your current Nostr identity.`);
      }
      
      console.log('✅ Pubkey validation passed - backup belongs to current user');
      
      // Add any missing fields
      if (!backup.id) {
        backup.id = this.generateBackupId();
        console.log('🔖 Generated new backup ID:', backup.id);
      }
      
      if (!backup.createdAt) {
        backup.createdAt = Date.now();
        console.log('📅 Added timestamp:', new Date(backup.createdAt));
      }
      
      // Add followCount for display purposes
      if (!backup.followCount) {
        backup.followCount = backup.follows.length;
      }
      
      // Mark as imported and set import timestamp
      backup.isImported = true;
      backup.importedAt = Date.now();
      
      console.log('💾 Storing backup...');
      // Store the backup
      await this.storeBackup(backup);
      
      console.log('✅ Backup import completed successfully');
      return {
        success: true,
        backup
      };
    } catch (error) {
      console.error('❌ Failed to import backup:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Set up automatic backups
   */
  setupAutomaticBackups(intervalDays = 7) {
    // Check if we already have an interval set
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
    
    // Convert days to milliseconds
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    
    // Create a new interval
    this.backupInterval = setInterval(async () => {
      await this.createBackup('Automatic backup');
    }, intervalMs);
    
    // Store the setting
    localStorage.setItem('automaticBackupIntervalDays', intervalDays.toString());
  }

  /**
   * Stop automatic backups
   */
  stopAutomaticBackups() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
    
    localStorage.removeItem('automaticBackupIntervalDays');
  }

  /**
   * Apply an imported follow list
   */
  async applyImportedFollowList(backup) {
    try {
      console.log('🔄 Starting backup restoration process...');
      
      // Validate the backup
      console.log('🔍 Backup data received:', {
        hasFollows: !!backup.follows,
        isArray: Array.isArray(backup.follows),
        followsLength: backup.follows ? backup.follows.length : 'N/A',
        backupKeys: Object.keys(backup),
        backupId: backup.id,
        createdAt: backup.createdAt
      });
      
      if (!backup.follows || !Array.isArray(backup.follows)) {
        throw new Error('Invalid backup: missing follows array');
      }
      
      if (backup.follows.length === 0) {
        throw new Error('Backup contains no follows to restore');
      }
      
      console.log(`📋 Restoring ${backup.follows.length} follows from backup`);
      
      // Ensure nostrService is initialized and connected
      await nostrService.initialize();
      
      // Check connection status based on signing method
      console.log('🔍 Connection status check:', {
        signingMethod: nostrService.signingMethod,
        extensionConnected: nostrService.extensionConnected,
        extensionAuthorized: nostrService.extensionAuthorized,
        pubkey: nostrService.pubkey ? nostrService.pubkey.substring(0, 8) + '...' : 'None',
        nip46Connected: nostrService.nip46Service.isConnected()
      });
      
      let isConnected = false;
      if (nostrService.signingMethod === 'nip07') {
        isConnected = nostrService.extensionConnected && nostrService.extensionAuthorized && nostrService.pubkey;
      } else if (nostrService.signingMethod === 'nip46') {
        isConnected = nostrService.nip46Service.isConnected() && nostrService.pubkey;
      }
      
      console.log('🔍 Final connection check result:', isConnected);
      
      if (!isConnected) {
        throw new Error('Not connected to Nostr. Please sign in first.');
      }
      
      // Get the current user's pubkey
      const currentPubkey = nostrService.pubkey;
      if (!currentPubkey) {
        throw new Error('User public key not available');
      }
      
      console.log('👤 Current user pubkey:', currentPubkey);
      
      // Create new tags for the contacts event (kind 3)
      const tags = backup.follows.map(pubkey => ['p', pubkey]);
      
      console.log('🏷️ Created tags for', tags.length, 'follows');
      
      // Create the follow list event using the same pattern as createUnfollowEvent
      const event = {
        kind: 3, // Kind 3 = Contact List
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: '' // Follow lists typically have empty content
      };
      
      console.log('📝 Creating and signing kind 3 event...');
      
      // Ensure appropriate signing method is ready
      if (!nostrService.isSigningReady()) {
        if (nostrService.signingMethod === 'nip07') {
          console.log('🔄 Extension not ready, attempting connection...');
          await nostrService.connectExtension();
        } else if (nostrService.signingMethod === 'nip46') {
          throw new Error('NIP-46 bunker not connected. Please connect your bunker first.');
        }
      }
      
      // Double-check connection is still valid
      if (!nostrService.isSigningReady()) {
        throw new Error(`Unable to establish connection with signing method: ${nostrService.signingMethod}`);
      }
      
      console.log('🔐 Starting signing process...');
      console.log('Event to sign:', {
        kind: event.kind,
        created_at: event.created_at,
        tags: event.tags.length,
        content: event.content.length
      });
      
      // Sign event using appropriate method
      let signedEvent;
      try {
        if (nostrService.signingMethod === 'nip07') {
          console.log('Attempting NIP-07 signing...');
          console.log('⏳ Calling window.nostr.signEvent() - check your extension for signing prompt...');
          
          signedEvent = await Promise.race([
            window.nostr.signEvent(event),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Signing timeout - please approve the signing request in your extension')), 60000)
            )
          ]);
        } else if (nostrService.signingMethod === 'nip46') {
          console.log('Attempting NIP-46 signing...');
          console.log('⏳ Requesting signature from bunker - check your bunker app for signing prompt...');
          
          signedEvent = await nostrService.nip46Service.signEvent(event);
        } else {
          throw new Error(`Invalid signing method: ${nostrService.signingMethod}`);
        }
        
        console.log('✅ Event signed successfully:', signedEvent.id);
      } catch (signingError) {
        console.error('❌ Signing failed:', signingError);
        throw new Error(`Failed to sign event: ${signingError.message}`);
      }
      
      if (!signedEvent) {
        throw new Error('Failed to create or sign the follow list event');
      }
      
      console.log('✅ Event created and signed:', signedEvent.id);
      
      // Ensure we have fresh relay list for publishing
      console.log('🔗 Ensuring fresh relay list...');
      if (!nostrService.userRelayList || nostrService.userRelayList.length === 0) {
        await nostrService.fetchUserRelayList();
      }
      
      // Publish to user's write relays using the robust publishEventToRelays method
      console.log('📡 Publishing to relays...');
      const publishResults = await nostrService.publishEventToRelays(signedEvent);
      
      console.log(`📊 Publication results: ${publishResults.successful}/${publishResults.total} relays successful`);
      
      if (publishResults.successful === 0) {
        throw new Error('Failed to publish to any relays. Check your relay connections.');
      }
      
      // Verify the restoration by fetching the updated follow list
      console.log('🔍 Verifying restoration...');
      
      // Wait a moment for the event to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fetch the current follow list to verify
      const currentFollows = await nostrService.getFollowList();
      
      console.log(`✅ Verification: Current follow list has ${currentFollows.length} follows`);
      
      return {
        success: true,
        message: `Follow list restored successfully with ${backup.follows.length} follows`,
        followCount: backup.follows.length,
        publishResults: publishResults,
        verifiedFollowCount: currentFollows.length,
        eventId: signedEvent.id
      };
    } catch (error) {
      console.error('❌ Failed to apply imported follow list:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  /**
   * Get the current user's public key
   */
  async getCurrentUserPubkey() {
    try {
      // Ensure nostrService is initialized
      await nostrService.initialize();
      
      // Try to get the pubkey from nostrService
      if (nostrService.pubkey) {
        return nostrService.pubkey;
      }
      
      // If not available, try to get it from the signing method
      if (nostrService.signingMethod === 'nip07' && typeof window.nostr !== 'undefined') {
        try {
          const pubkey = await window.nostr.getPublicKey();
          return pubkey;
        } catch (error) {
          console.warn('Failed to get pubkey from NIP-07 extension:', error);
        }
      } else if (nostrService.signingMethod === 'nip46' && nostrService.nip46Service.isConnected()) {
        try {
          const pubkey = await nostrService.nip46Service.getPublicKey();
          return pubkey;
        } catch (error) {
          console.warn('Failed to get pubkey from NIP-46 bunker:', error);
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to get current user pubkey:', error);
      return null;
    }
  }

  /**
   * Initialize the backup service
   */
  async init() {
    // Check if automatic backups are enabled
    const intervalDays = localStorage.getItem('automaticBackupIntervalDays');
    if (intervalDays) {
      this.setupAutomaticBackups(parseInt(intervalDays, 10));
    }

    // Auto-restore from relay if no local backups exist
    try {
      const localBackups = await this.getBackups();

      if (localBackups.length === 0) {
        console.log('[BackupService] No local backups found, checking relay...');

        // Import relay backup service and nostr service dynamically to avoid circular dependencies
        const relayBackupService = (await import('./settings/relayBackupService.js')).default;
        const nostrService = (await import('./nostrService.js')).default;

        // Only proceed if user is connected
        if (!nostrService.pubkey) {
          console.log('[BackupService] Not connected, skipping relay check');
          return;
        }

        // List relay backups
        const relayBackups = await relayBackupService.listBackups();

        if (relayBackups.length > 0) {
          console.log(`[BackupService] Found ${relayBackups.length} relay backups`);

          // Get most recent backup (already sorted newest first)
          const mostRecent = relayBackups[0];
          console.log(`[BackupService] Auto-restoring backup from ${new Date(mostRecent.timestamp * 1000).toLocaleString()}`);

          // Restore the backup
          const result = await relayBackupService.restoreBackup(mostRecent.dTag);

          if (result.success) {
            console.log('[BackupService] Auto-restore successful');
            console.log(`[BackupService] Restored ${result.restored.length} services`);
          } else {
            console.warn('[BackupService] Auto-restore failed:', result.error);
          }
        } else {
          console.log('[BackupService] No relay backups found');
        }
      } else {
        console.log(`[BackupService] Found ${localBackups.length} local backups, skipping auto-restore`);
      }
    } catch (error) {
      console.warn('[BackupService] Auto-restore check failed:', error);
      // Don't throw - this shouldn't block app initialization
    }
  }
}

// Create singleton instance
const backupService = new BackupService();
export default backupService;