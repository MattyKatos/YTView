// DeArrow Module for YTView
// Handles title and thumbnail enhancements from the DeArrow API

/**
 * Initialize the DeArrow module
 * @param {Object} settings - The application settings
 * @returns {Object} - Module interface
 */
function initDeArrow(settings) {
  // Internal state
  let isEnabled = settings?.dearrowEnabled === true;
  let currentDeArrowData = null;
  let titleObserver = null;
  let thumbnailObserver = null;
  
  /**
   * Apply DeArrow enhancements to the current video
   */
  function applyDeArrow() {
    if (!isEnabled || !currentDeArrowData) {
      return;
    }
    
    console.log('Applying DeArrow data:', currentDeArrowData);
    
    // Apply title changes if available
    if (currentDeArrowData.titles && currentDeArrowData.titles.length > 0) {
      applyTitleChanges();
    }
    
    // Apply thumbnail changes if available
    if (currentDeArrowData.thumbnails && currentDeArrowData.thumbnails.length > 0) {
      applyThumbnailChanges();
    }
  }
  
  /**
   * Apply title changes to the current video
   */
  function applyTitleChanges() {
    if (!currentDeArrowData?.titles?.length) return;
    
    // Get title elements to modify
    const titleElements = [
      document.querySelector('.title.ytd-video-primary-info-renderer'),
      document.querySelector('title')
    ].filter(Boolean);
    
    if (titleElements.length === 0) return;
    
    // Get the best title from DeArrow
    const newTitle = currentDeArrowData.titles[0].title;
    if (!newTitle) return;
    
    // Apply new title to all title elements
    titleElements.forEach(el => {
      if (el.tagName === 'TITLE') {
        // For page title element, add YouTube suffix
        el.textContent = `${newTitle} - YouTube`;
      } else {
        el.textContent = newTitle;
      }
    });
    
    // Set up mutation observer to maintain our changes if YouTube updates the DOM
    setupTitleObserver(newTitle);
  }
  
  /**
   * Apply thumbnail changes to the current video player
   */
  function applyThumbnailChanges() {
    if (!currentDeArrowData?.thumbnails?.length) return;
    
    // Get best thumbnail from DeArrow
    const newThumbnail = currentDeArrowData.thumbnails[0].imageUrl;
    if (!newThumbnail) return;
    
    // Find video thumbnail in player
    const previewThumbnail = document.querySelector('.ytp-cued-thumbnail-overlay-image');
    if (previewThumbnail) {
      previewThumbnail.style.backgroundImage = `url(${newThumbnail})`;
    }
    
    // Set up mutation observer to maintain our changes if YouTube updates the DOM
    setupThumbnailObserver(newThumbnail);
  }
  
  /**
   * Set up mutation observer to keep title changes persistent
   * @param {string} newTitle - The improved title
   */
  function setupTitleObserver(newTitle) {
    // Clean up existing observer
    if (titleObserver) {
      titleObserver.disconnect();
    }
    
    // Set up a new observer
    titleObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          // Re-apply our title changes if YouTube changes them back
          const titleElement = mutation.target;
          if (titleElement.tagName === 'TITLE') {
            if (!titleElement.textContent.includes(newTitle)) {
              titleElement.textContent = `${newTitle} - YouTube`;
            }
          } else {
            if (titleElement.textContent !== newTitle) {
              titleElement.textContent = newTitle;
            }
          }
        }
      });
    });
    
    // Start observing
    const titleElements = [
      document.querySelector('.title.ytd-video-primary-info-renderer'),
      document.querySelector('title')
    ].filter(Boolean);
    
    titleElements.forEach(el => {
      titleObserver.observe(el, { 
        childList: true,
        characterData: true,
        subtree: true
      });
    });
  }
  
  /**
   * Set up mutation observer to keep thumbnail changes persistent
   * @param {string} newThumbnailUrl - The improved thumbnail URL
   */
  function setupThumbnailObserver(newThumbnailUrl) {
    // Clean up existing observer
    if (thumbnailObserver) {
      thumbnailObserver.disconnect();
    }
    
    // Set up a new observer
    thumbnailObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          // Re-apply our thumbnail changes if YouTube changes them back
          const thumbnailElement = mutation.target;
          if (!thumbnailElement.style.backgroundImage.includes(newThumbnailUrl)) {
            thumbnailElement.style.backgroundImage = `url(${newThumbnailUrl})`;
          }
        }
      });
    });
    
    // Start observing
    const previewThumbnail = document.querySelector('.ytp-cued-thumbnail-overlay-image');
    if (previewThumbnail) {
      thumbnailObserver.observe(previewThumbnail, { 
        attributes: true,
        attributeFilter: ['style']
      });
    }
  }
  
  /**
   * Update DeArrow data
   * @param {Object} data - The DeArrow API response data
   */
  function updateData(data) {
    currentDeArrowData = data;
    
    if (isEnabled && currentDeArrowData) {
      applyDeArrow();
    }
  }
  
  /**
   * Clean up DeArrow functionality
   */
  function cleanup() {
    // Disconnect observers
    if (titleObserver) {
      titleObserver.disconnect();
      titleObserver = null;
    }
    
    if (thumbnailObserver) {
      thumbnailObserver.disconnect();
      thumbnailObserver = null;
    }
    
    // Reset data
    currentDeArrowData = null;
  }
  
  /**
   * Update the module settings
   * @param {Object} newSettings - The new settings to apply
   */
  function updateSettings(newSettings) {
    if (newSettings && typeof newSettings.dearrowEnabled !== 'undefined') {
      const wasEnabled = isEnabled;
      isEnabled = newSettings.dearrowEnabled === true;
      
      // If state changed, take appropriate action
      if (wasEnabled !== isEnabled) {
        if (isEnabled && currentDeArrowData) {
          applyDeArrow();
        } else if (!isEnabled) {
          cleanup();
        }
      }
    }
  }
  
  // Return the public API
  return {
    apply: applyDeArrow,
    cleanup,
    updateSettings,
    updateData,
    isEnabled: () => isEnabled
  };
}

module.exports = initDeArrow;
