// API Manager Module for YTView Main Process
// Handles all API integrations and data fetching

const axios = require('axios');
const fetch = require('node-fetch');

/**
 * Initialize the API Manager
 * @returns {Object} - API manager interface
 */
function initApiManager() {
  // API endpoints
  const API = {
    SPONSORBLOCK: 'https://sponsor.ajay.app/api/',
    DEARROW: 'https://sponsor.ajay.app/api/branding/', // DeArrow API
    RETURN_DISLIKE: 'https://returnyoutubedislikesapi.com/votes?videoId='
  };
  
  // Cache for API responses
  const cacheStore = new Map();
  
  /**
   * Clear expired cache entries
   */
  function cleanupCache() {
    const now = Date.now();
    for (const [key, entry] of cacheStore.entries()) {
      if (now > entry.expires) {
        cacheStore.delete(key);
      }
    }
  }
  
  /**
   * Get SponsorBlock segments for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} - API response
   */
  async function getSponsorBlockSegments(videoId) {
    if (!videoId) {
      return { success: false, error: 'No video ID provided' };
    }
    
    const cacheKey = `sponsorblock:${videoId}`;
    
    // Check cache first
    if (cacheStore.has(cacheKey)) {
      const cachedData = cacheStore.get(cacheKey);
      if (Date.now() < cachedData.expires) {
        return { success: true, data: cachedData.data };
      }
    }
    
    try {
      // Fetch from SponsorBlock API
      const response = await axios.get(`${API.SPONSORBLOCK}skipSegments?videoID=${videoId}`);
      
      // Process the response
      if (response.status === 200) {
        // Cache for 1 hour
        cacheStore.set(cacheKey, {
          data: response.data,
          expires: Date.now() + 3600000
        });
        
        return { success: true, data: { segments: response.data } };
      } else {
        return { success: false, error: `API returned status ${response.status}` };
      }
    } catch (error) {
      console.error('Error fetching SponsorBlock data:', error);
      
      // Return empty segments if API is down or video has no segments
      if (error.response && error.response.status === 404) {
        return { success: true, data: { segments: [] } };
      }
      
      return { success: false, error: error.message || 'Unknown error' };
    }
  }
  
  /**
   * Get DeArrow data for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} - API response
   */
  async function getDeArrowData(videoId) {
    if (!videoId) {
      return { success: false, error: 'No video ID provided' };
    }
    
    const cacheKey = `dearrow:${videoId}`;
    
    // Check cache first
    if (cacheStore.has(cacheKey)) {
      const cachedData = cacheStore.get(cacheKey);
      if (Date.now() < cachedData.expires) {
        return { success: true, data: cachedData.data };
      }
    }
    
    try {
      // Fetch from DeArrow API
      const response = await axios.get(`${API.DEARROW}videos/${videoId}`);
      
      // Process the response
      if (response.status === 200) {
        const data = response.data;
        
        // Cache for 1 hour
        cacheStore.set(cacheKey, {
          data: data,
          expires: Date.now() + 3600000
        });
        
        return { success: true, data: data };
      } else {
        return { success: false, error: `API returned status ${response.status}` };
      }
    } catch (error) {
      console.error('Error fetching DeArrow data:', error);
      
      // Return empty data if API is down or video has no data
      if (error.response && error.response.status === 404) {
        return { success: true, data: { titles: [], thumbnails: [] } };
      }
      
      return { success: false, error: error.message || 'Unknown error' };
    }
  }
  
  /**
   * Get Return YouTube Dislike data for a video
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object>} - API response
   */
  async function getDislikeCount(videoId) {
    if (!videoId) {
      return { success: false, error: 'No video ID provided' };
    }
    
    const cacheKey = `dislike:${videoId}`;
    
    // Check cache first
    if (cacheStore.has(cacheKey)) {
      const cachedData = cacheStore.get(cacheKey);
      if (Date.now() < cachedData.expires) {
        return { success: true, data: cachedData.data };
      }
    }
    
    try {
      // Fetch from Return YouTube Dislike API
      const response = await fetch(`${API.RETURN_DISLIKE}${videoId}`);
      
      // Process the response
      if (response.ok) {
        const data = await response.json();
        
        // Cache for 1 hour
        cacheStore.set(cacheKey, {
          data: data,
          expires: Date.now() + 3600000
        });
        
        return { success: true, data: data };
      } else {
        return { success: false, error: `API returned status ${response.status}` };
      }
    } catch (error) {
      console.error('Error fetching dislike data:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }
  
  // Run cache cleanup every 15 minutes
  setInterval(cleanupCache, 900000);
  
  // Return the public API
  return {
    getSponsorBlockSegments,
    getDeArrowData,
    getDislikeCount
  };
}

module.exports = initApiManager;
