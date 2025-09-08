import localforage from 'localforage';

// Configure localforage for immunity list
localforage.config({
  name: 'plebs-vs-zombies',
  storeName: 'immunity_list'
});

class ImmunityService {
  constructor() {
    this.immunePubkeys = new Set();
  }

  /**
   * Load the immunity list from storage
   */
  async loadImmunityList() {
    try {
      const immuneList = await localforage.getItem('immunePubkeys') || [];
      this.immunePubkeys = new Set(immuneList);
      return this.immunePubkeys;
    } catch (error) {
      console.error('Failed to load immunity list:', error);
      return new Set();
    }
  }

  /**
   * Save the immunity list to storage
   */
  async saveImmunityList() {
    try {
      const immuneArray = Array.from(this.immunePubkeys);
      await localforage.setItem('immunePubkeys', immuneArray);
      return true;
    } catch (error) {
      console.error('Failed to save immunity list:', error);
      return false;
    }
  }

  /**
   * Grant immunity to a pubkey (add to whitelist)
   */
  async grantImmunity(pubkey, reason = '') {
    if (!pubkey) return false;
    
    this.immunePubkeys.add(pubkey);
    
    // Store the reason for immunity
    const immunityReasons = await localforage.getItem('immunityReasons') || {};
    immunityReasons[pubkey] = {
      reason,
      timestamp: Date.now()
    };
    await localforage.setItem('immunityReasons', immunityReasons);
    
    return await this.saveImmunityList();
  }

  /**
   * Revoke immunity from a pubkey (remove from whitelist)
   */
  async revokeImmunity(pubkey) {
    if (!pubkey) return false;
    
    this.immunePubkeys.delete(pubkey);
    
    // Remove the reason
    const immunityReasons = await localforage.getItem('immunityReasons') || {};
    delete immunityReasons[pubkey];
    await localforage.setItem('immunityReasons', immunityReasons);
    
    return await this.saveImmunityList();
  }

  /**
   * Check if a pubkey has immunity
   */
  hasImmunity(pubkey) {
    return this.immunePubkeys.has(pubkey);
  }

  /**
   * Get all immune pubkeys
   */
  getImmunePubkeys() {
    return Array.from(this.immunePubkeys);
  }

  /**
   * Get immunity reason for a pubkey
   */
  async getImmunityReason(pubkey) {
    try {
      const immunityReasons = await localforage.getItem('immunityReasons') || {};
      return immunityReasons[pubkey] || null;
    } catch (error) {
      console.error('Failed to get immunity reason:', error);
      return null;
    }
  }

  /**
   * Get all immunity records with reasons
   */
  async getAllImmunityRecords() {
    try {
      const immunityReasons = await localforage.getItem('immunityReasons') || {};
      const immunePubkeys = this.getImmunePubkeys();
      
      return immunePubkeys.map(pubkey => ({
        pubkey,
        reason: immunityReasons[pubkey]?.reason || 'No reason provided',
        timestamp: immunityReasons[pubkey]?.timestamp || null
      }));
    } catch (error) {
      console.error('Failed to get immunity records:', error);
      return [];
    }
  }

  /**
   * Filter zombies to remove immune ones
   */
  filterImmuneZombies(zombies) {
    if (!zombies) return zombies;
    
    const filtered = {
      active: zombies.active || [],
      burned: (zombies.burned || []).filter(zombie => {
        const pubkey = typeof zombie === 'string' ? zombie : zombie.pubkey;
        return !this.hasImmunity(pubkey);
      }),
      fresh: (zombies.fresh || []).filter(zombie => {
        const pubkey = typeof zombie === 'string' ? zombie : zombie.pubkey;
        return !this.hasImmunity(pubkey);
      }),
      rotting: (zombies.rotting || []).filter(zombie => {
        const pubkey = typeof zombie === 'string' ? zombie : zombie.pubkey;
        return !this.hasImmunity(pubkey);
      }),
      ancient: (zombies.ancient || []).filter(zombie => {
        const pubkey = typeof zombie === 'string' ? zombie : zombie.pubkey;
        return !this.hasImmunity(pubkey);
      })
    };
    
    const originalTotal = (zombies.burned?.length || 0) + (zombies.fresh?.length || 0) + (zombies.rotting?.length || 0) + (zombies.ancient?.length || 0);
    const filteredTotal = filtered.burned.length + filtered.fresh.length + filtered.rotting.length + filtered.ancient.length;
    
    if (originalTotal > filteredTotal) {
      console.log(`Filtered out ${originalTotal - filteredTotal} immune zombies`);
    }
    
    return filtered;
  }

  /**
   * Initialize the immunity service
   */
  async init() {
    await this.loadImmunityList();
  }

  /**
   * Clear all immunity records (use with caution)
   */
  async clearAllImmunity() {
    this.immunePubkeys.clear();
    await localforage.removeItem('immunePubkeys');
    await localforage.removeItem('immunityReasons');
    return true;
  }

  /**
   * Reset all immunity records (user-friendly wrapper)
   */
  async resetAllImmunity() {
    const count = this.immunePubkeys.size;
    await this.clearAllImmunity();
    console.log(`Reset ${count} immunity records`);
    return { success: true, clearedCount: count };
  }

  /**
   * Export immunity list as JSON
   */
  async exportImmunityList() {
    try {
      const records = await this.getAllImmunityRecords();
      const exportData = {
        timestamp: Date.now(),
        version: '1.0',
        immunityRecords: records
      };
      
      const filename = `zombie-immunity-list-${new Date().toISOString().split('T')[0]}.json`;
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return { success: true, filename };
    } catch (error) {
      console.error('Failed to export immunity list:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Import immunity list from JSON
   */
  async importImmunityList(jsonContent) {
    try {
      const data = JSON.parse(jsonContent);
      
      if (!data.immunityRecords || !Array.isArray(data.immunityRecords)) {
        throw new Error('Invalid immunity list format');
      }
      
      // Import records
      for (const record of data.immunityRecords) {
        if (record.pubkey) {
          await this.grantImmunity(record.pubkey, record.reason || 'Imported');
        }
      }
      
      return { success: true, imported: data.immunityRecords.length };
    } catch (error) {
      console.error('Failed to import immunity list:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const immunityService = new ImmunityService();
export default immunityService;