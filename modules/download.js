// Download Module for YTView
// Handles video download functionality

/**
 * Initialize the Download module
 * @param {Object} settings - The application settings
 * @returns {Object} - Module interface
 */
function initDownload(settings) {
  // Internal state
  let isEnabled = true; // Downloads are always available
  let currentVideoInfo = null;
  
  /**
   * Extract video information from the current page
   * @returns {Object|null} - Video information or null if not on a video page
   */
  function extractVideoInfo() {
    if (!isVideoPage()) {
      return null;
    }
    
    // Get video ID from URL
    const videoId = getVideoIdFromUrl();
    if (!videoId) {
      return null;
    }
    
    // Get video title
    const title = document.title.replace(' - YouTube', '');
    
    return {
      videoId,
      title,
      url: window.location.href
    };
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
   * Update video information
   * @param {Object} videoInfo - Video information
   */
  function updateVideoInfo(videoInfo) {
    currentVideoInfo = videoInfo;
  }
  
  /**
   * Get current video information
   * @returns {Object|null} - Current video information
   */
  function getVideoInfo() {
    // If we don't have video info yet, try to extract it
    if (!currentVideoInfo) {
      currentVideoInfo = extractVideoInfo();
    }
    
    return currentVideoInfo;
  }
  
  /**
   * Reset video information (e.g., when navigating away)
   */
  function resetVideoInfo() {
    currentVideoInfo = null;
  }
  
  // Return the public API
  return {
    isEnabled: () => isEnabled,
    getVideoInfo,
    updateVideoInfo,
    resetVideoInfo,
    extractVideoInfo
  };
}

module.exports = initDownload;
