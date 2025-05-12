// Window Manager for YTView Main Process
// Handles window creation and management

const { BrowserWindow, screen } = require('electron');
const path = require('path');

/**
 * Initialize the Window Manager
 * @param {Object} options - Configuration options
 * @returns {Object} - Window manager interface
 */
function initWindowManager(options = {}) {
  // Store main window reference
  let mainWindow = null;
  
  // Default window options
  const defaultOptions = {
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js')
    }
  };
  
  /**
   * Create the main application window
   * @returns {BrowserWindow} - The created window
   */
  function createMainWindow() {
    // Create window with combined options
    const windowOptions = { ...defaultOptions, ...options };
    const win = new BrowserWindow(windowOptions);
    
    // Load the application HTML
    win.loadFile('index.html');
    
    // Set window reference
    mainWindow = win;
    
    // Add window event listeners
    setupWindowEvents(win);
    
    return win;
  }
  
  /**
   * Set up window events
   * @param {BrowserWindow} win - Window to set up events for
   */
  function setupWindowEvents(win) {
    // Clean up reference when window is closed
    win.on('closed', () => {
      mainWindow = null;
    });
    
    // Prevent garbage collection
    win.on('ready-to-show', () => {
      win.show();
    });
  }
  
  /**
   * Get the main window
   * @returns {BrowserWindow|null} - The main window or null if not created
   */
  function getMainWindow() {
    return mainWindow;
  }
  
  /**
   * Minimize the main window
   */
  function minimizeWindow() {
    if (mainWindow) {
      mainWindow.minimize();
    }
  }
  
  /**
   * Maximize or restore the main window
   */
  function maximizeWindow() {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.restore();
      } else {
        mainWindow.maximize();
      }
    }
  }
  
  /**
   * Close the main window
   */
  function closeWindow() {
    if (mainWindow) {
      mainWindow.close();
    }
  }
  
  // Return the public API
  return {
    createMainWindow,
    getMainWindow,
    minimizeWindow,
    maximizeWindow,
    closeWindow
  };
}

module.exports = initWindowManager;
