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

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Video download functions
    downloadVideo: (url, format, savePath) => {
      return ipcRenderer.invoke('download-video', url, format, savePath);
    },
    
    // File operations
    openFile: (filePath) => {
      return ipcRenderer.invoke('open-file', filePath);
    },
    
    showInFolder: (filePath) => {
      return ipcRenderer.invoke('show-in-folder', filePath);
    },
    
    // Download event listeners
    onDownloadStarted: (callback) => {
      ipcRenderer.on('download-started', (_, data) => callback(data));
    },
    
    onDownloadProgress: (callback) => {
      ipcRenderer.on('download-progress', (_, data) => callback(data));
    },
    
    onDownloadComplete: (callback) => {
      ipcRenderer.on('download-complete', (_, data) => callback(data));
    },
    
    onDownloadError: (callback) => {
      ipcRenderer.on('download-error', (_, data) => callback(data));
    },
    
    // Remove event listeners when they're no longer needed
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('download-started');
      ipcRenderer.removeAllListeners('download-progress');
      ipcRenderer.removeAllListeners('download-complete');
      ipcRenderer.removeAllListeners('download-error');
    },
    
    // Window control functions
    minimizeWindow: () => {
      ipcRenderer.invoke('minimize-window');
    },
    
    maximizeWindow: () => {
      ipcRenderer.invoke('maximize-window');
    },
    
    closeWindow: () => {
      ipcRenderer.invoke('close-window');
    },
    
    // API integration functions for SponsorBlock, DeArrow, Return YouTube Dislike, etc.
    // SponsorBlock
    getSponsorSegments: (videoId, categories) => {
      return ipcRenderer.invoke('get-sponsor-segments', videoId, categories);
    },
    
    // DeArrow
    getDeArrowData: (videoId) => {
      return ipcRenderer.invoke('get-dearrow-data', videoId);
    },
    
    // Return YouTube Dislike
    getDislikeCount: (videoId) => {
      return ipcRenderer.invoke('get-dislike-count', videoId);
    },
    
    // Toggle ad blocking
    toggleAdBlocking: (enabled) => {
      return ipcRenderer.invoke('toggle-ad-blocking', enabled);
    },
    
    // Get and update feature settings
    getFeatureSettings: () => {
      return ipcRenderer.invoke('get-feature-settings');
    },
    
    updateFeatureSettings: (settings) => {
      return ipcRenderer.invoke('update-feature-settings', settings);
    }
  }
);
