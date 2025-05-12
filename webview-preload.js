// This script runs in the context of the webview that loads YouTube
// It can interact with the YouTube page directly

// Settings object to store feature states
let settings = {
  adBlockingEnabled: true,
  sponsorBlockEnabled: true,
  dearrowEnabled: true,
  returnDislikeEnabled: true
};

// Store for active video information
let currentVideoData = {
  videoId: null,
  title: null,
  url: null,
  sponsorSegments: [],
  deArrowData: null,
  dislikeData: null
};

// Check if we're on YouTube
const isYouTube = () => {
  return window.location.hostname.includes('youtube.com');
};

// Helper to detect when YouTube has fully loaded
const onYouTubeLoaded = (callback) => {
  if (document.readyState === 'complete' && document.querySelector('ytd-app')) {
    callback();
  } else {
    const observer = new MutationObserver((mutations, obs) => {
      if (document.querySelector('ytd-app')) {
        obs.disconnect();
        callback();
      }
    });
    
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
};

// Function to extract video ID from URL
const getVideoIdFromUrl = (url) => {
  const urlObj = new URL(url || window.location.href);
  const videoId = urlObj.searchParams.get('v');
  return videoId;
};

// Function to check if we're on a video page
const isVideoPage = () => {
  return window.location.pathname === '/watch' && getVideoIdFromUrl();
};

// Function to get the YouTube player element
const getPlayer = () => {
  return document.querySelector('#movie_player') || document.querySelector('.html5-video-player');
};

// Function to get the video element
const getVideo = () => {
  return document.querySelector('video');
};

// Message passing between webview and parent window
window.addEventListener('message', (event) => {
  // Handle messages from the parent window
  const { type, data } = event.data;
  
  if (type === 'get-video-info') {
    // Get current video info and send it back to the parent
    const videoId = getVideoIdFromUrl();
    if (videoId) {
      window.parent.postMessage({
        type: 'video-info',
        data: {
          videoId,
          url: window.location.href,
          title: document.title.replace(' - YouTube', '')
        }
      }, '*');
    }
  } else if (type === 'update-settings') {
    // Update settings from parent
    settings = { ...settings, ...data };
    applySettings();
  } else if (type === 'sponsor-segments-updated') {
    // Update sponsor segments data
    currentVideoData.sponsorSegments = data.segments;
    if (settings.sponsorBlockEnabled) {
      setupSponsorSkipping();
    }
  } else if (type === 'dearrow-data-updated') {
    // Update DeArrow data
    currentVideoData.deArrowData = data;
    if (settings.dearrowEnabled) {
      applyDeArrow();
    }
  } else if (type === 'dislike-data-updated') {
    // Update dislike data
    currentVideoData.dislikeData = data;
    if (settings.returnDislikeEnabled) {
      applyReturnDislike();
    }
  }
});

// Function to send video ID to parent when it changes
const sendVideoIdToParent = () => {
  const videoId = getVideoIdFromUrl();
  if (videoId && videoId !== currentVideoData.videoId) {
    currentVideoData.videoId = videoId;
    currentVideoData.url = window.location.href;
    currentVideoData.title = document.title.replace(' - YouTube', '');
    
    window.parent.postMessage({
      type: 'video-id-changed',
      data: {
        videoId,
        url: currentVideoData.url,
        title: currentVideoData.title
      }
    }, '*');
  }
};

// Client-side ad handling with minimal CSS and skip button clicking
// This approach is gentler to ensure videos still play properly

// This function injects CSS to hide non-essential ad elements
function injectCustomStyles() {
  const style = document.createElement('style');
  style.id = 'ytview-custom-styles';
  style.textContent = `
    /* Ad blocking styles - only target non-essential elements */
    ${settings.adBlockingEnabled ? `
    /* Hide ad overlays but not the main player */
    .ytp-ad-overlay-container,
    .ytp-ad-message-container,
    ytd-display-ad-renderer,
    ytd-compact-promoted-video-renderer,
    ytd-promoted-video-renderer,
    ytd-ad-slot-renderer,
    ytd-in-feed-ad-layout-renderer,
    ytd-banner-promo-renderer {
      display: none !important;
    }
    ` : ''}

    /* Return YouTube Dislike styles */
    ${settings.returnDislikeEnabled ? `
    .ytview-dislike-counter {
      margin-left: 4px;
      color: var(--yt-spec-text-secondary);
      margin-top: 1px;
    }
    ` : ''}

    /* DeArrow styles */
    ${settings.dearrowEnabled ? `
    .ytview-dearrow-title {
      font-style: italic;
      color: #2ba640 !important;
    }
    ` : ''}
  `;
  
  // Remove any existing styles first
  const existingStyle = document.getElementById('ytview-custom-styles');
  if (existingStyle) {
    existingStyle.remove();
  }
  
  document.head.appendChild(style);
}

// SponsorBlock implementation
function setupSponsorSkipping() {
  if (!settings.sponsorBlockEnabled || !currentVideoData.sponsorSegments || currentVideoData.sponsorSegments.length === 0) {
    return;
  }
  
  const video = getVideo();
  if (!video) return;
  
  // Clear any existing time update listeners
  video.removeEventListener('timeupdate', handleTimeUpdate);
  
  // Add time update listener to check for sponsor segments
  video.addEventListener('timeupdate', handleTimeUpdate);
  
  console.log('SponsorBlock initialized with', currentVideoData.sponsorSegments.length, 'segments');
}

// Handle video time updates for SponsorBlock
function handleTimeUpdate() {
  const video = getVideo();
  if (!video || !settings.sponsorBlockEnabled || !currentVideoData.sponsorSegments) return;
  
  const currentTime = video.currentTime;
  
  // Check if we're in a sponsor segment
  for (const segment of currentVideoData.sponsorSegments) {
    if (currentTime >= segment.segment[0] && currentTime < segment.segment[1]) {
      // Skip to the end of the segment
      video.currentTime = segment.segment[1];
      
      // Show a notification
      showNotification(`Skipped ${segment.category} segment`);
      break;
    }
  }
}

// DeArrow implementation to improve titles and thumbnails
function applyDeArrow() {
  if (!settings.dearrowEnabled || !currentVideoData.deArrowData) return;
  
  // Replace titles with DeArrow titles
  if (currentVideoData.deArrowData.titles && currentVideoData.deArrowData.titles.length > 0) {
    // Get all title elements
    const titleElements = document.querySelectorAll('h1.ytd-watch-metadata, #video-title');
    
    titleElements.forEach(element => {
      // Apply the DeArrow title
      const originalText = element.textContent;
      const newTitle = currentVideoData.deArrowData.titles[0].text;
      
      if (newTitle && originalText !== newTitle) {
        element.textContent = newTitle;
        element.classList.add('ytview-dearrow-title');
      }
    });
  }
}

// Return YouTube Dislike implementation
function applyReturnDislike() {
  if (!settings.returnDislikeEnabled || !currentVideoData.dislikeData) return;
  
  // Find the like button container
  const likeButton = document.querySelector('ytd-toggle-button-renderer, .like-button-renderer');
  if (!likeButton) return;
  
  // Get the dislike button
  const dislikeButton = likeButton.nextElementSibling;
  if (!dislikeButton) return;
  
  // Check if we already added the dislike count
  const existingCounter = dislikeButton.querySelector('.ytview-dislike-counter');
  if (existingCounter) {
    existingCounter.textContent = formatCount(currentVideoData.dislikeData.dislikes);
    return;
  }
  
  // Create counter element
  const counter = document.createElement('span');
  counter.className = 'ytview-dislike-counter';
  counter.textContent = formatCount(currentVideoData.dislikeData.dislikes);
  
  // Add counter to dislike button
  dislikeButton.appendChild(counter);
}

// Helper to format counts for display (e.g., 1.5K, 2.3M)
function formatCount(count) {
  if (!count) return '0';
  if (count < 1000) return count.toString();
  if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
  return (count / 1000000).toFixed(1) + 'M';
}

// Show notification for events like sponsor skipping
function showNotification(message) {
  // Create notification element if it doesn't exist
  let notification = document.getElementById('ytview-notification');
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'ytview-notification';
    notification.style = `
      position: absolute;
      bottom: 60px;
      left: 20px;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 9999;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(notification);
  }
  
  // Show notification
  notification.textContent = message;
  notification.style.opacity = '1';
  
  // Hide after 2 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
  }, 2000);
}

// Simple client-side ad handling function
function setupAdBlocking() {
  // 1. Apply CSS to hide ad elements
  injectCustomStyles();
  
  // 2. Set up a MutationObserver to detect ad elements and handle them
  const adObserver = new MutationObserver(() => {
    if (!settings.adBlockingEnabled) return;
    handleAdElements();
  });
  
  // Start observing the document
  adObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
  
  // Also set up ad detection on an interval as backup
  setInterval(() => {
    if (settings.adBlockingEnabled) {
      handleAdElements();
    }
  }, 1000);
}

// Function to handle advertisement elements
function handleAdElements() {
  const video = document.querySelector('video');
  if (!video) return;
  
  const player = document.getElementById('movie_player');
  if (!player) return;
  
  // Check if we're in an ad
  const isAdShowing = player.classList.contains('ad-showing');
  
  // Global variable to track if banner is already showing
  window.ytViewAdBannerShowing = window.ytViewAdBannerShowing || false;
  
  if (isAdShowing) {
    // 1. Click skip button if available
    const skipButton = document.querySelector('.ytp-ad-skip-button');
    if (skipButton) {
      skipButton.click();
    }
    
    // 2. No audio muting - we're removing this functionality to avoid Bluetooth audio profile switching
    // Just use the banner to indicate an ad is detected
    
    // 3. Show "Detected ad" banner if not already visible
    if (!window.ytViewAdBannerShowing) {
      const adBanner = document.createElement('div');
      adBanner.id = 'ytview-ad-banner';
      adBanner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to right, #ff5f6d, #ffc371);
        color: white;
        font-weight: bold;
        text-align: center;
        padding: 10px;
        z-index: 9999;
        font-size: 16px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      `;
      
      // Create banner content with logo and text
      adBanner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center;">
          <span style="margin-right: 10px;">🛡️</span>
          <span>YTView: Ad Detected - Audio Muted</span>
          <span style="margin-left: 10px;">⏱️ <span id="ytview-ad-timer">0</span>s</span>
        </div>
      `;
      
      document.body.appendChild(adBanner);
      window.ytViewAdBannerShowing = true;
      
      // Set up a timer to count seconds the ad is playing
      let seconds = 0;
      window.ytViewAdTimer = setInterval(() => {
        seconds++;
        const timerElement = document.getElementById('ytview-ad-timer');
        if (timerElement) {
          timerElement.textContent = seconds;
        }
      }, 1000);
    }
  } else {
    // No audio unmuting needed since we're not muting anymore
    
    // Remove the ad banner if it exists
    if (window.ytViewAdBannerShowing) {
      const adBanner = document.getElementById('ytview-ad-banner');
      if (adBanner) {
        adBanner.remove();
      }
      window.ytViewAdBannerShowing = false;
      
      // Clear the timer
      if (window.ytViewAdTimer) {
        clearInterval(window.ytViewAdTimer);
        window.ytViewAdTimer = null;
      }
    }
  }
}

// Apply all enabled features
function applySettings() {
  // Ad blocking is now primarily handled at the network level in the main process
  // We just apply CSS as a fallback for any ads that might slip through
  injectCustomStyles();
  
  // Apply SponsorBlock if enabled
  if (settings.sponsorBlockEnabled) {
    setupSponsorSkipping();
  }
  
  // Apply DeArrow if enabled and data is available
  if (settings.dearrowEnabled && currentVideoData.deArrowData) {
    applyDeArrow();
  }
  
  // Apply Return YouTube Dislike if enabled and data is available
  if (settings.returnDislikeEnabled && currentVideoData.dislikeData) {
    applyReturnDislike();
  }
}

// Initialize monitoring for URL/video changes
function initializeMonitoring() {
  // Apply initial settings and activate ad blocking immediately
  applySettings();
  
  // Specifically set up ad blocking right away
  if (settings.adBlockingEnabled) {
    setupAdBlocking();
  }
  
  // Send current video ID if on a video page
  if (isVideoPage()) {
    sendVideoIdToParent();
  }
  
  // Setup URL change monitoring (for SPAs like YouTube)
  let lastUrl = window.location.href;
  const urlChangeChecker = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      handleLocationChange();
    }
  }, 1000);
  
  // Also monitor for history state changes
  window.addEventListener('popstate', handleLocationChange);
  window.addEventListener('pushstate', handleLocationChange);
  window.addEventListener('replacestate', handleLocationChange);
}

// Handle location/URL changes
function handleLocationChange() {
  // First clean up any existing ad blocking
  cleanupAdBlocking();
  
  if (isVideoPage()) {
    sendVideoIdToParent();
  } else {
    // Reset current video data when leaving a video page
    currentVideoData = {
      videoId: null,
      title: null,
      url: null,
      sponsorSegments: [],
      deArrowData: null,
      dislikeData: null
    };
  }
  
  // Always reapply settings when page changes
  applySettings();
  
  // Specifically reapply ad blocking since we need to attach to the new player
  if (settings.adBlockingEnabled) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      setupAdBlocking();
    }, 500);
  }
}

// Completely block all audio APIs that might trigger Bluetooth headphones switching to call mode
function preventMediaAccessRequests() {
  // This approach is much more aggressive and should fix the issue
  try {
    // 1. Completely override getUserMedia
    if (navigator.mediaDevices) {
      // Remove the entire mediaDevices object
      Object.defineProperty(navigator, 'mediaDevices', {
        get: function() { return undefined; },
        configurable: false
      });
    }
    
    // 2. Completely disable AudioContext creation
    window.AudioContext = window.webkitAudioContext = function() {
      throw new Error('AudioContext disabled by YTView to prevent Bluetooth mode switching');
    };
    
    // 3. Block all permission requests
    if (navigator.permissions) {
      navigator.permissions.query = function() {
        return Promise.reject(new Error('Permissions API disabled by YTView'));
      };
    }
    
    // 4. Force YouTube to use basic non-worklet audio (happens on page refresh)
    document.addEventListener('visibilitychange', function() {
      setTimeout(() => {
        // Find all video elements and rebuild them with simpler audio output
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          if (video && !video.getAttribute('ytview-processed')) {
            // Mark as processed to avoid infinite loops
            video.setAttribute('ytview-processed', 'true');
            
            // Force audio to use basic non-worklet path
            video.crossOrigin = 'anonymous';
            video.disableRemotePlayback = true;
            
            // Add audio error handling
            video.addEventListener('error', (e) => {
              console.log('Video error handled by YTView:', e);
              // Recover from errors automatically
              setTimeout(() => video.load(), 1000);
            });
          }
        });
      }, 500); // Small delay to let YouTube finish its own initialization
    });
    
    console.log('Aggressive audio API blocking applied');
  } catch (error) {
    console.error('Error while setting up audio blocking:', error);
  }
}

// Wait for the page to fully load before initializing
window.addEventListener('load', () => {
  // Block media access first thing
  preventMediaAccessRequests();
  
  // Only initialize on YouTube
  if (isYouTube()) {
    onYouTubeLoaded(() => {
      // Apply all features
      applySettings();
      
      // Start monitoring for video/URL changes
      initializeMonitoring();
      
      // Initial setup of ad blocking
      setupAdBlocking();
      
      // Send settings request to parent
      window.parent.postMessage({
        type: 'request-settings'
      }, '*');
    });
  }
});
