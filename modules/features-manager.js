// Features Manager for YTView
// Central module that coordinates all feature modules

// Import individual feature modules
const initAdBlocker = require('./ad-blocker');
const initSponsorBlock = require('./sponsorblock');
const initDeArrow = require('./dearrow');
const initReturnDislike = require('./return-dislike');
const initDownload = require('./download');

/**
 * Initialize the Features Manager
 * @param {Object} initialSettings - Initial application settings
 * @returns {Object} - Features Manager interface
 */
function initFeaturesManager(initialSettings = {}) {
  // Default settings
  const defaultSettings = {
    adBlockingEnabled: true,
    sponsorBlockEnabled: true,
    dearrowEnabled: true,
    returnDislikeEnabled: true
  };
  
  // Current settings
  const settings = { ...defaultSettings, ...initialSettings };
  
  // Initialize all feature modules
  const adBlocker = initAdBlocker(settings);
  const sponsorBlock = initSponsorBlock(settings);
  const deArrow = initDeArrow(settings);
  const returnDislike = initReturnDislike(settings);
  const download = initDownload(settings);
  
  // Video data storage
  let currentVideoData = {
    videoId: null,
    title: null,
    url: null,
    sponsorSegments: [],
    deArrowData: null,
    dislikeData: null
  };
  
  /**
   * Initialize all features on page load
   */
  function initializeFeatures() {
    console.log('Initializing all features with settings:', settings);
    
    // Initialize each feature module
    if (settings.adBlockingEnabled) {
      adBlocker.setup();
    }
    
    // Other features are initialized when video data is available
  }
  
  /**
   * Update settings for all features
   * @param {Object} newSettings - New settings
   */
  function updateSettings(newSettings) {
    if (!newSettings) return;
    
    // Update internal settings
    Object.assign(settings, newSettings);
    
    // Update each feature module
    adBlocker.updateSettings(newSettings);
    sponsorBlock.updateSettings(newSettings);
    deArrow.updateSettings(newSettings);
    returnDislike.updateSettings(newSettings);
    
    console.log('Updated all feature settings:', settings);
  }
  
  /**
   * Handle when URL/location changes
   */
  function handleLocationChange() {
    // Reset video data when navigating away from video
    if (!isVideoPage()) {
      resetVideoData();
    } else {
      // On video page, send video ID to parent
      sendVideoIdToParent();
    }
    
    // Re-apply features
    applyFeatures();
  }
  
  /**
   * Reset video data when navigating away
   */
  function resetVideoData() {
    currentVideoData = {
      videoId: null,
      title: null,
      url: null,
      sponsorSegments: [],
      deArrowData: null,
      dislikeData: null
    };
    
    // Let download module know we've navigated away
    download.resetVideoInfo();
  }
  
  /**
   * Apply all features based on current settings and video data
   */
  function applyFeatures() {
    // Always re-apply ad blocking since we need to attach to new page elements
    if (settings.adBlockingEnabled) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        adBlocker.setup();
      }, 100);
    }
    
    // Apply other features only if we have the required data
    if (currentVideoData.videoId) {
      if (settings.sponsorBlockEnabled && currentVideoData.sponsorSegments.length > 0) {
        sponsorBlock.updateSegments(currentVideoData.sponsorSegments);
        sponsorBlock.setup();
      }
      
      if (settings.dearrowEnabled && currentVideoData.deArrowData) {
        deArrow.updateData(currentVideoData.deArrowData);
        deArrow.apply();
      }
      
      if (settings.returnDislikeEnabled && currentVideoData.dislikeData) {
        returnDislike.updateData(currentVideoData.dislikeData);
        returnDislike.apply();
      }
    }
  }
  
  /**
   * Check if current page is a YouTube video page
   * @returns {boolean} - True if on a video page
   */
  function isVideoPage() {
    return window.location.pathname === '/watch' && getVideoIdFromUrl();
  }
  
  /**
   * Extract video ID from URL
   * @returns {string|null} - Video ID or null
   */
  function getVideoIdFromUrl() {
    try {
      const urlObj = new URL(window.location.href);
      return urlObj.searchParams.get('v');
    } catch (error) {
      console.error('Error extracting video ID:', error);
      return null;
    }
  }
  
  /**
   * Send video ID to parent window
   */
  function sendVideoIdToParent() {
    const videoId = getVideoIdFromUrl();
    if (videoId) {
      // Update current video data
      currentVideoData.videoId = videoId;
      currentVideoData.url = window.location.href;
      currentVideoData.title = document.title.replace(' - YouTube', '');
      
      // Send to parent for API data fetching
      window.parent.postMessage({
        type: 'video-id-changed',
        data: {
          videoId,
          url: window.location.href,
          title: document.title.replace(' - YouTube', '')
        }
      }, '*');
      
      // Update download module
      download.updateVideoInfo({
        videoId,
        url: window.location.href,
        title: document.title.replace(' - YouTube', '')
      });
    }
  }
  
  /**
   * Update SponsorBlock data
   * @param {Array} segments - Sponsor segments to skip
   */
  function updateSponsorBlockData(segments) {
    if (!segments) return;
    
    currentVideoData.sponsorSegments = segments;
    
    if (settings.sponsorBlockEnabled) {
      sponsorBlock.updateSegments(segments);
      sponsorBlock.setup();
    }
  }
  
  /**
   * Update DeArrow data
   * @param {Object} data - DeArrow API data
   */
  function updateDeArrowData(data) {
    if (!data) return;
    
    currentVideoData.deArrowData = data;
    
    if (settings.dearrowEnabled) {
      deArrow.updateData(data);
      deArrow.apply();
    }
  }
  
  /**
   * Update Return YouTube Dislike data
   * @param {Object} data - Dislike data
   */
  function updateDislikeData(data) {
    if (!data) return;
    
    currentVideoData.dislikeData = data;
    
    if (settings.returnDislikeEnabled) {
      returnDislike.updateData(data);
      returnDislike.apply();
    }
  }
  
  /**
   * Force all features to re-initialize
   */
  function forceReinitialize() {
    // Cleanup all features
    cleanup();
    
    // Re-initialize after a short delay
    setTimeout(() => {
      initializeFeatures();
      applyFeatures();
    }, 100);
  }
  
  /**
   * Clean up all features
   */
  function cleanup() {
    adBlocker.cleanup();
    sponsorBlock.cleanup();
    deArrow.cleanup();
    returnDislike.cleanup();
  }
  
  /**
   * Handle messages from parent window
   * @param {MessageEvent} event - Message event
   */
  function handleMessage(event) {
    // We can only accept messages from our parent
    if (event.source !== window.parent) return;
    
    const { type, data } = event.data;
    
    switch (type) {
      case 'update-settings':
        updateSettings(data);
        break;
        
      case 'sponsor-segments-updated':
        updateSponsorBlockData(data.segments);
        break;
        
      case 'dearrow-data-updated':
        updateDeArrowData(data);
        break;
        
      case 'dislike-data-updated':
        updateDislikeData(data);
        break;
        
      case 'initialize-ad-blocking':
        adBlocker.forceInitialize();
        break;
        
      case 'get-video-info':
        sendVideoIdToParent();
        break;
    }
  }
  
  // Return the public API
  return {
    init: initializeFeatures,
    updateSettings,
    handleLocationChange,
    applyFeatures,
    handleMessage,
    forceReinitialize,
    cleanup,
    getCurrentSettings: () => ({ ...settings }),
    getFeatureModules: () => ({
      adBlocker,
      sponsorBlock,
      deArrow,
      returnDislike,
      download
    })
  };
}

module.exports = initFeaturesManager;
