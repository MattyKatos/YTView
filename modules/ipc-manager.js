// IPC Manager for YTView Main Process
// Handles inter-process communication between renderer and main processes

const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ytdl = require('ytdl-core');

/**
 * Initialize the IPC Manager
 * @param {Object} options - Configuration options
 * @param {Object} options.settingsManager - Settings manager instance
 * @param {Object} options.apiManager - API manager instance
 * @param {Object} options.windowManager - Window manager instance
 * @param {Object} options.networkAdBlocker - Network ad blocker instance
 * @param {Object} options.adBlocker - Client-side ad blocker instance
 * @returns {Object} - IPC manager interface
 */
function initIpcManager({ settingsManager, apiManager, windowManager, networkAdBlocker, adBlocker }) {
  // Validate required dependencies
  if (!settingsManager || !apiManager || !windowManager) {
    throw new Error('Required dependencies missing for IPC Manager');
  }

  /**
   * Setup all IPC handlers
   */
  function setupHandlers() {
    // Window control handlers
    ipcMain.handle('minimize-window', () => {
      windowManager.minimizeWindow();
      return true;
    });

    ipcMain.handle('maximize-window', () => {
      windowManager.maximizeWindow();
      return true;
    });

    ipcMain.handle('close-window', () => {
      windowManager.closeWindow();
      return true;
    });
    
    // Developer tools handler - use a more reliable method
    ipcMain.handle('toggle-webview-devtools', async () => {
      const win = windowManager.getMainWindow();
      if (!win) {
        console.error('Main window not available');
        return false;
      }
      
      try {
        // Send a message to the renderer to execute a script that toggles DevTools directly
        // This is more reliable than trying to find the webview from the main process
        await win.webContents.executeJavaScript(`
          (function() {
            const webview = document.getElementById('youtubeView');
            if (webview) {
              if (webview.isDevToolsOpened()) {
                webview.closeDevTools();
                console.log('Webview DevTools closed');
              } else {
                webview.openDevTools();
                console.log('Webview DevTools opened');
              }
              return true;
            } else {
              console.error('Could not find webview element in the DOM');
              return false;
            }
          })();
        `);
        
        console.log('DevTools toggle command executed');
        return true;
      } catch (error) {
        console.error('Error toggling DevTools:', error);
        return false;
      }
    });

    // Settings handlers
    ipcMain.handle('get-feature-settings', async () => {
      return settingsManager.getAllSettings();
    });

    ipcMain.handle('update-feature-settings', async (event, newSettings) => {
      // Update settings
      const result = await settingsManager.updateSettings(newSettings);
      
      // If ad blocking setting was changed, notify both ad blockers
      if (newSettings.hasOwnProperty('adBlockingEnabled')) {
        // Update network ad blocker
        if (networkAdBlocker && typeof networkAdBlocker.updateSettings === 'function') {
          networkAdBlocker.updateSettings(newSettings);
        }
        
        // Update client-side ad blocker
        if (adBlocker && typeof adBlocker.updateSettings === 'function') {
          adBlocker.updateSettings(newSettings);
        }
        
        console.log(`Ad blocking ${newSettings.adBlockingEnabled ? 'enabled' : 'disabled'} in both blockers`);
      }
      
      return result;
    });

    // API data handlers
    ipcMain.handle('get-sponsor-segments', async (event, videoId) => {
      return await apiManager.getSponsorBlockSegments(videoId);
    });

    ipcMain.handle('get-dearrow-data', async (event, videoId) => {
      return await apiManager.getDeArrowData(videoId);
    });

    ipcMain.handle('get-dislike-count', async (event, videoId) => {
      return await apiManager.getDislikeCount(videoId);
    });

    // Download handlers
    ipcMain.handle('select-download-location', async () => {
      const mainWindow = windowManager.getMainWindow();
      if (!mainWindow) return { success: false, error: 'Main window not available' };
      
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Download Folder'
      });
      
      if (result.canceled) {
        return { success: false, error: 'Selection canceled' };
      }
      
      return { success: true, folderPath: result.filePaths[0] };
    });

    ipcMain.handle('download-video', async (event, { videoUrl, format, outputPath }) => {
      if (!videoUrl) {
        return { success: false, error: 'No video URL provided' };
      }
      
      try {
        // Get video info
        const info = await ytdl.getInfo(videoUrl);
        const videoTitle = info.videoDetails.title.replace(/[^\w\s]/gi, '_');
        const sanitizedTitle = videoTitle.substring(0, 100); // Limit title length
        
        // Select output location if not provided
        let selectedPath = outputPath;
        if (!selectedPath) {
          const mainWindow = windowManager.getMainWindow();
          const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: 'Select Download Folder'
          });
          
          if (result.canceled) {
            return { success: false, error: 'Download canceled: No folder selected' };
          }
          
          selectedPath = result.filePaths[0];
        }
        
        // Setup output file path based on format
        const extension = format === 'audio' ? 'mp3' : 'mp4';
        const outputFilePath = path.join(selectedPath, `${sanitizedTitle}.${extension}`);
        
        // Setup download options
        const options = {
          quality: format === 'audio' ? 'highestaudio' : 'highest',
          filter: format === 'audio' ? 'audioonly' : 'audioandvideo'
        };
        
        // Create download stream
        const videoStream = ytdl(videoUrl, options);
        const fileStream = fs.createWriteStream(outputFilePath);
        
        // Return initial response to start download
        const downloadId = Date.now().toString();
        
        // Setup download tracking
        let downloadedBytes = 0;
        let totalBytes = 0;
        
        videoStream.on('progress', (chunkLength, downloaded, total) => {
          downloadedBytes = downloaded;
          totalBytes = total;
          
          // Send progress updates through a separate channel
          if (event.sender) {
            event.sender.send('download-progress', {
              id: downloadId,
              downloaded,
              total,
              progress: Math.floor((downloaded / total) * 100)
            });
          }
        });
        
        // Handle download completion
        videoStream.pipe(fileStream);
        
        fileStream.on('finish', () => {
          if (event.sender) {
            event.sender.send('download-complete', { 
              id: downloadId, 
              filePath: outputFilePath,
              title: sanitizedTitle,
              format
            });
          }
        });
        
        fileStream.on('error', (error) => {
          if (event.sender) {
            event.sender.send('download-error', { 
              id: downloadId, 
              error: error.message 
            });
          }
        });
        
        return { 
          success: true, 
          id: downloadId, 
          title: sanitizedTitle,
          format,
          outputFilePath
        };
      } catch (error) {
        console.error('Error starting download:', error);
        return { success: false, error: error.message || 'Download failed' };
      }
    });

    // Open file or folder in system explorer
    ipcMain.handle('open-folder', (event, folderPath) => {
      try {
        shell.openPath(folderPath);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    console.log('IPC handlers initialized');
  }

  // Return the public API
  return {
    setupHandlers
  };
}

module.exports = initIpcManager;
