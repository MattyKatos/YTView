// Network Ad Blocker for YTView Main Process
// Handles network-level ad blocking using Electron's session API
const https = require('https');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const readline = require('readline');

/**
 * Initialize the Network Ad Blocker
 * @param {Object} settingsManager - Settings manager instance
 * @returns {Object} - Network ad blocker interface
 */
function initNetworkAdBlocker(settingsManager) {
  // Debug flag - shows ALL blocked requests in the console  
  const DEBUG = true;
  
  // Variables for tracking blocking statistics
  const blockStats = {
    totalRequests: 0,
    blockedRequests: 0,
    lastBlockedDomains: {},
    startTime: Date.now()
  };

  // Path for storing filter lists
  const filterDir = path.join(app.getPath('userData'), 'filter-lists');

  // Track active filter patterns - will be populated later
  const activeFilters = [];

  // Ensure filter directory exists
  if (!fs.existsSync(filterDir)) {
    fs.mkdirSync(filterDir, { recursive: true });
  }
  
  // We're using the already-declared blockStats from above
  
  // Helper to extract domain from URL
  function extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return url.split('/')[2] || 'unknown';
    }
  }
  
  // Define comprehensive blocklists - much more aggressive approach
  const uBlockLists = {
    // Main EasyList for blocking ads - very reliable
    easylist: {
      url: 'https://easylist.to/easylist/easylist.txt',
      path: path.join(filterDir, 'easylist.txt'),
      patterns: []
    },
    // EasyPrivacy tracking protection
    easyprivacy: {
      url: 'https://easylist.to/easylist/easyprivacy.txt',
      path: path.join(filterDir, 'easyprivacy.txt'),
      patterns: []
    },
    // uBlock Origin Filters
    ublock: {
      url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/filters.txt',
      path: path.join(filterDir, 'ublock-filters.txt'),
      patterns: []
    },
    // uBlock Origin Annoyances
    ublockannoynaces: {
      url: 'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/annoyances.txt',
      path: path.join(filterDir, 'ublock-annoyances.txt'),
      patterns: []
    },
    // YouTube-specific filters
    youtubeAnnoyances: {
      url: 'https://raw.githubusercontent.com/DandelionSprout/adfilt/master/BrowseWebsitesWithoutLoggingIn.txt', 
      path: path.join(filterDir, 'youtube-annoyances.txt'),
      patterns: []
    },
    // YouTube Adblock Warning Removal
    youtubeAdblockWarning: {
      url: 'https://raw.githubusercontent.com/bogachenko/fuckfuckadblock/master/fuckfuckadblock.txt',
      path: path.join(filterDir, 'youtube-adblock-warning.txt'),
      patterns: []
    },
    // AdGuard Base filter list
    adguard: {
      url: 'https://filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt',
      path: path.join(filterDir, 'adguard-base.txt'),
      patterns: []
    },
    // Brave Adblock Default List
    brave: {
      url: 'https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/default.txt',
      path: path.join(filterDir, 'brave-default.txt'),
      patterns: []
    }
  };
  
  // Core blocking list - extremely aggressive with YouTube ads
  // These are high-priority rules that will be applied first
  const coreYoutubeAdDomains = [
    // Standard ad domains
    '*://*.doubleclick.net/*',
    '*://*.googlesyndication.com/*',
    '*://*.googleadservices.com/*',
    '*://*.google-analytics.com/*',
    '*://*.googletagservices.com/*',
    '*://*.googletagmanager.com/*',
    '*://*.moatads.com/*',
    '*://*.adsystem.com/*',
    '*://*.adservice.google.*/*',
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
    '*://*/videoplayback*&adt=*',
    '*://*/videoplayback*&adformat=*',
    '*://*/videoplayback*&afc=*',
    '*://*/videoplayback*&c=*',
    
    // Common ad tracking parameters
    '*://*/*&ad_type=*',
    '*://*/*&adurl=*',
    '*://*/*?adurl=*',
    '*://*/*&adformat=*',
    '*://*/*?adformat=*'
  ];

  // Initialize our active filters with core domains
  activeFilters.push(...coreYoutubeAdDomains);
  
  /**
   * Download a filter list file
   * @param {Object} list - Filter list configuration
   * @returns {Promise}
   */
  function downloadFilterList(list) {
    return new Promise((resolve, reject) => {
      // Check if we already have a recent copy (less than 1 week old)
      if (fs.existsSync(list.path)) {
        const stats = fs.statSync(list.path);
        const fileAge = Date.now() - stats.mtimeMs;
        // If file is less than 7 days old, use cached version
        if (fileAge < 7 * 24 * 60 * 60 * 1000) {
          console.log(`Using cached ${path.basename(list.path)} (age: ${Math.round(fileAge / (24 * 60 * 60 * 1000))} days)`);
          return resolve(false);
        }
      }
      
      // Download the list
      console.log(`Downloading filter list: ${list.url}`);
      const file = fs.createWriteStream(list.path);
      
      https.get(list.url, (response) => {
        // Handle redirection
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          https.get(redirectUrl, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
              file.close();
              console.log(`Downloaded ${path.basename(list.path)}`);
              resolve(true);
            });
          }).on('error', (err) => {
            fs.unlink(list.path, () => {}); // Delete the file on error
            reject(err);
          });
        } else {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            console.log(`Downloaded ${path.basename(list.path)}`);
            resolve(true);
          });
        }
      }).on('error', (err) => {
        fs.unlink(list.path, () => {}); // Delete the file on error
        reject(err);
      });
    });
  }
  
  /**
   * Parse a filter list file and extract URL patterns
   * @param {Object} list - Filter list configuration
   * @returns {Promise<string[]>} Array of URL patterns
   */
  function parseFilterList(list) {
    return new Promise((resolve, reject) => {
      fs.readFile(list.path, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        
        const patterns = [];
        const lines = data.split('\n');
        
        for (const line of lines) {
          // Skip comments, empty lines, and element hiding rules
          if (line.startsWith('!') || line.startsWith('[') || line.startsWith('#') || line.trim() === '') {
            continue;
          }
          
          // Skip element hiding and cosmetic filters
          if (line.includes('##') || line.includes('#@#') || line.includes('#?#')) {
            continue;
          }
          
          // Handle domain options
          const trimmedLine = line.trim();
          
          // Apply all URL blocking patterns - aggressive approach
          // We're now taking all valid URL/domain blocking patterns
          if (trimmedLine.includes('||') || trimmedLine.includes('*://') || trimmedLine.includes('http')) {
            
            // Extract and convert the pattern to Electron's URL pattern format
            let pattern = trimmedLine;
            
            // Handle domain anchor format: ||example.com^
            if (pattern.startsWith('||')) {
              pattern = pattern.replace('||', '*://*.');
              // Handle domain suffix anchor: ^ 
              if (pattern.includes('^')) {
                pattern = pattern.replace('^', '/*');
              } else {
                pattern += '/*';
              }
            }
            
            // Add http/https prefix if not present
            if (!pattern.startsWith('*://') && !pattern.startsWith('http')) {
              pattern = '*://' + pattern;
            }
            
            // Replace wildcards
            pattern = pattern.replace(/\^/g, '/');
            
            // Add the pattern if it's valid and not a duplicate
            if (pattern.includes('*://*') && !patterns.includes(pattern)) {
              patterns.push(pattern);
            }
          }
        }
        
        // Store the patterns
        list.patterns = patterns;
        console.log(`Extracted ${patterns.length} URL patterns from ${path.basename(list.path)}`);
        resolve(patterns);
      });
    });
  }
  
  /**
   * Initialize the filter lists
   * @returns {Promise<void>}
   */
  async function initializeFilterLists() {
    try {
      // Clear active filters first
      activeFilters = [...coreYoutubeAdDomains];
      
      // Download and parse filter lists
      for (const list of Object.values(uBlockLists)) {
        await downloadFilterList(list);
        await parseFilterList(list);
        
        // Add ALL patterns from each list - maximum blocking power
        // We're no longer limiting the number of patterns
        console.log(`Adding all ${list.patterns.length} patterns from ${path.basename(list.path)}`);
        activeFilters.push(...list.patterns);
      }
      
      console.log(`Total active filters: ${activeFilters.length}`);
      return activeFilters;
    } catch (error) {
      console.error('Error initializing filter lists:', error);
      return coreYoutubeAdDomains; // Fallback to core filters
    }
  }

  /**
   * Print ad blocking statistics to console
   */
  function printBlockStats() {
    const runTime = ((Date.now() - blockStats.startTime) / 1000 / 60).toFixed(1);
    const blockRate = blockStats.totalRequests > 0 
      ? ((blockStats.blockedRequests / blockStats.totalRequests) * 100).toFixed(1) 
      : 0;
    
    console.log('\n=== YTView Network Ad Blocking Stats ===');
    console.log(`Runtime: ${runTime} minutes`);
    console.log(`Total Requests Examined: ${blockStats.totalRequests}`);
    console.log(`Requests Blocked: ${blockStats.blockedRequests} (${blockRate}%)`);
    
    // Show top blocked domains
    const domains = Object.entries(blockStats.lastBlockedDomains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    if (domains.length > 0) {
      console.log('\nTop Blocked Domains:');
      domains.forEach(([domain, count]) => {
        console.log(`- ${domain}: ${count} requests`);
      });
    }
    console.log('=======================================\n');
  }

  // Set up network-level ad blocking for a session
  async function setupAdBlocking(session) {
    if (!session) {
      console.error('No session provided for ad blocking');
      return function noop() {};
    }
    
    // Reset the statistics object for this session
    blockStats.totalRequests = 0;
    blockStats.blockedRequests = 0;
    blockStats.lastBlockedDomains = {};
    blockStats.startTime = Date.now();
    
    // Make sure we log every single blocked request
    console.log('Network ad blocking enabled - showing ALL blocked requests!');
    
    // Print stats every 5 minutes
    const statsInterval = setInterval(printBlockStats, 5 * 60 * 1000);
    
    // CRITICAL FIX: Use multiple handlers with specific URL patterns for more reliable blocking
    console.log('Setting up core blocking patterns...');
    
    // 1. Set up core pattern blocking - most critical ads
    session.webRequest.onBeforeRequest(
      { urls: coreYoutubeAdDomains }, 
      (details, callback) => {
        // Get current ad blocking setting
        const adBlockingEnabled = settingsManager.getSetting('adBlockingEnabled', true);
        
        // Count all examined requests
        blockStats.totalRequests++;
        
        // Block only if ad blocking is enabled
        if (adBlockingEnabled === true) {
          // Extract domain for statistics
          const domain = extractDomain(details.url);
          
          blockStats.blockedRequests++;
          blockStats.lastBlockedDomains[domain] = (blockStats.lastBlockedDomains[domain] || 0) + 1;
          
          // Log with CORE indicator
          console.log(`📛 CORE BLOCKED: ${domain} (${details.url.substring(0, 60)}...)`);
          callback({ cancel: true });
        } else {
          callback({ cancel: false });
        }
      }
    );
    
    // 2. Set up YouTubeAd specific blocking
    console.log('Setting up YouTube-specific ad blocking...');
    session.webRequest.onBeforeRequest(
      { urls: [
        '*://www.youtube.com/api/stats/*', 
        '*://www.youtube.com/pagead/*',
        '*://www.youtube.com/ptracking*',
        '*://www.youtube.com/*?*adformat=*',
        '*://www.youtube.com/youtubei/v1/player*',
        '*://www.youtube.com/youtubei/v1/log_event*'
      ]}, 
      (details, callback) => {
        blockStats.totalRequests++;
        
        if (settingsManager.getSetting('adBlockingEnabled', true)) {
          const domain = extractDomain(details.url);
          blockStats.blockedRequests++;
          blockStats.lastBlockedDomains[domain] = (blockStats.lastBlockedDomains[domain] || 0) + 1;
          console.log(`📛 YT-SPECIFIC BLOCKED: ${domain} (${details.url.substring(0, 60)}...)`);
          callback({ cancel: true });
        } else {
          callback({ cancel: false });
        }
      }
    );
    
    // 3. Set up general ad domain blocking (full list)
    if (activeFilters && activeFilters.length > 0) {
      console.log(`Setting up general blocking with ${activeFilters.length} patterns...`);
      
      // Split into smaller batches of 500 patterns to avoid exceeding limits
      const batchSize = 500;
      
      for (let i = 0; i < activeFilters.length; i += batchSize) {
        const batch = activeFilters.slice(i, i + batchSize);
        console.log(`Registering batch ${Math.floor(i / batchSize) + 1} of filters (${batch.length} patterns)`);
        
        session.webRequest.onBeforeRequest(
          { urls: batch }, 
          (details, callback) => {
            blockStats.totalRequests++;
            
            if (settingsManager.getSetting('adBlockingEnabled', true)) {
              const domain = extractDomain(details.url);
              blockStats.blockedRequests++;
              blockStats.lastBlockedDomains[domain] = (blockStats.lastBlockedDomains[domain] || 0) + 1;
              console.log(`📛 PATTERN BLOCKED: ${domain} (${details.url.substring(0, 60)}...)`);
              callback({ cancel: true });
            } else {
              callback({ cancel: false });
            }
          }
        );
      }
    } else {
      console.warn('No active filter patterns available - using only core blocking');
    }
    
    // 4. Generic catch-all for common ad keywords
    console.log('Setting up catch-all ad keyword matching...');
    session.webRequest.onBeforeRequest(
      { urls: ['*://*/*'] },
      (details, callback) => {
        // Only process if adblocking is enabled
        if (!settingsManager.getSetting('adBlockingEnabled', true)) {
          callback({ cancel: false });
          return;
        }
        
        // Extract URL parts
        const url = details.url.toLowerCase();
        
        // Skip processing non-ad content to avoid performance impact
        if (!url.includes('ad') && 
            !url.includes('sponsor') && 
            !url.includes('track') && 
            !url.includes('analytics') && 
            !url.includes('metric') && 
            !url.includes('pixel')) {
          callback({ cancel: false });
          return;
        }
        
        // Check for ad keywords in URL
        const isAd = 
          // Common ad URL patterns
          (url.includes('/ad/') || 
           url.includes('/ads/') || 
           url.includes('/advert/') || 
           url.includes('/advertising/') ||
           url.includes('doubleclick') ||
           url.includes('googleads') ||
           url.includes('googlesyndication') ||
           
           // Ad URL parameters
           url.includes('ad_type=') ||
           url.includes('ad_block=') ||
           url.includes('adformat=') ||
           url.includes('adunit=') ||
           url.includes('adposition=') ||
           url.includes('adserve') ||
           
           // YouTube specific
           url.includes('youtube.com/pagead/') ||
           url.includes('youtube.com/api/stats/ads'));
        
        if (isAd) {
          blockStats.totalRequests++;
          const domain = extractDomain(details.url);
          blockStats.blockedRequests++;
          blockStats.lastBlockedDomains[domain] = (blockStats.lastBlockedDomains[domain] || 0) + 1;
          console.log(`📛 KEYWORD BLOCKED: ${domain} (${details.url.substring(0, 60)}...)`);
          callback({ cancel: true });
        } else {
          callback({ cancel: false });
        }
      }
    );
    
    console.log('✅ Network-level ad blocking initialized with multiple pattern layers');
    console.log('   -> Core YouTube ad patterns: ✓');
    console.log('   -> YouTube-specific endpoints: ✓');
    console.log('   -> uBlock filter patterns: ✓');
    console.log('   -> Keyword-based catching: ✓');
    
    // Return cleanup function
    return function cleanup() {
      clearInterval(statsInterval);
      console.log('Network ad blocking stats logging stopped');
    };
  }
  
  /**
   * Update ad blocking settings
   * @param {boolean} enabled - Whether ad blocking is enabled
   */
  function updateSettings(enabled) {
    // No action needed - the onBeforeRequest handler gets the current setting each time
    console.log(`Ad blocking ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Refresh the filter lists
   * @returns {Promise<string[]>} - The updated active filters
   */
  async function refreshFilterLists() {
    console.log('Refreshing ad filter lists...');
    try {
      // Force redownload by clearing the cache first
      for (const list of Object.values(uBlockLists)) {
        if (fs.existsSync(list.path)) {
          fs.unlinkSync(list.path);
        }
      }
      return await initializeFilterLists();
    } catch (error) {
      console.error('Error refreshing filter lists:', error);
      return activeFilters; // Return current filters on error
    }
  }

  // Return the public API
  return {
    setupAdBlocking,
    updateSettings,
    refreshFilterLists,
    getActiveFilters: () => [...activeFilters],
    printBlockStats  // Export this so we can call it from main process
  };
}

module.exports = initNetworkAdBlocker;
