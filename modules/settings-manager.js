// Settings Manager Module for YTView Main Process
// Handles settings storage and retrieval for all features

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Initialize the Settings Manager
 * @param {Object} initialSettings - Initial default settings
 * @returns {Object} - Settings manager interface
 */
function initSettingsManager(initialSettings = {}) {
  // Default settings
  const defaultSettings = {
    adBlockingEnabled: true,
    sponsorBlockEnabled: true,
    dearrowEnabled: true,
    returnDislikeEnabled: true,
    downloadEnabled: true
  };

  // Current settings
  let settings = { ...defaultSettings, ...initialSettings };
  
  // Settings file path
  const settingsFilePath = path.join(app.getPath('userData'), 'settings.json');
  
  /**
   * Load settings from disk
   * @returns {Promise<Object>} - Loaded settings
   */
  async function loadSettings() {
    try {
      if (fs.existsSync(settingsFilePath)) {
        const data = await fs.promises.readFile(settingsFilePath, 'utf8');
        const loadedSettings = JSON.parse(data);
        settings = { ...defaultSettings, ...loadedSettings };
        console.log('Settings loaded from disk:', settings);
      } else {
        // If no settings file exists, create one with defaults
        await saveSettings();
      }
      return { ...settings };
    } catch (error) {
      console.error('Error loading settings:', error);
      return { ...defaultSettings };
    }
  }
  
  /**
   * Save settings to disk
   * @returns {Promise<boolean>} - Success status
   */
  async function saveSettings() {
    try {
      await fs.promises.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
      console.log('Settings saved to disk');
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }
  
  /**
   * Get all settings
   * @returns {Object} - Current settings
   */
  function getAllSettings() {
    return { ...settings };
  }
  
  /**
   * Get a specific setting
   * @param {string} key - Setting key
   * @param {any} defaultValue - Default value if setting doesn't exist
   * @returns {any} - Setting value
   */
  function getSetting(key, defaultValue) {
    return settings[key] !== undefined ? settings[key] : defaultValue;
  }
  
  /**
   * Update settings
   * @param {Object} newSettings - Settings to update
   * @returns {Promise<Object>} - Updated settings and success status
   */
  async function updateSettings(newSettings) {
    if (!newSettings || typeof newSettings !== 'object') {
      return { success: false, error: 'Invalid settings object' };
    }
    
    try {
      // Update settings
      settings = { ...settings, ...newSettings };
      
      // Save to disk
      const saveSuccess = await saveSettings();
      
      return { 
        success: saveSuccess, 
        settings: { ...settings },
        error: saveSuccess ? null : 'Failed to save settings'
      };
    } catch (error) {
      console.error('Error updating settings:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }
  
  /**
   * Reset settings to defaults
   * @returns {Promise<Object>} - Default settings and success status
   */
  async function resetSettings() {
    try {
      settings = { ...defaultSettings };
      const saveSuccess = await saveSettings();
      
      return { 
        success: saveSuccess, 
        settings: { ...settings },
        error: saveSuccess ? null : 'Failed to save settings'
      };
    } catch (error) {
      console.error('Error resetting settings:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }
  
  // Initialize by loading settings
  loadSettings().catch(error => {
    console.error('Failed to load settings on initialization:', error);
  });
  
  // Return the public API
  return {
    loadSettings,
    saveSettings,
    getAllSettings,
    getSetting,
    updateSettings,
    resetSettings
  };
}

module.exports = initSettingsManager;
