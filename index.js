const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const ytdl = require('ytdl-core');
const axios = require('axios');
const fetch = require('node-fetch');

// Import our ad-blocker script
const { adBlockerScript } = require('./ad-blocker.js');

// API endpoints for direct integrations
const API = {
  SPONSORBLOCK: 'https://sponsor.ajay.app/api/',
  DEARROW: 'https://sponsor.ajay.app/api/branding/', // DeArrow API
  RETURN_DISLIKE: 'https://returnyoutubedislikesapi.com/votes?videoId='
};

let mainWindow;

// Create a store for app settings and cached data
const settingsStore = {};
const cacheStore = new Map();

// Very minimal ad blocking that won't interfere with video playback
const adBlockFilterLists = {
  // Only the most basic ad network domains
  youtubeAds: [
    'https://securepubads.g.doubleclick.net/*',
    'https://pubads.g.doubleclick.net/*',
    'https://googleads.g.doubleclick.net/*'
  ]
};

// Setup minimal ad blocking
function setupAdBlocking(session) {
  if (!session) return;
  
  // Only block a very limited set of known ad domains
  session.webRequest.onBeforeRequest({ urls: adBlockFilterLists.youtubeAds }, (details, callback) => {
    // Block these specific ad requests
    if (settingsStore.adBlockingEnabled !== false) {
      console.log(`Blocked ad request: ${details.url.substring(0, 50)}...`);
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });
  
  console.log('Basic ad blocking initialized');
}

// Function to fetch SponsorBlock segments for a video
async function getSponsorBlockSegments(videoId, categories = ['sponsor']) {
  try {
    // Cache key for this request
    const cacheKey = `sb_${videoId}_${categories.join('_')}`;
    
    // Check cache first
    if (cacheStore.has(cacheKey)) {
      return cacheStore.get(cacheKey);
    }
    
    // Make the API request
    const response = await axios.get(`${API.SPONSORBLOCK}/skipSegments`, {
      params: { videoID: videoId, categories: JSON.stringify(categories) }
    });
    
    // Cache the result
    cacheStore.set(cacheKey, response.data);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching SponsorBlock segments:', error.message);
    return [];
  }
}

// Function to fetch DeArrow data for a video
async function getDeArrowData(videoId) {
  try {
    // Cache key for this request
    const cacheKey = `da_${videoId}`;
    
    // Check cache first
    if (cacheStore.has(cacheKey)) {
      return cacheStore.get(cacheKey);
    }
    
    // Make the API request
    const response = await axios.get(`${API.DEARROW}?videoID=${videoId}`);
    
    // Cache the result
    cacheStore.set(cacheKey, response.data);
    
    return response.data;
  } catch (error) {
    console.error('Error fetching DeArrow data:', error.message);
    return null;
  }
}

// Function to fetch Return YouTube Dislike data
async function getDislikeCount(videoId) {
  try {
    // Cache key for this request
    const cacheKey = `dislikes_${videoId}`;
    
    // Check cache first
    if (cacheStore.has(cacheKey)) {
      return cacheStore.get(cacheKey);
    }
    
    // Make the API request
    const response = await fetch(`${API.RETURN_DISLIKE}${videoId}`);
    const data = await response.json();
    
    // Cache the result
    cacheStore.set(cacheKey, data);
    
    return data;
  } catch (error) {
    console.error('Error fetching dislike count:', error.message);
    return null;
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false,
      // Enable webRequest API for ad blocking
      webSecurity: true,
      // Explicitly disable any media access to prevent Bluetooth switching to call mode
      autoplayPolicy: 'document-user-activation-required',
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'YTView',
    // Set the frame to false for a custom title bar
    frame: false
  });

  console.log('YTView started with native API integrations');
  console.log('- Network-level Ad Blocking');
  console.log('- SponsorBlock: Skip sponsored segments');
  console.log('- DeArrow: Better titles and thumbnails');
  console.log('- Return YouTube Dislike: See dislikes');

  // Set up ad blocking for the main window
  setupAdBlocking(mainWindow.webContents.session);
  
  // Set up a webRequest handler for the default session (used by webviews)
  setupAdBlocking(session.defaultSession);
  
  // Set up event listener to handle webviews
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    // Apply network-level ad blocking to each webview
    setupAdBlocking(webContents.session);
    console.log('Network-level ad blocking applied to webview');
    
    // Disable audio worklets and media permissions
    webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      // Deny all media-related permissions
      if (permission === 'media' || 
          permission === 'microphone' || 
          permission === 'camera' || 
          permission === 'audio-capture' || 
          permission === 'video-capture') {
        console.log(`Denied permission request: ${permission}`);
        return callback(false);
      }
      
      // Allow other permissions
      callback(true);
    });
    
    // Inject our audio fixer script before anything else runs
    const audioFixerScript = `
      // Aggressive audio context blocking
      window.AudioContext = window.webkitAudioContext = function() {
        throw new Error('AudioContext creation blocked by YTView to prevent Bluetooth mode switching');
      };
      navigator.mediaDevices = undefined;
      console.log('YTView: Aggressive media blocking enabled');
    `;
    
    // Run this on page start and on each navigation
    const injectScripts = () => {
      // First the audio fixer
      webContents.executeJavaScript(audioFixerScript, true)
        .catch(err => console.error('Failed to inject audio fixer:', err));
      
      // Then the ad blocker
      webContents.executeJavaScript(adBlockerScript)
        .then(() => console.log('Ad blocker script injected'))
        .catch(err => console.error('Failed to inject ad blocker:', err));
    };
    
    // Run on initial page load
    webContents.on('dom-ready', injectScripts);
    
    // Run on navigation within the webview
    webContents.on('did-navigate', injectScripts);
    
    // Run when page is refreshed
    webContents.on('did-start-loading', () => {
      webContents.executeJavaScript(audioFixerScript, true)
        .catch(err => console.error('Failed to inject audio fixer on refresh:', err));
    });
  });

  // Load the index.html
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Create window when Electron is ready
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle video download request
ipcMain.handle('download-video', async (event, url, format, savePath) => {
  try {
    if (!ytdl.validateURL(url)) {
      return { success: false, error: 'Invalid YouTube URL' };
    }

    const info = await ytdl.getInfo(url);
    const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '');
    
    // If savePath is not provided, ask the user
    if (!savePath) {
      const defaultPath = app.getPath('downloads');
      const result = await dialog.showSaveDialog({
        title: 'Save Video',
        defaultPath: path.join(defaultPath, `${videoTitle}.mp4`),
        filters: [{ name: 'Video', extensions: ['mp4'] }]
      });
      
      if (result.canceled) {
        return { success: false, error: 'Download canceled' };
      }
      
      savePath = result.filePath;
    }

    // Return immediately with success=true to let the UI know we started the download
    event.sender.send('download-started', { url, savePath });

    // For now, we only support MP4 without ffmpeg
    const videoStream = ytdl(url, { 
      quality: 'highest'
    });
    
    videoStream.pipe(fs.createWriteStream(savePath));
    
    videoStream.on('progress', (_, downloaded, total) => {
      const percent = downloaded && total ? Math.round((downloaded / total) * 100) : 0;
      event.sender.send('download-progress', { url, progress: percent });
    });
    
    videoStream.on('end', () => {
      event.sender.send('download-complete', { url, savePath });
    });
    
    videoStream.on('error', (err) => {
      console.error('Download error:', err);
      event.sender.send('download-error', { url, error: err.message });
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error in download-video:', error);
    return { success: false, error: error.message };
  }
});

// Open downloaded file in default app
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error opening file:', error);
    return { success: false, error: error.message };
  }
});

// Show file in folder
ipcMain.handle('show-in-folder', async (event, filePath) => {
  try {
    await shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error showing file in folder:', error);
    return { success: false, error: error.message };
  }
});

// Window control handlers
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
    return { success: true };
  }
  return { success: false, error: 'Window not available' };
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return { success: true };
  }
  return { success: false, error: 'Window not available' };
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
    return { success: true };
  }
  return { success: false, error: 'Window not available' };
});

// SponsorBlock API handler
ipcMain.handle('get-sponsor-segments', async (event, videoId, categories) => {
  try {
    const segments = await getSponsorBlockSegments(videoId, categories);
    return { success: true, segments };
  } catch (error) {
    console.error('Error in get-sponsor-segments:', error);
    return { success: false, error: error.message };
  }
});

// DeArrow API handler
ipcMain.handle('get-dearrow-data', async (event, videoId) => {
  try {
    const data = await getDeArrowData(videoId);
    return { success: true, data };
  } catch (error) {
    console.error('Error in get-dearrow-data:', error);
    return { success: false, error: error.message };
  }
});

// Return YouTube Dislike API handler
ipcMain.handle('get-dislike-count', async (event, videoId) => {
  try {
    const data = await getDislikeCount(videoId);
    return { success: true, data };
  } catch (error) {
    console.error('Error in get-dislike-count:', error);
    return { success: false, error: error.message };
  }
});

// Ad blocking toggle (simple settings toggle for now)
ipcMain.handle('toggle-ad-blocking', async (event, enabled) => {
  try {
    settingsStore.adBlockingEnabled = enabled;
    return { success: true, enabled };
  } catch (error) {
    console.error('Error toggling ad blocking:', error);
    return { success: false, error: error.message };
  }
});

// Get all feature settings
ipcMain.handle('get-feature-settings', async () => {
  return {
    adBlockingEnabled: settingsStore.adBlockingEnabled ?? true,
    sponsorBlockEnabled: settingsStore.sponsorBlockEnabled ?? true,
    dearrowEnabled: settingsStore.dearrowEnabled ?? true,
    returnDislikeEnabled: settingsStore.returnDislikeEnabled ?? true
  };
});

// Update feature settings
ipcMain.handle('update-feature-settings', async (event, settings) => {
  try {
    // Update settings
    Object.assign(settingsStore, settings);
    return { success: true, settings: settingsStore };
  } catch (error) {
    console.error('Error updating settings:', error);
    return { success: false, error: error.message };
  }
});
