// Return YouTube Dislike Module for YTView
// Handles integration with the Return YouTube Dislike API to restore dislike counts

/**
 * Initialize the Return YouTube Dislike module
 * @param {Object} settings - The application settings
 * @returns {Object} - Module interface
 */
function initReturnDislike(settings) {
  // Internal state
  let isEnabled = settings?.returnDislikeEnabled === true;
  let currentDislikeData = null;
  let dislikeObserver = null;
  let updateInterval = null;
  
  /**
   * Apply Return YouTube Dislike functionality
   */
  function applyReturnDislike() {
    if (!isEnabled || !currentDislikeData) {
      return;
    }
    
    console.log('Applying dislike data:', currentDislikeData);
    
    // Update the dislike count in the UI
    updateDislikeDisplay();
    
    // Set up observer to keep our changes persistent
    setupDislikeObserver();
    
    // Set interval to periodically check and update display
    if (updateInterval) {
      clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(() => {
      if (isEnabled && currentDislikeData) {
        updateDislikeDisplay();
      }
    }, 2000);
  }
  
  /**
   * Update the dislike display in the YouTube UI
   */
  function updateDislikeDisplay() {
    if (!currentDislikeData) return;
    
    // Find the dislike button and count container
    const dislikeButton = document.querySelector('ytd-menu-renderer.ytd-video-primary-info-renderer yt-icon-button#button[aria-label^="Dislike"]');
    if (!dislikeButton) return;
    
    // Get parent container that will hold our count
    const dislikeContainer = dislikeButton.closest('button, yt-icon-button');
    if (!dislikeContainer) return;
    
    // Format dislike count
    const dislikeCount = formatCount(currentDislikeData.dislikes);
    
    // Check if we already have a count displayed
    let countSpan = dislikeContainer.querySelector('.ytview-dislike-count');
    
    if (!countSpan) {
      // Create new element for dislike count
      countSpan = document.createElement('span');
      countSpan.className = 'ytview-dislike-count';
      countSpan.style = `
        margin-left: 4px;
        color: var(--yt-spec-text-primary);
        font-size: 14px;
      `;
      
      // Insert after the dislike button
      const buttonParent = dislikeContainer.parentNode;
      if (buttonParent) {
        buttonParent.insertBefore(countSpan, dislikeContainer.nextSibling);
      }
    }
    
    // Update the count text
    countSpan.textContent = dislikeCount;
  }
  
  /**
   * Format large numbers in a user-friendly way (e.g., 10K, 1.5M)
   * @param {number} count - The count to format
   * @returns {string} - Formatted count
   */
  function formatCount(count) {
    if (count < 1000) {
      return count.toString();
    } else if (count < 1000000) {
      return (count / 1000).toFixed(count < 10000 ? 1 : 0) + 'K';
    } else {
      return (count / 1000000).toFixed(count < 10000000 ? 1 : 0) + 'M';
    }
  }
  
  /**
   * Set up mutation observer to keep dislike count visible
   */
  function setupDislikeObserver() {
    // Clean up existing observer
    if (dislikeObserver) {
      dislikeObserver.disconnect();
    }
    
    // Set up a new observer
    dislikeObserver = new MutationObserver((mutations) => {
      // If DOM changes, re-apply our dislike count
      updateDislikeDisplay();
    });
    
    // Start observing the dislike button area
    const dislikeArea = document.querySelector('ytd-menu-renderer.ytd-video-primary-info-renderer');
    if (dislikeArea) {
      dislikeObserver.observe(dislikeArea, { 
        childList: true,
        subtree: true,
        attributes: true
      });
    }
  }
  
  /**
   * Update Return YouTube Dislike data
   * @param {Object} data - The dislike data from the API
   */
  function updateData(data) {
    currentDislikeData = data;
    
    if (isEnabled && currentDislikeData) {
      applyReturnDislike();
    }
  }
  
  /**
   * Clean up Return YouTube Dislike functionality
   */
  function cleanup() {
    // Disconnect observer
    if (dislikeObserver) {
      dislikeObserver.disconnect();
      dislikeObserver = null;
    }
    
    // Clear update interval
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    
    // Remove any dislike count elements we've added
    document.querySelectorAll('.ytview-dislike-count').forEach(el => {
      el.remove();
    });
    
    // Reset data
    currentDislikeData = null;
  }
  
  /**
   * Update the module settings
   * @param {Object} newSettings - The new settings to apply
   */
  function updateSettings(newSettings) {
    if (newSettings && typeof newSettings.returnDislikeEnabled !== 'undefined') {
      const wasEnabled = isEnabled;
      isEnabled = newSettings.returnDislikeEnabled === true;
      
      // If state changed, take appropriate action
      if (wasEnabled !== isEnabled) {
        if (isEnabled && currentDislikeData) {
          applyReturnDislike();
        } else if (!isEnabled) {
          cleanup();
        }
      }
    }
  }
  
  // Return the public API
  return {
    apply: applyReturnDislike,
    cleanup,
    updateSettings,
    updateData,
    isEnabled: () => isEnabled
  };
}

module.exports = initReturnDislike;
