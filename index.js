// YTView Main Process - Modular Version
const { app, session, ipcMain } = require('electron');
const path = require('path');

// Import our modules
const initSettingsManager = require('./modules/settings-manager');
const initApiManager = require('./modules/api-manager');
const initWindowManager = require('./modules/window-manager');
const initNetworkAdBlocker = require('./modules/network-ad-blocker');
const initAdBlocker = require('./modules/ad-blocker');
const initIpcManager = require('./modules/ipc-manager');

// Initialize Settings Manager
const settingsManager = initSettingsManager();

// Initialize API Manager
const apiManager = initApiManager();

// Initialize Window Manager
const windowManager = initWindowManager({
  width: 1280,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  frame: false,
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js'),
    webviewTag: true,
    webSecurity: true
  }
});

// Initialize Network Ad Blocker
const networkAdBlocker = initNetworkAdBlocker(settingsManager);

// Initialize Client-side Ad Blocker
const adBlocker = initAdBlocker(settingsManager.getSetting ? settingsManager.getSetting('adBlockingEnabled', true) : true);

// Initialize IPC Manager (after we have all dependencies)
const ipcManager = initIpcManager({
  settingsManager,
  apiManager,
  windowManager,
  networkAdBlocker,
  adBlocker
});

// Initialize networking and ad blocking first, before any app initialization
app.whenReady().then(async () => {
  console.log('YTView starting - initializing ad blocking first');
  
  // Force session creation with aggressive blocking BEFORE ANY WINDOWS CREATED
  // This is critical: we must intercept request events before content starts loading
  console.log('Setting up network-level ad blocking for all sessions...');
  
  try {
    // Initialize default session blocking synchronously to ensure it's ready
    console.log('Initializing default session blocking...');
    await networkAdBlocker.setupAdBlocking(session.defaultSession);
    
    // Set up the YouTube-specific webview partition
    const ytSession = session.fromPartition('persist:ytview', { cache: false });
    console.log('Initializing YouTube webview session blocking...');
    await networkAdBlocker.setupAdBlocking(ytSession);
    
    // Additional emergency session protection with detailed logging
    // Some ads use a different partition
    console.log('Adding emergency protection for other sessions...');
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['*://*.googlesyndication.com/*', '*://*.doubleclick.net/*', '*://www.youtube.com/api/stats/ads*'] },
      (details, callback) => { 
        // Extract domain for the log
        let domain;
        try {
          domain = new URL(details.url).hostname;
        } catch (e) {
          domain = details.url.split('/')[2] || 'unknown';
        }
        console.log(`⛔ EMERGENCY BLOCKED: ${domain} (${details.url.substring(0, 60)}...)`);
        callback({cancel: true}); 
      }
    );
    
    // Set session flags to disable cache and persistence
    ytSession.clearCache().then(() => {
      console.log('YouTube session cache cleared');
    }).catch(err => {
      console.error('Error clearing cache:', err);
    });
    
    console.log('=======================================');
    console.log('🚫 AD BLOCKING INITIALIZED SUCCESSFULLY! 🚫');
    console.log('🔴 ALL AD REQUESTS WILL BE LOGGED 🔴');
    console.log('=======================================');
    
    // Now we can safely start the app
    console.log('\nYTView started with native API integrations');
    console.log('- Network-level Ad Blocking');
    console.log('- SponsorBlock: Skip sponsored segments');
    console.log('- DeArrow: Better titles and thumbnails');
    console.log('- Return YouTube Dislike: See dislikes');

    // Create the main window after ad blocking is set up
    const mainWindow = windowManager.createMainWindow();
    
    // Show stats after 5 seconds
    setTimeout(() => {
      console.log('\n🔍 Initial ad blocker stats:');
      networkAdBlocker.printBlockStats();
    }, 5000);
  } catch (error) {
    console.error('Error setting up ad blocking:', error);
    // Create the window anyway in case of error
    const mainWindow = windowManager.createMainWindow();
  }
  
  // Set up IPC handlers
  ipcManager.setupHandlers();

  // DIRECT WEBVIEW AD BLOCKING
  // Handle requests from renderer to set up direct webview blocking
  // DIRECT WEBVIEW AD BLOCKING - Enhanced version with better error handling
  ipcMain.handle('setup-direct-webview-blocking', async (event, data) => {
    // Track start time for performance logging
    const startTime = Date.now();
    try {
      console.log('\n-----------------------------------------');
      console.log('🔥 SETTING UP DIRECT WEBVIEW AD BLOCKING 🔥');
      console.log('-----------------------------------------');
      
      const partition = data.partition || 'persist:ytview';
      const webviewSession = session.fromPartition(partition);
    
      // Use simplified patterns if requested
      const useSimplifiedPatterns = data.simplified === true;
      
      // Core YouTube ad patterns to block - EXPANDED LIST
      let adPatterns = [];
      
      if (useSimplifiedPatterns) {
        // Use a smaller, more reliable set of patterns
        adPatterns = [
          '*://*.doubleclick.net/*',
          '*://*.googlesyndication.com/*',
          '*://www.youtube.com/api/stats/ads*',
          '*://www.youtube.com/pagead/*',
          '*://ad.youtube.com/*',
          '*://ads.youtube.com/*'
        ];
      } else {
        // Use the full set of patterns
        adPatterns = [
          // Standard ad domains
          '*://*.doubleclick.net/*',
          '*://*.googlesyndication.com/*',
          '*://*.googleadservices.com/*',
          '*://*.google-analytics.com/*',
          '*://*.googletagservices.com/*',
          '*://*.googletagmanager.com/*',
          '*://*.moatads.com/*',
          '*://*.adsystem.com/*',
          '*://*.adservice.google.com/*',
          '*://googleads.g.doubleclick.net/*',
          '*://*.ggpht.com/*.svg',
          
          // YouTube-specific ad domains and paths
          '*://www.youtube.com/api/stats/ads*',
          '*://www.youtube.com/pagead/*',
          '*://www.youtube.com/ptracking*',
          '*://www.youtube.com/youtubei/v1/log_event*',
          '*://www.youtube.com/generate_204*',
          '*://www.youtube.com/error_204*',
          '*://www.youtube.com/get_midroll_*',
          '*://www.youtube.com/api/stats/delayplay*',
          '*://www.youtube.com/api/stats/watchtime*',
          '*://ad.youtube.com/*',
          '*://ads.youtube.com/*',
          '*://s.youtube.com/api/stats/qoe*',
          '*://i.ytimg.com/vi/*/hqdefault_live.jpg*',
          
          // Common ad tracking parameters - using specific domains to avoid invalid patterns
          '*://www.youtube.com/*&ad_type=*',
          '*://www.youtube.com/*&adurl=*',
          '*://www.youtube.com/*?adurl=*',
          '*://www.youtube.com/*&adformat=*',
          '*://www.youtube.com/*?adformat=*'
        ];
      }
      
      // Set up direct blocking on webview session - use smaller batches of patterns to avoid errors
      // Split patterns into smaller groups to avoid potential issues with too many patterns
      const patternGroups = [];
      const groupSize = 10;
      
      for (let i = 0; i < adPatterns.length; i += groupSize) {
        patternGroups.push(adPatterns.slice(i, i + groupSize));
      }
      
      // Apply each group of patterns separately
      patternGroups.forEach((patterns, index) => {
        webviewSession.webRequest.onBeforeRequest(
          { urls: patterns },
          (details, callback) => {
            // Extract domain for logging
            let domain;
            try {
              domain = new URL(details.url).hostname;
            } catch (e) {
              domain = details.url.split('/')[2] || 'unknown';
            }
            
            // EXTREMELY PROMINENT LOGGING
            const message = `

==================================================
🔴🔴🔴 AD BLOCKED: ${domain} 🔴🔴🔴
${details.url}
==================================================
`;
            
            console.log(message);
            
            // Also log to main window console
            if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send('ad-blocked', {
                domain,
                url: details.url
              });
            }
            
            // Force log to stdout as well
            process.stdout.write(message + '\n');
            
            callback({ cancel: true });
          }
        );
        console.log(`Pattern group ${index + 1}/${patternGroups.length} applied successfully`);
      });
      
      // Add keyword-based blocking as catch-all
      webviewSession.webRequest.onBeforeRequest(
        { urls: ['*://*/*'] },
        (details, callback) => {
          const url = details.url.toLowerCase();
          
          // Skip processing non-ad related URLs for performance
          if (!url.includes('ad') && 
              !url.includes('track') && 
              !url.includes('analytics') && 
              !url.includes('pagead')) {
            callback({ cancel: false });
            return;
          }
          
          // Check for ad keywords in URL
          const shouldBlock = url.includes('/ad/') || 
              url.includes('/ads/') || 
              url.includes('/advert/') || 
              url.includes('doubleclick') ||
              url.includes('googleadservices') ||
              url.includes('googlesyndication') ||
              url.includes('youtube.com/pagead/') ||
              url.includes('youtube.com/api/stats/ads') ||
              url.includes('adformat=');
          
          if (shouldBlock) {
            // Extract domain 
            let domain;
            try {
              domain = new URL(details.url).hostname;
            } catch (e) {
              domain = details.url.split('/')[2] || 'unknown';
            }
            
            console.log(`🚫 KEYWORD BLOCK: ${domain} (${details.url.substring(0, 60)}...)`);
            
            // Send back to renderer for display
            if (event.sender && !event.sender.isDestroyed()) {
              event.sender.send('ad-blocked', {
                domain,
                url: details.url
              });
            }
            
            callback({ cancel: true });
          } else {
            callback({ cancel: false });
          }
        }
      );
      
      // Add a specific handler for YouTube ad parameters in videoplayback URLs
      webviewSession.webRequest.onBeforeRequest(
        { urls: ['*://*.googlevideo.com/videoplayback*', '*://*.youtube.com/videoplayback*'] },
        (details, callback) => {
          const url = details.url.toLowerCase();
          const isAdVideo = url.includes('&adt=') || 
                          url.includes('&adformat=') || 
                          url.includes('&afc=') || 
                          url.includes('&adurl=') || 
                          url.includes('&ad_type=');
          
          if (isAdVideo) {
            console.log(`🔴 BLOCKED AD VIDEO: ${url.substring(0, 100)}...`);
            callback({ cancel: true });
          } else {
            callback({ cancel: false });
          }
        }
      );
      
      // If aggressive mode is requested, add additional handlers
      if (data.aggressive === true) {
        // Block all googlevideo.com requests that contain ad indicators
        webviewSession.webRequest.onBeforeRequest(
          { urls: ['*://*.googlevideo.com/*'] },
          (details, callback) => {
            const url = details.url.toLowerCase();
            // Check for ad-specific parameters in the URL
            if (url.includes('&adt=') || 
                url.includes('&adformat=') || 
                url.includes('&afc=') || 
                url.includes('&adurl=') || 
                url.includes('&ad_type=') ||
                url.includes('/ad/') ||
                url.includes('/ads/')) {
              console.log(`🔴 BLOCKED GOOGLEVIDEO AD: ${url.substring(0, 80)}...`);
              callback({ cancel: true });
            } else {
              callback({ cancel: false });
            }
          }
        );
      }
      
      const setupTime = Date.now() - startTime;
      console.log(`✅ Direct webview ad blocking activated successfully! (${setupTime}ms)`);
      return { 
        success: true, 
        setupTime,
        patternCount: adPatterns.length,
        simplified: useSimplifiedPatterns,
        aggressive: data.aggressive === true
      };
    } catch (error) {
      console.error('Error setting up direct webview blocking:', error);
      
      // Try to set up at least basic ad blocking even if the full setup failed
      try {
        // Set up a minimal set of critical patterns
        const criticalPatterns = [
          '*://*.doubleclick.net/*',
          '*://*.googlesyndication.com/*',
          '*://www.youtube.com/api/stats/ads*',
          '*://www.youtube.com/pagead/*'
        ];
        
        webviewSession.webRequest.onBeforeRequest(
          { urls: criticalPatterns },
          (details, callback) => {
            console.log(`⛔ FALLBACK BLOCKED: ${details.url.substring(0, 100)}...`);
            callback({ cancel: true });
          }
        );
        
        console.log('Fallback ad blocking set up after error');
        return { success: true, fallback: true, error: error.message };
      } catch (fallbackError) {
        console.error('Even fallback ad blocking failed:', fallbackError);
        return { success: false, error: error.message };
      }
    }
  });
  
  // Load initial settings
  settingsManager.loadSettings();
  
  app.on('activate', () => {
    // On macOS, recreate the window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
