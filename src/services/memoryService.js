/**
 * Memory Monitoring Service
 *
 * Monitors browser memory usage during intensive operations like scanning large follow lists.
 * Helps prevent browser hangs and OOM errors by tracking heap usage and providing warnings.
 */

class MemoryService {
  constructor() {
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.callbacks = [];
    this.memoryData = {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
      jsHeapSizeLimit: 0,
      usedMB: 0,
      percentUsed: 0
    };

    // Thresholds in MB
    this.thresholds = {
      warning: 200,  // Warn user at 200MB
      critical: 400,  // Critical at 400MB
      max: 500        // Stop operation at 500MB
    };

    // Check if Performance API is available
    this.isSupported = this.checkSupport();
  }

  /**
   * Check if memory monitoring is supported in this browser
   */
  checkSupport() {
    return (
      typeof performance !== 'undefined' &&
      performance.memory &&
      typeof performance.memory.usedJSHeapSize === 'number'
    );
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    if (!this.isSupported) {
      return {
        supported: false,
        usedMB: 0,
        totalMB: 0,
        limitMB: 0,
        percentUsed: 0,
        status: 'unsupported'
      };
    }

    const memory = performance.memory;
    const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
    const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
    const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
    const percentUsed = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);

    // Determine status based on thresholds
    let status = 'normal';
    if (usedMB >= this.thresholds.max) {
      status = 'critical-stop';
    } else if (usedMB >= this.thresholds.critical) {
      status = 'critical';
    } else if (usedMB >= this.thresholds.warning) {
      status = 'warning';
    }

    return {
      supported: true,
      usedMB,
      totalMB,
      limitMB,
      percentUsed,
      status,
      raw: {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      }
    };
  }

  /**
   * Start monitoring memory usage
   * @param {Function} callback - Called with memory data on each check
   * @param {Number} intervalMs - How often to check (default 10 seconds)
   */
  startMonitoring(callback = null, intervalMs = 10000) {
    if (!this.isSupported) {
      console.warn('⚠️ Memory monitoring not supported in this browser');
      return false;
    }

    if (this.isMonitoring) {
      console.log('Memory monitoring already active');
      return true;
    }

    console.log('🔍 Starting memory monitoring (checking every', intervalMs / 1000, 'seconds)');
    this.isMonitoring = true;

    if (callback) {
      this.callbacks.push(callback);
    }

    // Initial check
    this.checkMemory();

    // Set up interval
    this.monitoringInterval = setInterval(() => {
      this.checkMemory();
    }, intervalMs);

    return true;
  }

  /**
   * Stop monitoring memory usage
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    this.callbacks = [];
    console.log('🔍 Memory monitoring stopped');
  }

  /**
   * Check memory and notify callbacks
   */
  checkMemory() {
    const memoryData = this.getMemoryUsage();
    this.memoryData = memoryData;

    // Log significant changes
    if (memoryData.status === 'warning' || memoryData.status === 'critical' || memoryData.status === 'critical-stop') {
      console.warn(`⚠️ Memory usage: ${memoryData.usedMB}MB / ${memoryData.limitMB}MB (${memoryData.percentUsed}%) - Status: ${memoryData.status}`);
    } else {
      console.log(`Memory usage: ${memoryData.usedMB}MB / ${memoryData.limitMB}MB (${memoryData.percentUsed}%)`);
    }

    // Notify all callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(memoryData);
      } catch (error) {
        console.error('Error in memory monitoring callback:', error);
      }
    });
  }

  /**
   * Register a callback for memory updates
   */
  onMemoryUpdate(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback);
    }
  }

  /**
   * Force garbage collection if available (Chrome DevTools only)
   */
  forceGC() {
    if (typeof window !== 'undefined' && window.gc) {
      console.log('🗑️ Forcing garbage collection...');
      window.gc();
      return true;
    } else {
      console.log('⚠️ Garbage collection not available (run Chrome with --expose-gc flag)');
      return false;
    }
  }

  /**
   * Suggest actions based on current memory usage
   */
  getSuggestions(memoryData = null) {
    const data = memoryData || this.memoryData;

    if (!data.supported) {
      return {
        shouldContinue: true,
        shouldPause: false,
        shouldStop: false,
        message: 'Memory monitoring not supported'
      };
    }

    const suggestions = {
      shouldContinue: true,
      shouldPause: false,
      shouldStop: false,
      message: ''
    };

    if (data.status === 'critical-stop') {
      suggestions.shouldContinue = false;
      suggestions.shouldStop = true;
      suggestions.message = `Critical memory usage (${data.usedMB}MB). Operation should be stopped to prevent browser crash.`;
    } else if (data.status === 'critical') {
      suggestions.shouldPause = true;
      suggestions.message = `High memory usage (${data.usedMB}MB). Consider pausing to allow garbage collection.`;
    } else if (data.status === 'warning') {
      suggestions.message = `Elevated memory usage (${data.usedMB}MB). Continuing with caution.`;
    } else {
      suggestions.message = `Memory usage normal (${data.usedMB}MB).`;
    }

    return suggestions;
  }

  /**
   * Estimate memory needed for a given number of follows
   */
  estimateMemoryNeeded(followCount) {
    // Rough estimates based on observed usage:
    // - ~20KB per follow for full scan with events
    // - ~2KB per follow for profile data
    // - ~1KB per follow for relay lists
    const baselinePerFollow = 23; // KB
    const estimatedKB = followCount * baselinePerFollow;
    const estimatedMB = Math.round(estimatedKB / 1024);

    // Add overhead for NDK, browser, and other operations
    const overhead = Math.max(50, estimatedMB * 0.2); // 20% overhead, min 50MB
    const totalEstimate = estimatedMB + overhead;

    return {
      followCount,
      estimatedMB,
      overhead,
      total: Math.round(totalEstimate),
      isSafe: totalEstimate < this.thresholds.warning,
      recommendation: this.getRecommendation(totalEstimate, followCount)
    };
  }

  /**
   * Get recommendation based on estimated memory
   */
  getRecommendation(estimatedMB, followCount) {
    if (estimatedMB > this.thresholds.critical) {
      return {
        level: 'high-risk',
        message: `Processing ${followCount} follows may use ~${estimatedMB}MB. High risk of browser hang. Consider using immunity to reduce scan size.`,
        suggestion: 'Grant immunity to half your follows, then scan the rest separately'
      };
    } else if (estimatedMB > this.thresholds.warning) {
      return {
        level: 'moderate-risk',
        message: `Processing ${followCount} follows may use ~${estimatedMB}MB. Moderate risk. Close other tabs and monitor memory during scan.`,
        suggestion: 'Close unnecessary browser tabs and be prepared to pause if needed'
      };
    } else {
      return {
        level: 'low-risk',
        message: `Processing ${followCount} follows should use ~${estimatedMB}MB. Low risk.`,
        suggestion: 'Proceed normally'
      };
    }
  }

  /**
   * Set custom thresholds
   */
  setThresholds(warning, critical, max) {
    if (warning) this.thresholds.warning = warning;
    if (critical) this.thresholds.critical = critical;
    if (max) this.thresholds.max = max;
    console.log('Updated memory thresholds:', this.thresholds);
  }
}

// Create singleton instance
const memoryService = new MemoryService();
export default memoryService;
