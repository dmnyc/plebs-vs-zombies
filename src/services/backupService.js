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
  async getBackups() {
    if (this.backups.length === 0) {
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
      const backup = JSON.parse(fileContent);
      
      // Validate the backup data
      if (!backup.pubkey || !backup.follows || !Array.isArray(backup.follows)) {
        throw new Error('Invalid backup file format');
      }
      
      // Add any missing fields
      if (!backup.id) {
        backup.id = this.generateBackupId();
      }
      
      if (!backup.createdAt) {
        backup.createdAt = Date.now();
      }
      
      // Store the backup
      await this.storeBackup(backup);
      
      return {
        success: true,
        backup
      };
    } catch (error) {
      console.error('Failed to import backup:', error);
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
      // Validate the backup
      if (!backup.follows || !Array.isArray(backup.follows)) {
        throw new Error('Invalid backup: missing follows array');
      }
      
      // Create a new follow event with the imported follows
      // This would normally create a new kind 3 event with the imported follows
      if (typeof window.nostr === 'undefined') {
        throw new Error('No Nostr extension found');
      }
      
      // Use nostrService to create a follow event
      const follows = backup.follows;
      
      // Create new tags for the contacts event
      const tags = follows.map(pubkey => ['p', pubkey]);
      
      // Create the event
      const event = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: ''
      };
      
      // Sign the event using the extension
      const signedEvent = await window.nostr.signEvent(event);
      
      // Publish the event
      await nostrService.initialize();
      const pub = nostrService.ndk.publish(signedEvent);
      await pub.onSeen();
      
      return {
        success: true,
        message: `Follow list updated with ${follows.length} follows`,
        followCount: follows.length
      };
    } catch (error) {
      console.error('Failed to apply imported follow list:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
  
  /**
   * Initialize the backup service
   */
  init() {
    // Check if automatic backups are enabled
    const intervalDays = localStorage.getItem('automaticBackupIntervalDays');
    if (intervalDays) {
      this.setupAutomaticBackups(parseInt(intervalDays, 10));
    }
  }
}

// Create singleton instance
const backupService = new BackupService();
export default backupService;