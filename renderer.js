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

// Get elements
const webview = document.getElementById('youtubeView');
const urlInput = document.getElementById('urlInput');
const goBtn = document.getElementById('goBtn');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const refreshBtn = document.getElementById('refreshBtn');
const homeBtn = document.getElementById('homeBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeBtn = document.getElementById('maximizeBtn');
const closeBtn = document.getElementById('closeBtn');
const toggleDownloadBtn = document.getElementById('toggleDownloadBtn');
const downloadPanel = document.querySelector('.download-panel');
const downloadUrl = document.getElementById('downloadUrl');
const downloadBtn = document.getElementById('downloadBtn');
const downloadsList = document.getElementById('downloadsList');

// Features panel elements
const featuresPanel = document.querySelector('.features-panel');
const toggleFeaturesBtn = document.getElementById('toggleFeaturesBtn');
const featuresList = document.getElementById('featuresList');

// Store active downloads
const activeDownloads = new Map();

// Initialize UI
document.addEventListener('DOMContentLoaded', () => {
  // Initial state of panels
  downloadPanel.classList.add('collapsed');
  featuresPanel.classList.add('collapsed');
  
  // Set up event listeners for window controls
  setupWindowControls();
  
  // Set up navigation controls
  setupNavigation();
  
  // Set up download functionality
  setupDownloads();
  
  // Set up feature settings
  setupFeatures();
  
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
    webview.reload();
  });
  
  // Go to YouTube home
  homeBtn.addEventListener('click', () => {
    webview.src = 'https://www.youtube.com';
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

// Setup download panel functionality
function setupDownloads() {
  // Toggle download panel
  toggleDownloadBtn.addEventListener('click', () => {
    downloadPanel.classList.toggle('collapsed');
  });
  
  // Start download when button is clicked
  downloadBtn.addEventListener('click', startDownload);
  
  // Set up download event listeners from main process
  window.api.onDownloadStarted(handleDownloadStarted);
  window.api.onDownloadProgress(handleDownloadProgress);
  window.api.onDownloadComplete(handleDownloadComplete);
  window.api.onDownloadError(handleDownloadError);
}

// Setup features panel and controls
function setupFeatures() {
  // Toggle features panel
  toggleFeaturesBtn.addEventListener('click', () => {
    featuresPanel.classList.toggle('collapsed');
  });
  
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
  // Clear existing items
  featuresList.innerHTML = '';
  
  try {
    // Get current feature settings
    const settings = await window.api.getFeatureSettings();
    
    // Create feature toggles
    const features = [
      {
        id: 'adBlocking',
        name: 'Ad Blocking',
        description: 'Block ads on YouTube',
        enabled: settings.adBlockingEnabled
      },
      {
        id: 'sponsorBlock',
        name: 'SponsorBlock',
        description: 'Skip sponsored segments automatically',
        enabled: settings.sponsorBlockEnabled
      },
      {
        id: 'dearrow',
        name: 'DeArrow',
        description: 'Fix clickbait titles and thumbnails',
        enabled: settings.dearrowEnabled
      },
      {
        id: 'returnDislike',
        name: 'Return YouTube Dislike',
        description: 'Show dislike counts on videos',
        enabled: settings.returnDislikeEnabled
      }
    ];
    
    // Populate features list
    features.forEach(feature => {
      const featureItem = document.createElement('div');
      featureItem.className = 'feature-item';
      
      featureItem.innerHTML = `
        <div class="feature-info">
          <div class="feature-name">${feature.name}</div>
          <div class="feature-description">${feature.description}</div>
        </div>
        <div class="feature-actions">
          <label class="toggle-switch">
            <input type="checkbox" class="feature-toggle" id="${feature.id}Toggle" ${feature.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      `;
      
      featuresList.appendChild(featureItem);
    });
    
    // Add event listeners for feature toggles
    document.querySelectorAll('.feature-toggle').forEach(toggle => {
      toggle.addEventListener('change', async (event) => {
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
          // Update settings
          const result = await window.api.updateFeatureSettings(settingsUpdate);
          
          if (result.success) {
            // Send updated settings to webview
            webview.contentWindow.postMessage({
              type: 'update-settings',
              data: settingsUpdate
            }, '*');
          } else {
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
  } catch (error) {
    console.error('Error loading feature settings:', error);
    featuresList.innerHTML = `<div class="feature-error">Error loading feature settings: ${error.message || 'Unknown error'}</div>`;
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
  // When webview finishes loading
  webview.addEventListener('did-finish-load', () => {
    // Update URL input with current URL
    urlInput.value = webview.getURL();
    
    // Update navigation buttons state
    updateNavigationState();
    
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
  
  // When webview's URL changes
  webview.addEventListener('did-navigate', () => {
    urlInput.value = webview.getURL();
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
