// SponsorBlock Module for YTView
// Handles SponsorBlock integration to skip sponsored segments in videos

/**
 * Initialize the SponsorBlock module
 * @param {Object} settings - The application settings
 * @returns {Object} - Module interface
 */
function initSponsorBlock(settings) {
  // Internal state
  let isEnabled = settings?.sponsorBlockEnabled === true;
  let currentSegments = [];
  let skipInterval = null;
  let notificationTimeout = null;
  
  /**
   * Set up SponsorBlock segment skipping
   */
  function setupSponsorSkipping() {
    if (!isEnabled || currentSegments.length === 0) {
      return;
    }
    
    console.log('Setting up SponsorBlock with segments:', currentSegments);
    
    // Clean up existing interval if any
    if (skipInterval) {
      clearInterval(skipInterval);
    }
    
    // Start checking for segments to skip
    skipInterval = setInterval(() => {
      if (!isEnabled) return;
      
      const video = document.querySelector('video');
      if (!video) return;
      
      // Check if current time is within any sponsor segment
      const currentTime = video.currentTime;
      for (const segment of currentSegments) {
        // If we're at the start of a segment, skip to the end
        if (currentTime >= segment.startTime && currentTime < segment.endTime) {
          // Skip this segment
          video.currentTime = segment.endTime;
          
          // Show notification about skip
          showSkipNotification('Sponsor segment skipped');
          break;
        }
      }
    }, 500);
  }
  
  /**
   * Show a notification when a segment is skipped
   * @param {string} message - The message to display
   */
  function showSkipNotification(message) {
    // Remove existing notification if present
    const existingNotification = document.getElementById('ytview-sb-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // Clear existing timeout
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'ytview-sb-notification';
    notification.style = `
      position: absolute;
      bottom: 60px;
      right: 20px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 9999;
      font-size: 14px;
    `;
    notification.innerText = message;
    
    // Add to player
    const player = document.querySelector('.html5-video-player');
    if (player) {
      player.appendChild(notification);
      
      // Auto-remove after 3 seconds
      notificationTimeout = setTimeout(() => {
        const notification = document.getElementById('ytview-sb-notification');
        if (notification) {
          notification.remove();
        }
      }, 3000);
    }
  }
  
  /**
   * Update sponsor segments data
   * @param {Array} segments - The segments to skip
   */
  function updateSegments(segments) {
    currentSegments = segments || [];
    
    if (isEnabled && currentSegments.length > 0) {
      setupSponsorSkipping();
    }
  }
  
  /**
   * Clean up SponsorBlock functionality
   */
  function cleanup() {
    if (skipInterval) {
      clearInterval(skipInterval);
      skipInterval = null;
    }
    
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      notificationTimeout = null;
    }
    
    const notification = document.getElementById('ytview-sb-notification');
    if (notification) {
      notification.remove();
    }
  }
  
  /**
   * Update the module settings
   * @param {Object} newSettings - The new settings to apply
   */
  function updateSettings(newSettings) {
    if (newSettings && typeof newSettings.sponsorBlockEnabled !== 'undefined') {
      const wasEnabled = isEnabled;
      isEnabled = newSettings.sponsorBlockEnabled === true;
      
      // If state changed, take appropriate action
      if (wasEnabled !== isEnabled) {
        if (isEnabled && currentSegments.length > 0) {
          setupSponsorSkipping();
        } else if (!isEnabled) {
          cleanup();
        }
      }
    }
  }
  
  // Return the public API
  return {
    setup: setupSponsorSkipping,
    cleanup,
    updateSettings,
    updateSegments,
    isEnabled: () => isEnabled
  };
}

module.exports = initSponsorBlock;
