// YTView WebView Preload Script
// This script runs in the context of the webview and interacts with YouTube directly

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

// Track state for ad blocking
let adBannerShowing = false;
let adCheckInterval = null;

/**
 * Check if we're on YouTube
 * @returns {boolean} - True if on YouTube
 */
const isYouTube = () => {
  return window.location.hostname.includes('youtube.com');
};

/**
 * Helper to detect when YouTube has fully loaded
 * @param {Function} callback - Function to call when YouTube is loaded
 */
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

/**
 * Block audio APIs to prevent Bluetooth headphones switching modes
 */
function preventMediaAccessRequests() {
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

/**
 * Set up ad blocking on a YouTube page
 */
function setupAdBlocking() {
  // Immediately return if ad blocking is disabled
  if (!settings.adBlockingEnabled) {
    return;
  }
  
  // Track setup with a static flag to avoid repetitive logging
  if (!setupAdBlocking.setupComplete) {
    console.log('Setting up ad blocking - initial configuration');
    setupAdBlocking.setupComplete = true;
    
    // Inject CSS to hide ad elements
    injectAdBlockingCSS();
  }
  
  // Set up a less frequent interval check for ads
  if (adCheckInterval) {
    clearInterval(adCheckInterval);
  }
  
  // Use a more frequent interval (every 500ms) for more responsive ad detection
  adCheckInterval = setInterval(() => {
    if (settings.adBlockingEnabled) {
      handleAdElements();
    }
  }, 500);
  
  // Add smart event listeners that only trigger when needed
  // This debounced listener prevents excessive checks
  let lastCheck = 0;
  const debouncedVideoListener = (event) => {
    const now = Date.now();
    // Only check if enough time has passed (300ms) since last check
    if (settings.adBlockingEnabled && now - lastCheck > 300) {
      lastCheck = now;
      handleAdElements();
    }
  };
  
  // Focus on the most important events for ad detection
  // - 'play' event usually fires when an ad starts
  // - 'emptied' event typically fires when content changes (like ad insertion)
  // - 'timeupdate' catches ads that might slip through other events
  // - 'seeking' can indicate ad insertion points
  document.addEventListener('play', debouncedVideoListener, true);
  document.addEventListener('emptied', debouncedVideoListener, true);
  document.addEventListener('timeupdate', debouncedVideoListener, true);
  document.addEventListener('seeking', debouncedVideoListener, true);
  document.addEventListener('canplay', debouncedVideoListener, true);
  
  // Use a MutationObserver to detect ad element insertions
  // This is more efficient than constantly polling
  adObserverInstance = new MutationObserver((mutations) => {
    // Only process mutations if needed
    if (!settings.adBlockingEnabled) return;
    
    // Debounce the handling to prevent excessive calls
    let shouldCheck = false;
    
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        // Check if any added node has ad-related classes
        const hasAdNodes = Array.from(mutation.addedNodes).some(node => {
          return node.classList && (
            node.classList.contains('ytp-ad-player-overlay') || 
            node.classList.contains('ytp-ad-text') ||
            node.classList.contains('ytp-ad-skip-button')
          );
        });
        
        if (hasAdNodes) {
          shouldCheck = true;
          break;
        }
      }
    }
    
    if (shouldCheck) {
      console.log('YTView: Ad-related DOM changes detected');
      handleAdElements();
    }
  });
  
  // Start observing the player area for ad elements
  const playerArea = document.getElementById('movie_player');
  if (playerArea) {
    adObserverInstance.observe(playerArea, { childList: true, subtree: true });  
    console.log('YTView: Ad observer started monitoring player');
  }
}

// Previous ad state to avoid excessive logging
let prevAdState = false;
let detectCount = 0;

/**
 * Handle advertisement elements
 */
function handleAdElements() {
  // Immediately return if ad blocking is disabled
  if (!settings.adBlockingEnabled) {
    return;
  }
  
  const video = document.querySelector('video');
  if (!video) return;
  
  const player = document.getElementById('movie_player');
  if (!player) return;
  
  // Track detection count to reduce logging frequency
  detectCount++;
  const shouldLog = detectCount % 10 === 0; // Log every 10th check
  
  // Check the most reliable ad indicators
  // Use two separate approaches for redundancy

  // APPROACH 1: Check specific ad-related elements
  const adIndicators = {
    // These are direct indicators of an ad
    playerHasAdClass: player.classList.contains('ad-showing'),
    adPlayerOverlay: !!document.querySelector('.ytp-ad-player-overlay'),
    adTextPresent: !!document.querySelector('.ytp-ad-text'),
    skipButtonPresent: !!document.querySelector('.ytp-ad-skip-button'),
    adImageOverlay: !!document.querySelector('.ytp-ad-image-overlay'),
    previewTextPresent: !!document.querySelector('.ytp-ad-preview-text, .ytp-ad-preview-container'),
    
    // There are additional indicators we can use
    progressMarkerColor: document.querySelector('.ytp-progress-list')?.style.backgroundColor?.includes('red')
  };
  
  // APPROACH 2: Other signals and heuristics for ad detection
  const videoState = {
    hasAdUrl: video.src?.includes('googlevideo.com/videoplayback/')  && 
            (video.src?.includes('/ads/') || video.src?.includes('&adt=')),
    shortDuration: video.duration > 0 && video.duration < 60,
    hasProgressBar: !!document.querySelector('.ytp-ad-persistent-progress-bar-container'),
    infoButtonPresent: !!document.querySelector('.ytp-ad-info-dialog-button'),
    learnMoreButton: !!document.querySelector('.ytp-ad-button-text')?.textContent?.includes('Learn more')
  };
  
  // Get any ad text for debugging
  const adTextElement = document.querySelector('.ytp-ad-text');
  const adText = adTextElement ? adTextElement.textContent.trim() : '';
  
  // Count primary indicators - use a weighted approach
  const primaryIndicators = [
    adIndicators.playerHasAdClass,      // Very reliable
    adIndicators.adPlayerOverlay,       // Very reliable
    adIndicators.adTextPresent,         // Very reliable
    adIndicators.skipButtonPresent,     // Definitive, but not always present
    adIndicators.adImageOverlay,        // Strong indicator
    adIndicators.previewTextPresent,    // Strong indicator
    videoState.hasProgressBar,          // Good indicator
    videoState.hasAdUrl                 // Technical indicator
  ];
  
  const primaryIndicatorCount = primaryIndicators.filter(Boolean).length;
  
  // More sophisticated detection logic:
  // 1. Two or more primary indicators means definitely an ad
  // 2. Skip button alone is also a definitive sign of an ad
  // 3. Player having ad class plus another indicator is reliable
  const isAdShowing = primaryIndicatorCount >= 2 || 
                     adIndicators.skipButtonPresent || 
                     (adIndicators.playerHasAdClass && (adIndicators.adPlayerOverlay || adIndicators.adTextPresent));
  
  // Enhanced logging with detailed diagnostics - reduced frequency
  if (isAdShowing !== prevAdState || (shouldLog && detectCount % 100 === 0)) {
    const videoInfo = {
      currentTime: video.currentTime?.toFixed(1) || 'unknown',
      duration: video.duration?.toFixed(1) || 'unknown',
      paused: video.paused,
      ended: video.ended,
      src: video.src ? (video.src.substring(0, 60) + '...') : 'none'
    };

    const adDetailedInfo = {
      ...adIndicators,
      videoState: videoState,
      primaryIndicatorCount: primaryIndicatorCount,
      isSkippable: !!adIndicators.skipButtonPresent,
      adText: adText,
      playerClasses: player.className.split(' '),
      url: window.location.href
    };

    const timestamp = new Date().toISOString();
    
    // Only log detected ads or occasional status updates
    if (isAdShowing && isAdShowing !== prevAdState) {
      console.log(`%cYTView [${timestamp}]: AD DETECTED ✓`, 'background: #ff6b6b; color: white; font-weight: bold; padding: 2px 5px;');
      console.log('Ad indicators:', adIndicators);
    } else if (shouldLog && detectCount % 100 === 0) {
      console.log(`YTView [${timestamp}]: Status check - No ad detected (${primaryIndicatorCount} indicators)`);
    }
    
    // Handle state changes - especially for ad completion
    if (isAdShowing !== prevAdState) {
      if (isAdShowing) {
        console.log('YTView: Ad detection - Starting ad mitigation');
      } else {
        console.log('YTView: Ad finished - Returning to normal playback');
        
        // IMPORTANT: Immediately remove banner when ad finishes
        const adBanner = document.getElementById('ytview-ad-banner');
        if (adBanner) {
          console.log('YTView: Removing banner because ad finished');
          adBanner.remove();
          adBannerShowing = false;
        }
      }
    }
  }
  
  // Save previous state
  prevAdState = isAdShowing;
  
  // Only take action if we're certain this is an ad - we need 2+ indicators to be confident
  if (isAdShowing) {
    console.log('YTView: Taking action on detected ad');
    
    // 1. Click skip button if available
    const skipButton = document.querySelector('.ytp-ad-skip-button');
    if (skipButton) {
      console.log('YTView: Skip button found, clicking it');
      skipButton.click();
    } else {
      // If no skip button and we're very confident this is an ad, try to skip to the end
      if (primaryIndicatorCount >= 2) {
        try {
          // Check if it's a non-skippable ad
          const remainingElement = document.querySelector('.ytp-ad-text');
          if (remainingElement && video.duration && video.duration < 60) {
            // Only skip for shorter ads to avoid accidentally skipping actual videos
            // Go to the end of the ad
            console.log(`YTView: Attempting to skip non-skippable ad (duration: ${video.duration}s)`);
            video.currentTime = video.duration - 0.1;
            video.play();
          }
        } catch (e) {
          console.error('YTView: Error skipping ad:', e);
        }
      }
    }
    
    // 2. Directly manipulate the video element to prevent ad playback
    try {
      // Force mute during ads
      if (!video.muted) {
        video.muted = true;
        console.log('YTView: Muted ad audio');
      }
      
      // Hide the video element completely using inline styles
      video.style.display = 'none';
      video.style.visibility = 'hidden';
      video.style.opacity = '0';
      video.style.position = 'absolute';
      video.style.left = '-9999px';
      video.style.width = '1px';
      video.style.height = '1px';
      
      // Try to pause the video
      if (!video.paused) {
        video.pause();
        console.log('YTView: Paused ad video');
      }
      
      // Disable audio tracks if available
      if (video.audioTracks && video.audioTracks.length > 0) {
        for (let i = 0; i < video.audioTracks.length; i++) {
          video.audioTracks[i].enabled = false;
        }
      }
      
      // Add a one-time listener to restore video when ad ends
      const restoreVideo = () => {
        // Only restore if ad is no longer showing
        if (!player.classList.contains('ad-showing')) {
          // Restore video element
          video.style.display = '';
          video.style.visibility = '';
          video.style.opacity = '';
          video.style.position = '';
          video.style.left = '';
          video.style.width = '';
          video.style.height = '';
          
          // Unmute if it was muted by us
          video.muted = false;
          
          // Re-enable audio tracks
          if (video.audioTracks && video.audioTracks.length > 0) {
            for (let i = 0; i < video.audioTracks.length; i++) {
              video.audioTracks[i].enabled = true;
            }
          }
          
          // Remove this listener
          video.removeEventListener('timeupdate', restoreVideo);
          console.log('YTView: Restored video after ad');
        }
      };
      
      // Add the listener
      video.addEventListener('timeupdate', restoreVideo);
    } catch (e) {
      console.error('YTView: Error manipulating video element:', e);
    }
    
    // Simple banner handling: show when ad is present, hide when not
    const adBannerId = 'ytview-ad-banner';
    let existingBanner = document.getElementById(adBannerId);
    
    if (isAdShowing && !existingBanner) {
      // Only create banner if ad is showing and no banner exists
      console.log('YTView: Creating ad banner');
      
      // Create banner with clear styling
      const adBanner = document.createElement('div');
      adBanner.id = adBannerId;
      adBanner.style = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to right, #ff5f6d, #ffc371);
        color: white;
        padding: 6px 8px;
        text-align: center;
        z-index: 9999;
        font-weight: bold;
        font-size: 14px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      // Simple banner content
      const iconElement = document.createElement('span');
      iconElement.textContent = '🛡️';
      iconElement.style.marginRight = '8px';
      adBanner.appendChild(iconElement);
      
      const textElement = document.createElement('span');
      textElement.textContent = 'YTView: Ad Detected';
      adBanner.appendChild(textElement);
      
      const statusElement = document.createElement('span');
      statusElement.className = 'banner-status'; // Add class for selector
      statusElement.style.marginLeft = '8px';
      if (skipButton) {
        statusElement.textContent = '⏭️ Skipping...';
      } else {
        statusElement.textContent = '⏱️ Ad';
      }
      adBanner.appendChild(statusElement);
      
      // Add banner to page
      document.body.appendChild(adBanner);
      adBannerShowing = true;
    } 
    else if (!isAdShowing && existingBanner) {
      // Remove banner when no ad is showing
      console.log('YTView: Removing banner - no ad detected');
      existingBanner.remove();
      adBannerShowing = false;
    }
    else if (isAdShowing && existingBanner) {
      // Update existing banner if needed
      const statusEl = existingBanner.querySelector('.banner-status');
      if (statusEl) {
        if (skipButton && !statusEl.textContent.includes('Skipping')) {
          statusEl.textContent = '⏭️ Skipping...';
        } else if (!skipButton && !statusEl.textContent.includes('Ad')) {
          statusEl.textContent = '⏱️ Ad';
        }
      }
    }
  }
}

// Keep track of our MutationObserver for ad detection
let adObserverInstance = null;

/**
 * Inject CSS to hide ad elements
 */
function injectAdBlockingCSS() {
  const adBlockingCSS = `
    /* Hide ad containers */
    .ytp-ad-module,
    .ytp-ad-image-overlay,
    .ytp-ad-text-overlay,
    .ytp-ad-player-overlay,
    .ytp-ad-skip-button-container,
    .ytp-ad-persistent-progress-bar-container,
    .ytp-ad-progress-list,
    .ytp-ad-feedback-dialog-container,
    ytd-promoted-sparkles-web-renderer,
    ytd-promoted-video-renderer,
    ytd-display-ad-renderer,
    ytd-compact-promoted-video-renderer,
    ytd-promoted-sparkles-text-search-renderer,
    ytd-statement-banner-renderer,
    ytd-in-feed-ad-layout-renderer,
    ytd-banner-promo-renderer,
    ytd-video-masthead-ad-v3-renderer,
    ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
    .ytd-banner-promo-renderer-background,
    .ytd-mealbar-promo-renderer,
    .ytd-statement-banner-renderer,
    .masthead-ad-control,
    .style-scope.ytd-display-ad-renderer,
    .style-scope.ytd-statement-banner-renderer,
    .style-scope.ytd-ad-slot-renderer,
    .style-scope.ytd-in-feed-ad-layout-renderer,
    div[id^="player-ads"],
    div[id^="ad_creative_"],
    #masthead-ad {
      display: none !important;
    }
    
    /* COMPLETELY hide video during ads - this is critical */
    .html5-video-player.ad-showing .video-stream,
    .html5-video-player.ad-showing video {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      position: absolute !important;
      left: -9999px !important;
      top: -9999px !important;
      width: 1px !important;
      height: 1px !important;
      pointer-events: none !important;
      z-index: -9999 !important;
    }
    
    /* Hide all ad-related controls */
    .html5-video-player.ad-showing .ytp-chrome-bottom,
    .html5-video-player.ad-showing .ytp-chrome-top,
    .html5-video-player.ad-showing .ytp-progress-bar-container,
    .html5-video-player.ad-showing .ytp-ad-persistent-progress-bar-container,
    .html5-video-player.ad-showing .ytp-ad-skip-button-slot,
    .html5-video-player.ad-showing .ytp-ad-player-overlay,
    .html5-video-player.ad-showing .ytp-ad-player-overlay-instream-info,
    .html5-video-player.ad-showing .ytp-ad-text-overlay,
    .html5-video-player.ad-showing .ytp-ad-button-text,
    .html5-video-player.ad-showing .ytp-ad-visit-advertiser-button,
    .html5-video-player.ad-showing .ytp-ad-info-dialog-container,
    .html5-video-player.ad-showing .ytp-ad-feedback-dialog-container {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }
  `;
  
  // Create and insert the style element
  const style = document.createElement('style');
  style.id = 'ytview-ad-blocking-css';
  style.textContent = adBlockingCSS;
  document.head.appendChild(style);
  
  console.log('Ad blocking CSS injected');
}

/**
 * Clean up and remove all ad blocking functionality
 */
function cleanupAdBlocking() {
  console.log('Cleaning up ad blocking functionality');
  
  // Remove any existing ad banners
  const adBanner = document.getElementById('ytview-ad-banner');
  if (adBanner) {
    adBanner.remove();
  }
  
  // Reset ad banner flags
  adBannerShowing = false;
  
  // Clear ad check interval timer
  if (adCheckInterval) {
    clearInterval(adCheckInterval);
    adCheckInterval = null;
  }
  
  // Disconnect any active mutation observer
  if (adObserverInstance) {
    adObserverInstance.disconnect();
    adObserverInstance = null;
    console.log('Ad observer disconnected');
  }
  
  // Remove event listeners to prevent memory leaks
  try {
    document.removeEventListener('play', debouncedVideoListener, true);
    document.removeEventListener('emptied', debouncedVideoListener, true);
    console.log('Ad event listeners removed');
  } catch (e) {
    // Ignore errors if listeners were already removed
  }
}

/**
 * Function to extract video ID from URL
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
 * Check if current page is a YouTube video page
 */
function isVideoPage() {
  return window.location.pathname === '/watch' && getVideoIdFromUrl();
}

/**
 * Send video ID to parent when it changes
 */
function sendVideoIdToParent() {
  const videoId = getVideoIdFromUrl();
  if (videoId) {
    window.parent.postMessage({
      type: 'video-id-changed',
      data: {
        videoId,
        url: window.location.href,
        title: document.title.replace(' - YouTube', '')
      }
    }, '*');
  }
}

/**
 * Initialize URL change monitoring
 */
function initializeURLMonitoring() {
  let lastUrl = window.location.href;
  const urlChangeChecker = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      
      // Check if we're on a video page
      if (isVideoPage()) {
        sendVideoIdToParent();
      }
      
      // Re-setup ad blocking on page change
      if (settings.adBlockingEnabled) {
        setTimeout(() => {
          setupAdBlocking();
        }, 1000);
      }
    }
  }, 1000);
}

/**
 * Apply all features based on current settings
 */
function applyFeatures() {
  if (settings.adBlockingEnabled) {
    setupAdBlocking();
  } else {
    cleanupAdBlocking();
  }
  
  // Send video ID if on a video page
  if (isVideoPage()) {
    sendVideoIdToParent();
  }
}

// Message passing between webview and parent window
window.addEventListener('message', (event) => {
  // We can only accept messages from ourselves
  if (event.source !== window.parent) return;
  
  const { type, data } = event.data;
  
  if (type === 'update-settings') {
    // Check for ad blocking toggle specifically
    const adBlockingWasEnabled = settings.adBlockingEnabled;
    const adBlockingChanged = data.hasOwnProperty('adBlockingEnabled') && 
                          data.adBlockingEnabled !== adBlockingWasEnabled;
    
    // Update settings from parent
    settings = { ...settings, ...data };
    console.log('Settings updated:', settings);
    
    // Apply all settings
    applyFeatures();
    
    // Special handling for ad blocking toggle
    if (adBlockingChanged) {
      console.log('Ad blocking toggled to:', settings.adBlockingEnabled);
      if (settings.adBlockingEnabled) {
        // Re-initialize ad blocking
        setupAdBlocking();
      } else {
        // Clean up and remove ad blocking
        cleanupAdBlocking();
      }
    }
  } else if (type === 'sponsor-segments-updated') {
    // Update sponsor segments data
    currentVideoData.sponsorSegments = data.segments;
  } else if (type === 'dearrow-data-updated') {
    // Update DeArrow data
    currentVideoData.deArrowData = data;
  } else if (type === 'dislike-data-updated') {
    // Update dislike data
    currentVideoData.dislikeData = data;
  } else if (type === 'initialize-ad-blocking') {
    // Force ad blocking initialization, regardless of whether it's already initialized
    console.log('Forcing ad blocking initialization');
    if (settings.adBlockingEnabled) {
      // Clean up first to ensure we start fresh
      cleanupAdBlocking();
      // Set up ad blocking with a small delay to ensure DOM is ready
      setTimeout(() => {
        setupAdBlocking();
      }, 100);
    }
  } else if (type === 'request-settings') {
    // Send back current settings
    window.parent.postMessage({
      type: 'update-settings',
      data: settings
    }, '*');
  }
});

// Wait for the page to fully load before initializing
document.addEventListener('DOMContentLoaded', () => {
  console.log('YTView webview preload script initialized');
  
  // Test ad blocking by attempting to load a known ad URL
  setTimeout(() => {
    console.log('Testing ad blocking...');
    // Test multiple ad URLs to verify blocking
    const testUrls = [
      'https://googleads.g.doubleclick.net/pagead/id',
      'https://www.youtube.com/api/stats/ads?test=1',
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      'https://www.google-analytics.com/analytics.js',
      'https://www.googletagservices.com/tag/js/gpt.js'
    ];
    
    // Create test elements for each URL
    testUrls.forEach(url => {
      const testImg = document.createElement('img');
      testImg.style.display = 'none';
      testImg.src = url;
      document.body.appendChild(testImg);
      
      // Also try with fetch
      fetch(url)
        .then(() => console.log(`⚠️ WARNING: Ad URL not blocked: ${url}`))
        .catch(e => console.log(`✅ Ad URL blocked: ${url}`));
    });
  }, 3000);
  
  // Block media access first thing
  preventMediaAccessRequests();
  
  // Only initialize on YouTube
  if (isYouTube()) {
    console.log('Detected YouTube, initializing features');
    
    onYouTubeLoaded(() => {
      console.log('YouTube UI fully loaded, setting up features');
      
      // Apply all features
      applyFeatures();
      
      // Start monitoring for URL/location changes
      initializeURLMonitoring();
      
      // Request current settings from parent
      window.parent.postMessage({
        type: 'request-settings'
      }, '*');
    });
  }
});
