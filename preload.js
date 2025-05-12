// YTView Preload Script - Modular Version
// This script runs in the Electron context and provides a secure bridge between 
// the renderer process and the main process

const { contextBridge, ipcRenderer } = require('electron');

// Block audio contexts to prevent Bluetooth headphones from switching modes
(() => {
  // This will run in the preload context and helps block permissions
  try {
    // Block media device initialization
    process.env.PULSE_SINK = 'dummy';
    process.env.PULSE_SOURCE = 'dummy';
    process.env.ALSA_PCM_DEVICE = 'null';
    
    console.log('Audio environment blocking initialized in preload');
  } catch (error) {
    console.error('Error setting up audio environment blocking:', error);
  }
})();

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('api', {
  //====================
  // Window Controls
  //====================
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  //====================
  // Feature Settings
  //====================
  getFeatureSettings: () => ipcRenderer.invoke('get-feature-settings'),
  updateFeatureSettings: (settings) => ipcRenderer.invoke('update-feature-settings', settings),
  
  //====================
  // Developer Tools
  //====================
  toggleWebviewDevTools: () => ipcRenderer.invoke('toggle-webview-devtools'),
  
  //====================
  // Ad Blocking
  //====================
  setupDirectAdBlocking: (options) => ipcRenderer.invoke('setup-direct-webview-blocking', options),
  
  //====================
  // API Integrations
  //====================
  
  // SponsorBlock
  getSponsorSegments: (videoId) => ipcRenderer.invoke('get-sponsor-segments', videoId),
  
  // DeArrow
  getDeArrowData: (videoId) => ipcRenderer.invoke('get-dearrow-data', videoId),
  
  // Return YouTube Dislike
  getDislikeCount: (videoId) => ipcRenderer.invoke('get-dislike-count', videoId),
  
  //====================
  // Download Functions
  //====================
  selectDownloadLocation: () => ipcRenderer.invoke('select-download-location'),
  
  downloadVideo: (options) => ipcRenderer.invoke('download-video', options),
  
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  
  //====================
  // Download Events
  //====================
  onDownloadStarted: (callback) => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('download-started');
    // Add new listener
    ipcRenderer.on('download-started', (_, data) => callback(data));
  },
  
  onDownloadProgress: (callback) => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('download-progress');
    // Add new listener
    ipcRenderer.on('download-progress', (_, data) => callback(data));
  },
  
  onDownloadComplete: (callback) => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('download-complete');
    // Add new listener
    ipcRenderer.on('download-complete', (_, data) => callback(data));
  },
  
  onDownloadError: (callback) => {
    // Remove any existing listeners to avoid duplicates
    ipcRenderer.removeAllListeners('download-error');
    // Add new listener
    ipcRenderer.on('download-error', (_, data) => callback(data));
  },
  
  //====================
  // Cleanup Functions
  //====================
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('download-started');
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('download-complete');
    ipcRenderer.removeAllListeners('download-error');
    ipcRenderer.removeAllListeners('ad-blocked');
  }
});
