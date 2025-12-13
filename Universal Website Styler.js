// ==UserScript==
// @name         Universal AI Chat Styler (Berry Browser Fix)
// @namespace    http://yourdomain.example
// @version      2.2
// @description  Dynamically load custom CSS for ChatGPT and Claude AI
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @grant        none  // Berry Browser doesn't support grants
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';

// Enhanced configuration for Berry Browser
const CONFIG = {
    DEBUG_MODE: true,
    RETRY_DELAY: 500,
    MAX_RETRIES: 10,
    CACHE_DURATION: 12 * 60 * 60 * 1000,
    BERRY_INITIAL_DELAY: 3000,
    BERRY_MAX_WAIT: 10000
};

// Site configuration with Berry Browser optimizations
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/ChatGpt%20style.css',
        backupStyleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/ChatGpt%20style.css',
        styleID: 'chatgpt-enhanced-styles',
        berryReadySelector: '#__next, main, [data-testid^="conversation"], .flex-1',
        berryInjectionPoint: 'body',
        requiresFullReady: true,
        berryFallbackCSS: `body { background-color: red !important; border: 5px green solid; }` // Fallback for testing
    },
    'claude.ai': {
        name: 'Claude AI',
        styleURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/Claude%20AI%20style.css',
        backupStyleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Claude%20AI%20style.css',
        styleID: 'claude-enhanced-styles',
        berryReadySelector: 'body',
        berryInjectionPoint: 'head',
        requiresFullReady: false
    }
};

const currentDomain = window.location.hostname;
const currentSite = SITES[currentDomain];

if (!currentSite) return;

// Simple state
let styleElement = null;
let isBerryBrowser = !navigator.userAgent.includes('Tampermonkey');

// Enhanced Berry Browser detection
if (isBerryBrowser) {
    console.log('🍓 Berry Browser detected - using optimized methods');
    
    // Berry Browser-specific logging
    const originalLog = console.log;
    console.log = function(...args) {
        originalLog.apply(console, ['[AI-Styler]', ...args]);
    };
}

// Simple utility functions for Berry Browser
const utils = {
    log(message, type = 'info') {
        if (!CONFIG.DEBUG_MODE && type === 'debug') return;
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        console.log(`${prefix} [${currentSite.name}] ${message}`);
    },

    getCachedCSS() {
        try {
            const key = `css_cache_${currentSite.name}`;
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            
            const data = JSON.parse(cached);
            const now = Date.now();
            
            if (now - data.timestamp > CONFIG.CACHE_DURATION) {
                localStorage.removeItem(key);
                return null;
            }
            
            this.log('Using cached CSS', 'success');
            return data.css;
        } catch (e) {
            return null;
        }
    },

    setCachedCSS(css) {
        try {
            const key = `css_cache_${currentSite.name}`;
            const data = {
                css: css,
                timestamp: Date.now(),
                url: currentSite.styleURL
            };
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            return false;
        }
    },

    async waitForElement(selector, timeout = CONFIG.BERRY_MAX_WAIT) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const check = () => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    resolve(null);
                    return;
                }
                
                setTimeout(check, 100);
            };
            
            check();
        });
    },

    async waitForChatGPTReady() {
        if (currentDomain !== 'chatgpt.com' || !currentSite.requiresFullReady) {
            return true;
        }
        
        this.log('Waiting for ChatGPT DOM...', 'debug');
        
        // Multiple checks for ChatGPT's complex structure
        const checks = [
            () => document.querySelector('#__next'),
            () => document.querySelector('main'),
            () => document.querySelector('[data-testid^="conversation"]'),
            () => document.querySelector('.flex-1'),
            () => document.body?.childElementCount > 5
        ];
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < CONFIG.BERRY_MAX_WAIT) {
            const ready = checks.some(check => check());
            if (ready) {
                this.log('ChatGPT DOM ready', 'success');
                
                // Extra delay for Berry Browser
                if (isBerryBrowser) {
                    await new Promise(r => setTimeout(r, CONFIG.BERRY_INITIAL_DELAY));
                }
                
                return true;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        
        this.log('ChatGPT ready check timed out', 'warning');
        return false;
    },

    // Berry Browser-friendly fetch with fallbacks
    async fetchCSS() {
        // Try cache first
        const cached = this.getCachedCSS();
        if (cached) return cached;
        
        this.log('Fetching external CSS...', 'info');
        
        // URLs to try (primary and backup)
        const urls = [
            currentSite.styleURL,
            currentSite.backupStyleURL
        ];
        
        // For Berry Browser, also try with CORS proxies
        if (isBerryBrowser) {
            urls.push(
                `https://api.allorigins.win/raw?url=${encodeURIComponent(currentSite.styleURL)}`,
                `https://corsproxy.io/?${encodeURIComponent(currentSite.styleURL)}`
            );
        }
        
        for (const url of urls) {
            try {
                this.log(`Trying: ${url}`, 'debug');
                
                const response = await fetch(url, {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Accept': 'text/css',
                        'Origin': window.location.origin
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const css = await response.text();
                
                if (css && css.trim().length > 0) {
                    this.setCachedCSS(css);
                    this.log(`Fetched ${css.length} characters`, 'success');
                    return css;
                }
            } catch (error) {
                this.log(`Failed: ${error.message}`, 'debug');
                continue;
            }
        }
        
        // If all fetches fail and we have fallback CSS, use it
        if (currentSite.berryFallbackCSS) {
            this.log('Using fallback CSS', 'warning');
            return currentSite.berryFallbackCSS;
        }
        
        throw new Error('All fetch attempts failed');
    }
};

// Simplified style manager for Berry Browser
const styleManager = {
    async apply() {
        // Remove existing styles
        this.remove();
        
        // Wait for page to be ready (especially important for ChatGPT)
        if (currentSite.requiresFullReady) {
            await utils.waitForChatGPTReady();
        } else {
            await utils.waitForElement(currentSite.berryReadySelector);
        }
        
        try {
            // Get CSS content
            let cssContent;
            try {
                cssContent = await utils.fetchCSS();
            } catch (error) {
                utils.log(`CSS fetch failed: ${error.message}`, 'error');
                
                // For Berry Browser + ChatGPT, try alternative injection methods
                if (isBerryBrowser && currentDomain === 'chatgpt.com') {
                    return this.applyBerryFallback();
                }
                return false;
            }
            
            if (!cssContent || cssContent.trim().length === 0) {
                throw new Error('Empty CSS content');
            }
            
            // Inject styles
            return this.injectCSS(cssContent);
            
        } catch (error) {
            utils.log(`Apply failed: ${error.message}`, 'error');
            return false;
        }
    },
    
    injectCSS(cssContent) {
        try {
            // Method 1: Standard style element
            const style = document.createElement('style');
            style.id = currentSite.styleID;
            style.textContent = cssContent;
            style.setAttribute('type', 'text/css');
            style.setAttribute('data-injected-by', 'ai-styler');
            
            // Choose injection point based on site
            const injectionPoint = currentSite.berryInjectionPoint === 'body' 
                ? document.body 
                : document.head || document.documentElement;
            
            if (injectionPoint) {
                injectionPoint.appendChild(style);
                styleElement = style;
                utils.log('Styles injected successfully', 'success');
                return true;
            }
            
            // Method 2: Fallback to documentElement
            document.documentElement.appendChild(style);
            styleElement = style;
            utils.log('Styles injected to documentElement', 'success');
            return true;
            
        } catch (error) {
            utils.log(`Injection failed: ${error.message}`, 'error');
            
            // Last resort: create a link element (might work even if style doesn't)
            if (isBerryBrowser) {
                return this.createBlobCSS(cssContent);
            }
            
            return false;
        }
    },
    
    createBlobCSS(cssContent) {
        try {
            const blob = new Blob([cssContent], { type: 'text/css' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('link');
            link.id = currentSite.styleID;
            link.rel = 'stylesheet';
            link.href = url;
            link.setAttribute('data-injected-by', 'ai-styler-blob');
            
            (document.head || document.body).appendChild(link);
            styleElement = link;
            
            // Clean up blob URL when possible
            setTimeout(() => {
                try { URL.revokeObjectURL(url); } catch (e) {}
            }, 1000);
            
            utils.log('Styles injected via Blob URL', 'success');
            return true;
            
        } catch (error) {
            utils.log(`Blob injection failed: ${error.message}`, 'error');
            return false;
        }
    },
    
    // Special fallback for Berry Browser + ChatGPT
    applyBerryFallback() {
        if (currentDomain !== 'chatgpt.com' || !isBerryBrowser) {
            return false;
        }
        
        utils.log('Applying Berry Browser fallback method', 'warning');
        
        // Try to use the fallback CSS
        if (currentSite.berryFallbackCSS) {
            const style = document.createElement('style');
            style.textContent = currentSite.berryFallbackCSS;
            document.body.appendChild(style);
            styleElement = style;
            return true;
        }
        
        return false;
    },
    
    remove() {
        if (styleElement && styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
        }
        
        // Also clean up any other styles we might have added
        const styles = document.querySelectorAll('[data-injected-by="ai-styler"], [data-injected-by="ai-styler-blob"]');
        styles.forEach(style => {
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        });
        
        styleElement = null;
    }
};

// Simple menu for Berry Browser
function createBerryMenu() {
    const button = document.createElement('div');
    button.innerHTML = '🎨';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        background: #667eea;
        color: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        font-size: 20px;
        user-select: none;
    `;
    
    button.addEventListener('click', async () => {
        button.style.transform = 'scale(0.9)';
        await styleManager.apply();
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 200);
    });
    
    document.body.appendChild(button);
    
    // Add some hover effects
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        button.style.background = '#764ba2';
    });
    
    button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.background = '#667eea';
    });
}

// Main initialization
async function init() {
    utils.log(`Initializing ${currentSite.name} Styler`, 'info');
    
    // Extra delay for Berry Browser
    if (isBerryBrowser) {
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // For Berry Browser, use a simpler approach
    if (isBerryBrowser) {
        // Create menu button
        if (document.body) {
            createBerryMenu();
        } else {
            document.addEventListener('DOMContentLoaded', createBerryMenu);
        }
        
        // Try to apply styles
        setTimeout(async () => {
            await styleManager.apply();
            
            // Monitor for DOM changes (simplified)
            const observer = new MutationObserver(() => {
                if (!document.getElementById(currentSite.styleID)) {
                    styleManager.apply();
                }
            });
            
            observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
            });
        }, 2000);
        
    } else {
        // Original logic for Tampermonkey browsers
        setTimeout(async () => {
            await styleManager.apply();
        }, 500);
    }
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
