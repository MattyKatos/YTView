// Block audio contexts to prevent Bluetooth headphones from switching modes
(function() {
  // Aggressively block AudioContext creation
  window.AudioContext = function() { throw new Error('AudioContext blocked by YTView'); };
  window.webkitAudioContext = function() { throw new Error('webkitAudioContext blocked by YTView'); };
  
  // Disable media devices
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = function() {
      return Promise.reject(new Error('getUserMedia blocked by YTView'));
    };
  }
  
  console.log('Aggressive audio blocking initialized in renderer');
})();

// Set up ad blocking in the renderer through the preload bridge
// This ensures we maintain access to the window.api object

// Request the main process to enable direct ad blocking for our webview
// Set up aggressive ad blocking with retry mechanism
function setupAdBlocking() {
  console.log('Setting up aggressive ad blocking...');
  
  window.api.setupDirectAdBlocking({ 
    partition: 'persist:ytview',
    aggressive: true
  })
  .then(result => {
    if (result.success) {
      console.log('Ad blocking setup complete:', result);
    } else if (result.fallback) {
      console.warn('Using fallback ad blocking due to error:', result.error);
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  })
  .catch(err => {
    console.error('Error setting up ad blocking:', err);
    
    // Retry with simpler configuration after 2 seconds
    setTimeout(() => {
      console.log('Retrying ad blocking setup with simplified configuration...');
      window.api.setupDirectAdBlocking({ 
        partition: 'persist:ytview',
        simplified: true
      })
      .then(result => {
        if (result.success) {
          console.log('Simplified ad blocking setup complete');
        } else {
          console.error('Failed to set up even simplified ad blocking:', result.error);
        }
      })
      .catch(finalErr => {
        console.error('Final ad blocking setup error:', finalErr);
      });
    }, 2000);
  });
}

// Call the setup function
setupAdBlocking();

// Get elements
const webview = document.getElementById('youtubeView');
const urlInput = document.getElementById('urlInput');
const goBtn = document.getElementById('goBtn');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const refreshBtn = document.getElementById('refreshBtn');
const homeBtn = document.getElementById('homeBtn');
const devToolsBtn = document.getElementById('devToolsBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeBtn = document.getElementById('maximizeBtn');
const closeBtn = document.getElementById('closeBtn');
const toggleDownloadBtn = document.getElementById('toggleDownloadBtn');
const downloadPanel = document.querySelector('.download-panel');
const downloadUrl = document.getElementById('downloadUrl');
const downloadBtn = document.getElementById('downloadBtn');
const downloadsList = document.getElementById('downloadsList');

// Store active downloads
const activeDownloads = new Map();

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
  
  // Set up event listeners for window controls
  setupWindowControls();
  
  // Set up navigation controls
  setupNavigation();
  
  // Set up feature navigation and dropdowns
  setupFeatureNav();
  
  // Set up webview events
  setupWebviewEvents();
});

// Window control buttons
function setupWindowControls() {
  minimizeBtn.addEventListener('click', () => {
    window.api.minimizeWindow();
  });
  
  maximizeBtn.addEventListener('click', () => {
    window.api.maximizeWindow();
  });
  
  closeBtn.addEventListener('click', () => {
    window.api.closeWindow();
  });
}

// Navigation controls
function setupNavigation() {
  // Navigate to URL when Go button is clicked or Enter key is pressed
  goBtn.addEventListener('click', navigateToUrl);
  
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      navigateToUrl();
    }
  });
  
  // Back and forward navigation
  backBtn.addEventListener('click', () => {
    if (webview.canGoBack()) {
      webview.goBack();
    }
  });
  
  forwardBtn.addEventListener('click', () => {
    if (webview.canGoForward()) {
      webview.goForward();
    }
  });
  
  // Refresh the page
  refreshBtn.addEventListener('click', () => {
    // Use reload() instead of recreating the webview
    webview.reload();
  });
  
  // Go to YouTube home
  homeBtn.addEventListener('click', () => {
    // Use proper method for loading URLs in Electron webviews
    webview.loadURL('https://youtube.com');
  });
  
  // Developer tools for debugging
  devToolsBtn.addEventListener('click', () => {
    // Direct approach - open dev tools
    if (webview.openDevTools) {
      webview.openDevTools();
      console.log('DevTools opened directly');
    } else {
      // Fallback to API if direct method not available
      window.api.toggleWebviewDevTools()
        .then(success => {
          if (success) {
            console.log('DevTools toggle request successful');
          } else {
            console.error('Failed to toggle DevTools');
          }
        })
        .catch(err => {
          console.error('Error toggling DevTools:', err);
        });
    }
  });
}

// Navigate to URL or search YouTube
function navigateToUrl() {
  let url = urlInput.value.trim();
  
  // Check if input is a valid URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    // Check if it's a YouTube URL without protocol
    if (url.startsWith('youtube.com/') || url.startsWith('www.youtube.com/')) {
      url = 'https://' + url;
    }
    // Check if it's just a video ID
    else if (url.match(/^[a-zA-Z0-9_-]{11}$/)) {
      url = `https://www.youtube.com/watch?v=${url}`;
    }
    // Otherwise, treat as a search query
    else {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(url)}`;
    }
  }
  
  webview.src = url;
}

// Setup the feature navigation dropdowns
function setupFeatureNav() {
  // Select all feature toggle buttons
  const featureButtons = document.querySelectorAll('.feature-toggle-btn');
  
  // Handle feature button clicks
  featureButtons.forEach(button => {
    button.addEventListener('click', () => {
      const feature = button.getAttribute('data-feature');
      const dropdown = document.getElementById(`${feature}Dropdown`);
      
      // Close all other dropdowns
      document.querySelectorAll('.feature-dropdown').forEach(el => {
        if (el.id !== dropdown.id) {
          el.classList.remove('open');
        }
      });
      
      // Toggle this dropdown
      dropdown.classList.toggle('open');
      button.classList.toggle('active');
    });
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.feature-item')) {
      document.querySelectorAll('.feature-dropdown').forEach(dropdown => {
        dropdown.classList.remove('open');
      });
      document.querySelectorAll('.feature-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
      });
    }
  });
  
  // Setup download button click handler
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', startDownload);
  }
  
  // Set up download event listeners from main process
  window.api.onDownloadStarted(handleDownloadStarted);
  window.api.onDownloadProgress(handleDownloadProgress);
  window.api.onDownloadComplete(handleDownloadComplete);
  window.api.onDownloadError(handleDownloadError);
  
  // Load feature settings initially
  loadFeatureSettings();
  
  // Handle video ID changes to fetch API data
  window.addEventListener('message', async (event) => {
    const { type, data } = event.data;
    
    if (type === 'video-id-changed' && data.videoId) {
      // Get current feature settings
      const settings = await window.api.getFeatureSettings();
      
      // Fetch data for each enabled feature
      if (settings.sponsorBlockEnabled) {
        fetchSponsorBlockData(data.videoId);
      }
      
      if (settings.dearrowEnabled) {
        fetchDeArrowData(data.videoId);
      }
      
      if (settings.returnDislikeEnabled) {
        fetchDislikeData(data.videoId);
      }
    }
    
    if (type === 'request-settings') {
      // Send current settings to webview
      const settings = await window.api.getFeatureSettings();
      webview.contentWindow.postMessage({
        type: 'update-settings',
        data: settings
      }, '*');
    }
  });
}

// Load and display feature settings
async function loadFeatureSettings() {
  try {
    // Get current settings from main process
    const settings = await window.api.getFeatureSettings();
    
    // Update the toggle states in the new dropdown menus
    const toggles = [
      { id: 'adBlockingToggle', setting: settings.adBlockingEnabled },
      { id: 'sponsorBlockToggle', setting: settings.sponsorBlockEnabled },
      { id: 'dearrowToggle', setting: settings.dearrowEnabled },
      { id: 'returnDislikeToggle', setting: settings.returnDislikeEnabled }
    ];
    
    // Set toggle states based on settings
    toggles.forEach(({ id, setting }) => {
      const toggle = document.getElementById(id);
      if (toggle) {
        toggle.checked = setting;
      }
    });
    
    // Add event listeners for feature toggles in the dropdowns
    document.querySelectorAll('input[type="checkbox"][id$="Toggle"]').forEach(toggle => {
      // Remove existing listeners to avoid duplicates
      const newToggle = toggle.cloneNode(true);
      toggle.parentNode.replaceChild(newToggle, toggle);
      
      // Add listener to the new toggle
      newToggle.addEventListener('change', async (event) => {
        const featureId = event.target.id.replace('Toggle', '');
        const enabled = event.target.checked;
        
        // Update settings based on feature ID
        let settingsUpdate = {};
        
        switch (featureId) {
          case 'adBlocking':
            settingsUpdate.adBlockingEnabled = enabled;
            break;
          case 'sponsorBlock':
            settingsUpdate.sponsorBlockEnabled = enabled;
            break;
          case 'dearrow':
            settingsUpdate.dearrowEnabled = enabled;
            break;
          case 'returnDislike':
            settingsUpdate.returnDislikeEnabled = enabled;
            break;
        }
        
        try {
          // Show visual feedback while updating
          const toggleLabel = event.target.closest('.feature-toggle-container')?.querySelector('.toggle-label');
          const originalText = toggleLabel ? toggleLabel.textContent : '';
          
          if (toggleLabel) {
            toggleLabel.textContent = 'Updating...';
          }
          
          // Update settings
          const result = await window.api.updateFeatureSettings(settingsUpdate);
          
          if (result.success) {
            // Send updated settings to webview
            webview.contentWindow.postMessage({
              type: 'update-settings',
              data: settingsUpdate
            }, '*');
            
            // Update toggle label with success indication briefly
            if (toggleLabel) {
              toggleLabel.textContent = 'Updated!';
              setTimeout(() => {
                toggleLabel.textContent = originalText;
              }, 1500);
            }
          } else {
            if (toggleLabel) toggleLabel.textContent = originalText;
            showAlert(`Error: ${result.error}`);
            // Revert toggle if there was an error
            event.target.checked = !enabled;
          }
        } catch (error) {
          console.error(`Error updating ${featureId} setting:`, error);
          showAlert(`Error: ${error.message || 'Unknown error'}`);
          // Revert toggle if there was an error
          event.target.checked = !enabled;
        }
      });
    });
    
    console.log('Feature settings loaded and applied to dropdowns');
  } catch (error) {
    console.error('Error loading feature settings:', error);
    showAlert(`Error loading settings: ${error.message || 'Unknown error'}`);
  }
}

// Fetch and handle API data
async function fetchSponsorBlockData(videoId) {
  try {
    const result = await window.api.getSponsorSegments(videoId);
    if (result.success && result.segments) {
      // Send segments to webview
      webview.contentWindow.postMessage({
        type: 'sponsor-segments-updated',
        data: {
          segments: result.segments
        }
      }, '*');
    }
  } catch (error) {
    console.error('Error fetching SponsorBlock data:', error);
  }
}

async function fetchDeArrowData(videoId) {
  try {
    const result = await window.api.getDeArrowData(videoId);
    if (result.success && result.data) {
      // Send DeArrow data to webview
      webview.contentWindow.postMessage({
        type: 'dearrow-data-updated',
        data: result.data
      }, '*');
    }
  } catch (error) {
    console.error('Error fetching DeArrow data:', error);
  }
}

async function fetchDislikeData(videoId) {
  try {
    const result = await window.api.getDislikeCount(videoId);
    if (result.success && result.data) {
      // Send dislike data to webview
      webview.contentWindow.postMessage({
        type: 'dislike-data-updated',
        data: result.data
      }, '*');
    }
  } catch (error) {
    console.error('Error fetching dislike data:', error);
  }
}

// Setup webview events
function setupWebviewEvents() {
  // Update navigation buttons state and address bar when webview loads
  webview.addEventListener('did-finish-load', async () => {
    updateNavigationState();
    // Update address bar with current URL
    updateAddressBar(webview.getURL());
    
    // IMPORTANT: Send current settings to webview every time it loads
    // This ensures ad blocking and other features work immediately
    try {
      const settings = await window.api.getFeatureSettings();
      console.log('Sending initial settings to webview:', settings);
      
      // Send settings to webview preload script
      webview.contentWindow.postMessage({
        type: 'update-settings',
        data: settings
      }, '*');
      
      // Ensure ad blocking is initialized if enabled
      if (settings.adBlockingEnabled) {
        console.log('Ad blocking enabled - ensuring initialization');
        webview.contentWindow.postMessage({
          type: 'initialize-ad-blocking'
        }, '*');
      }
    } catch (error) {
      console.error('Error sending initial settings to webview:', error);
    }
    
    // Get current video URL if we're on a video page
    webview.executeJavaScript(`
      if (window.location.pathname.includes('/watch')) {
        window.location.href;
      } else {
        null;
      }
    `).then(videoUrl => {
      if (videoUrl) {
        downloadUrl.value = videoUrl;
      }
    });
  });
  
  // Update navigation buttons state when webview starts loading
  webview.addEventListener('did-start-loading', () => {
    document.body.classList.add('loading');
    updateNavigationState();
  });
  
  // Update navigation buttons state when webview stops loading
  webview.addEventListener('did-stop-loading', () => {
    document.body.classList.remove('loading');
    updateNavigationState();
  });
  
  // Update address bar when navigation occurs within the webview
  webview.addEventListener('did-navigate', (event) => {
    updateAddressBar(event.url);
    updateNavigationState();
  });
  
  // Also update on in-page navigation (like YouTube's SPA navigation)
  webview.addEventListener('did-navigate-in-page', (event) => {
    updateAddressBar(event.url);
    updateNavigationState();
  });
  
  // Intercept new window creation (e.g., for external links)
  webview.addEventListener('new-window', (e) => {
    const url = e.url;
    
    // If it's a YouTube URL, open it in the webview
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      webview.src = url;
    } else {
      // Otherwise open in external browser
      window.open(url);
    }
  });
  
  // Handle messages from webview
  webview.addEventListener('ipc-message', (event) => {
    if (event.channel === 'video-info') {
      // Update download URL when video information is received
      const { url } = event.args[0];
      downloadUrl.value = url;
    }
  });
}

// Update navigation buttons state
function updateNavigationState() {
  backBtn.disabled = !webview.canGoBack();
  forwardBtn.disabled = !webview.canGoForward();
}

// Update address bar with current URL
function updateAddressBar(url) {
  if (url && url !== 'about:blank') {
    urlInput.value = url;
  }
}

// Start download process
async function startDownload() {
  const url = downloadUrl.value.trim();
  if (!url) {
    showAlert('Please enter a YouTube URL');
    return;
  }
  
  // Always use MP4 format in this simplified version
  const format = 'mp4';
  
  try {
    // Start download
    const result = await window.api.downloadVideo(url, format);
    
    if (!result.success) {
      showAlert(`Download failed: ${result.error}`);
    }
  } catch (error) {
    showAlert(`Error: ${error.message}`);
  }
}

// Handle download started event
function handleDownloadStarted(data) {
  const { url, savePath } = data;
  
  // Create a new download item element
  const template = document.getElementById('download-item-template');
  const downloadItem = document.importNode(template.content, true).querySelector('.download-item');
  
  // Set title to URL (will be updated when we have more info)
  const titleElement = downloadItem.querySelector('.download-title');
  titleElement.textContent = url.substring(0, 50) + '...';
  
  // Store download info
  const downloadInfo = {
    url,
    savePath,
    element: downloadItem,
    progressBar: downloadItem.querySelector('.progress-fill'),
    progressText: downloadItem.querySelector('.progress-text')
  };
  
  activeDownloads.set(url, downloadInfo);
  
  // Add to downloads list
  downloadsList.prepend(downloadItem);
  
  // Make sure download panel is visible
  downloadPanel.classList.remove('collapsed');
  
  // Get video info to show better title
  webview.executeJavaScript(`
    document.title.replace(' - YouTube', '')
  `).then(title => {
    if (title) {
      titleElement.textContent = title;
    }
  });
}

// Handle download progress updates
function handleDownloadProgress(data) {
  const { url, progress } = data;
  const downloadInfo = activeDownloads.get(url);
  
  if (downloadInfo) {
    downloadInfo.progressBar.style.width = `${progress}%`;
    downloadInfo.progressText.textContent = `${progress}%`;
  }
}

// Handle download completion
function handleDownloadComplete(data) {
  const { url, savePath } = data;
  const downloadInfo = activeDownloads.get(url);
  
  if (downloadInfo) {
    // Update UI to show completion
    downloadInfo.element.classList.add('completed');
    downloadInfo.progressBar.style.width = '100%';
    downloadInfo.progressText.textContent = 'Done';
    
    // Set up action buttons
    const openBtn = downloadInfo.element.querySelector('.open-btn');
    const folderBtn = downloadInfo.element.querySelector('.folder-btn');
    
    openBtn.addEventListener('click', () => {
      window.api.openFile(savePath);
    });
    
    folderBtn.addEventListener('click', () => {
      window.api.showInFolder(savePath);
    });
  }
}

// Handle download errors
function handleDownloadError(data) {
  const { url, error } = data;
  const downloadInfo = activeDownloads.get(url);
  
  if (downloadInfo) {
    // Update UI to show error
    downloadInfo.element.classList.add('error');
    downloadInfo.progressText.textContent = 'Error';
    
    // Add error message
    const errorMsg = document.createElement('div');
    errorMsg.className = 'download-error-message';
    errorMsg.textContent = error;
    downloadInfo.element.appendChild(errorMsg);
  }
}

// Helper function to show alerts
function showAlert(message) {
  alert(message);
}
