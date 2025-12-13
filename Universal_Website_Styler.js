// ==UserScript==
// @name         Universal AI Chat Styler - jsDelivr CDN Edition
// @namespace    http://yourdomain.example
// @version      4.0
// @description  Multi-CDN CSS loader for ChatGPT and Claude AI (jsDelivr primary)
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
'use strict';

// Configuration
const CONFIG = {
    DEBUG_MODE: true,
    CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours (can be longer with CDN)
    CACHE_KEY_PREFIX: 'css_cache_v4_',
    FETCH_TIMEOUT: 8000,
    MAX_RETRIES: 2
};

// Site configuration with multi-CDN fallback
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        // Multiple CDN sources in priority order
        cdnURLs: [
            // Primary: jsDelivr (best CORS, caching, CSP compatibility)
            'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/ChatGpt_style.css',
            
            // Fallback 1: Statically.io (GitHub CDN alternative)
            'https://cdn.statically.io/gh/yfjuu4/ai-chat-styles/main/ChatGpt_style.css',
            
            // Fallback 2: GitHack (raw GitHub with proper headers)
            'https://raw.githack.com/yfjuu4/ai-chat-styles/main/ChatGpt_style.css',
            
            // Fallback 3: Combinatronics (another GitHub CDN)
            'https://combinatronics.io/yfjuu4/ai-chat-styles/main/ChatGpt_style.css',
            
            // Last resort: GitHub raw (we know this has issues)
            'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/ChatGpt_style.css'
        ],
        styleID: 'chatgpt-enhanced-styles',
        enabledKey: 'chatgpt_styles_enabled'
    },
    'claude.ai': {
        name: 'Claude AI',
        cdnURLs: [
            'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Claude_AI_style.css',
            'https://cdn.statically.io/gh/yfjuu4/ai-chat-styles/main/Claude_AI_style.css',
            'https://raw.githack.com/yfjuu4/ai-chat-styles/main/Claude_AI_style.css',
            'https://combinatronics.io/yfjuu4/ai-chat-styles/main/Claude_AI_style.css',
            'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Claude_AI_style.css'
        ],
        styleID: 'claude-enhanced-styles',
        enabledKey: 'claude_styles_enabled'
    }
};

const currentSite = SITES[window.location.hostname];
if (!currentSite) return;

// State
const state = {
    cssContent: null,
    isEnabled: true,
    isFetching: false,
    successfulCDN: null, // Track which CDN worked
    fetchAttempts: []
};

// Utility functions
const utils = {
    log(message, level = 'info') {
        if (!CONFIG.DEBUG_MODE && level === 'debug') return;
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'debug': '🔍',
            'cdn': '🌐'
        }[level] || 'ℹ️';
        console.log(`${emoji} [${currentSite.name}] ${message}`);
    },

    getFromCache() {
        try {
            const cacheKey = CONFIG.CACHE_KEY_PREFIX + currentSite.name;
            const cached = localStorage.getItem(cacheKey);
            if (!cached) return null;

            const { css, timestamp, cdnURL } = JSON.parse(cached);
            
            if (Date.now() - timestamp > CONFIG.CACHE_DURATION) {
                this.log('Cache expired', 'debug');
                return null;
            }

            this.log(`Using cached CSS from ${cdnURL} (${css.length} chars)`, 'success');
            state.successfulCDN = cdnURL; // Remember successful CDN
            return css;
        } catch (e) {
            this.log(`Cache read error: ${e.message}`, 'error');
            return null;
        }
    },

    saveToCache(css, cdnURL) {
        try {
            const cacheKey = CONFIG.CACHE_KEY_PREFIX + currentSite.name;
            const cacheData = {
                css: css,
                timestamp: Date.now(),
                cdnURL: cdnURL
            };
            localStorage.setItem(cacheKey, JSON.stringify(cacheData));
            this.log(`CSS cached from ${this.getCDNName(cdnURL)}`, 'debug');
        } catch (e) {
            this.log(`Cache write error: ${e.message}`, 'error');
        }
    },

    getCDNName(url) {
        if (url.includes('jsdelivr')) return 'jsDelivr';
        if (url.includes('statically')) return 'Statically';
        if (url.includes('githack')) return 'GitHack';
        if (url.includes('combinatronics')) return 'Combinatronics';
        if (url.includes('githubusercontent')) return 'GitHub Raw';
        return 'Unknown CDN';
    },

    getEnabled() {
        try {
            const value = localStorage.getItem(currentSite.enabledKey);
            return value === null ? true : JSON.parse(value);
        } catch (e) {
            return true;
        }
    },

    setEnabled(enabled) {
        try {
            localStorage.setItem(currentSite.enabledKey, JSON.stringify(enabled));
            state.isEnabled = enabled;
        } catch (e) {
            this.log(`Failed to save enabled state: ${e.message}`, 'error');
        }
    }
};

// CSS Fetcher with intelligent CDN selection
const cssFetcher = {
    // Reorder CDNs to try successful one first
    getOptimizedCDNOrder() {
        const urls = [...currentSite.cdnURLs];
        
        // If we know which CDN worked before, try it first
        if (state.successfulCDN) {
            const successIndex = urls.indexOf(state.successfulCDN);
            if (successIndex > 0) {
                urls.splice(successIndex, 1);
                urls.unshift(state.successfulCDN);
                utils.log(`Prioritizing ${utils.getCDNName(state.successfulCDN)} (previously successful)`, 'cdn');
            }
        }
        
        return urls;
    },

    async fetchFromURL(url, method = 'fetch') {
        const startTime = Date.now();
        const cdnName = utils.getCDNName(url);
        
        try {
            utils.log(`Trying ${cdnName}: ${method}`, 'cdn');
            
            let css;
            
            if (method === 'fetch') {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_TIMEOUT);
                
                const response = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal,
                    mode: 'cors',
                    cache: 'default', // Use browser cache for CDN
                    credentials: 'omit',
                    headers: {
                        'Accept': 'text/css,*/*'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                css = await response.text();
                
            } else if (method === 'xhr') {
                css = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.timeout = CONFIG.FETCH_TIMEOUT;
                    
                    xhr.onload = function() {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve(xhr.responseText);
                        } else {
                            reject(new Error(`HTTP ${xhr.status}`));
                        }
                    };
                    
                    xhr.onerror = () => reject(new Error('Network error'));
                    xhr.ontimeout = () => reject(new Error('Timeout'));
                    
                    xhr.open('GET', url, true);
                    xhr.send();
                });
            }
            
            const duration = Date.now() - startTime;
            
            if (!css || css.trim().length === 0) {
                throw new Error('Empty response');
            }
            
            // Validate CSS content (basic check)
            if (css.length < 10 || !css.includes('{')) {
                throw new Error('Invalid CSS content');
            }
            
            state.fetchAttempts.push({
                cdn: cdnName,
                url: url,
                method: method,
                success: true,
                duration: duration,
                size: css.length
            });
            
            utils.log(`✅ ${cdnName} SUCCESS (${duration}ms, ${css.length} chars)`, 'success');
            
            state.successfulCDN = url;
            return { css, url };
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            state.fetchAttempts.push({
                cdn: cdnName,
                url: url,
                method: method,
                success: false,
                error: error.message,
                duration: duration
            });
            
            utils.log(`❌ ${cdnName} failed: ${error.message} (${duration}ms)`, 'debug');
            throw error;
        }
    },

    async fetchCSS() {
        if (state.isFetching) {
            utils.log('Fetch already in progress', 'debug');
            return null;
        }

        state.isFetching = true;
        state.fetchAttempts = [];

        // Check cache first
        const cached = utils.getFromCache();
        if (cached) {
            state.cssContent = cached;
            state.isFetching = false;
            return cached;
        }

        utils.log('🌐 Starting multi-CDN fetch strategy', 'info');

        const cdnURLs = this.getOptimizedCDNOrder();
        const methods = ['fetch', 'xhr'];

        // Try each CDN with each method
        for (let retry = 0; retry < CONFIG.MAX_RETRIES; retry++) {
            if (retry > 0) {
                utils.log(`Retry attempt ${retry + 1}/${CONFIG.MAX_RETRIES}`, 'info');
            }

            for (const url of cdnURLs) {
                for (const method of methods) {
                    try {
                        const { css, url: successURL } = await this.fetchFromURL(url, method);
                        
                        if (css) {
                            utils.saveToCache(css, successURL);
                            state.cssContent = css;
                            state.isFetching = false;
                            
                            utils.log(`📊 Fetch Statistics:`, 'info');
                            utils.log(`  Attempts: ${state.fetchAttempts.length}`, 'info');
                            utils.log(`  Success: ${utils.getCDNName(successURL)} via ${method}`, 'info');
                            
                            return css;
                        }
                    } catch (error) {
                        // Continue to next CDN/method
                        continue;
                    }
                }
            }
            
            // Wait before retry
            if (retry < CONFIG.MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (retry + 1)));
            }
        }

        state.isFetching = false;
        utils.log('❌ All CDN sources failed', 'error');
        utils.log(`📊 Failed attempts: ${state.fetchAttempts.length}`, 'error');
        
        // Log detailed failure report
        state.fetchAttempts.forEach(attempt => {
            utils.log(`  ${attempt.cdn} (${attempt.method}): ${attempt.success ? 'OK' : attempt.error}`, 'debug');
        });
        
        return null;
    }
};

// Style injector
const styleInjector = {
    inject(css) {
        if (!css || css.trim().length === 0) {
            utils.log('No CSS to inject', 'error');
            return false;
        }

        try {
            // Remove existing style
            this.remove();

            // Create inline style element (CSP-compliant)
            const style = document.createElement('style');
            style.id = currentSite.styleID;
            style.type = 'text/css';
            style.textContent = css;
            style.setAttribute('data-source', 'berry-styler-cdn');
            style.setAttribute('data-cdn', state.successfulCDN || 'cached');

            // Inject into head
            const target = document.head || document.documentElement;
            target.appendChild(style);

            utils.log(`CSS injected (${css.length} chars)`, 'success');
            
            // Verify injection
            setTimeout(() => {
                const verified = document.getElementById(currentSite.styleID);
                if (verified && verified.sheet) {
                    const ruleCount = verified.sheet.cssRules?.length || 0;
                    utils.log(`✓ Injection verified: ${ruleCount} CSS rules active`, 'success');
                } else {
                    utils.log('⚠ Injection verification inconclusive', 'debug');
                }
            }, 500);

            return true;
        } catch (error) {
            utils.log(`Injection failed: ${error.message}`, 'error');
            return false;
        }
    },

    remove() {
        const element = document.getElementById(currentSite.styleID);
        if (element) {
            element.remove();
            utils.log('CSS removed', 'debug');
        }
    }
};

// Main application
const app = {
    async init() {
        utils.log(`🚀 Initializing ${currentSite.name} Styler v4.0 (jsDelivr CDN)`, 'info');
        
        state.isEnabled = utils.getEnabled();
        
        if (!state.isEnabled) {
            utils.log('Styles disabled by user', 'info');
            return;
        }

        // Start fetching immediately
        await this.loadAndApplyCSS();
        
        // Setup UI controls
        this.setupControls();
        
        // Watch for navigation
        this.watchNavigation();
    },

    async loadAndApplyCSS() {
        try {
            const css = await cssFetcher.fetchCSS();
            
            if (css) {
                state.cssContent = css;
                
                // Wait for DOM if needed
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        styleInjector.inject(css);
                    });
                } else {
                    styleInjector.inject(css);
                }
            } else {
                utils.log('Failed to fetch CSS from any CDN', 'error');
                this.showNotification('⚠️ Failed to load styles');
            }
        } catch (error) {
            utils.log(`Init error: ${error.message}`, 'error');
        }
    },

    setupControls() {
        const addControls = () => {
            if (!document.body) {
                setTimeout(addControls, 100);
                return;
            }

            // Main toggle button
            const toggleBtn = document.createElement('button');
            toggleBtn.id = 'berry-styler-toggle';
            toggleBtn.innerHTML = state.isEnabled ? '🎨' : '🚫';
            toggleBtn.title = `${currentSite.name} Styles: ${state.isEnabled ? 'ON' : 'OFF'}`;
            toggleBtn.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                font-size: 24px;
                cursor: pointer;
                z-index: 2147483647;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
                opacity: ${state.isEnabled ? '1' : '0.6'};
            `;

            toggleBtn.onclick = () => this.toggle();
            
            // Long press for stats
            let longPressTimer;
            toggleBtn.addEventListener('touchstart', () => {
                longPressTimer = setTimeout(() => this.showStats(), 1500);
            });
            toggleBtn.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });
            
            document.body.appendChild(toggleBtn);

            // Refresh button
            const refreshBtn = document.createElement('button');
            refreshBtn.innerHTML = '🔄';
            refreshBtn.title = 'Reload CSS';
            refreshBtn.style.cssText = toggleBtn.style.cssText + 'bottom: 80px; font-size: 20px;';
            refreshBtn.onclick = () => this.refresh();
            document.body.appendChild(refreshBtn);
        };

        addControls();
    },

    toggle() {
        state.isEnabled = !state.isEnabled;
        utils.setEnabled(state.isEnabled);

        if (state.isEnabled) {
            if (state.cssContent) {
                styleInjector.inject(state.cssContent);
            } else {
                this.loadAndApplyCSS();
            }
        } else {
            styleInjector.remove();
        }

        this.updateButton();
        this.showNotification(`${state.isEnabled ? '✅' : '❌'} Styles ${state.isEnabled ? 'ON' : 'OFF'}`);
    },

    async refresh() {
        utils.log('Manual refresh triggered', 'info');
        
        // Clear cache
        try {
            const cacheKey = CONFIG.CACHE_KEY_PREFIX + currentSite.name;
            localStorage.removeItem(cacheKey);
            state.successfulCDN = null;
            utils.log('Cache cleared', 'debug');
        } catch (e) {
            utils.log(`Cache clear error: ${e.message}`, 'error');
        }

        state.cssContent = null;
        styleInjector.remove();

        if (state.isEnabled) {
            this.showNotification('🔄 Reloading CSS...');
            await this.loadAndApplyCSS();
        }
    },

    showStats() {
        const cdnName = state.successfulCDN ? utils.getCDNName(state.successfulCDN) : 'Unknown';
        const cssSize = state.cssContent ? `${state.cssContent.length} chars` : 'Not loaded';
        
        console.group('📊 Styler Statistics');
        console.log('Status:', state.isEnabled ? 'Enabled ✅' : 'Disabled ❌');
        console.log('CSS Size:', cssSize);
        console.log('CDN Used:', cdnName);
        console.log('Fetch Attempts:', state.fetchAttempts.length);
        if (state.fetchAttempts.length > 0) {
            console.table(state.fetchAttempts);
        }
        console.groupEnd();
        
        this.showNotification(`📊 CDN: ${cdnName}`);
    },

    updateButton() {
        const btn = document.getElementById('berry-styler-toggle');
        if (btn) {
            btn.innerHTML = state.isEnabled ? '🎨' : '🚫';
            btn.style.opacity = state.isEnabled ? '1' : '0.6';
            btn.title = `${currentSite.name} Styles: ${state.isEnabled ? 'ON' : 'OFF'}`;
        }
    },

    showNotification(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 140px;
            right: 20px;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 10px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            z-index: 2147483646;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transition: opacity 0.3s;
            max-width: 200px;
        `;
        toast.textContent = message;

        const addToast = () => {
            if (document.body) {
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                }, 2000);
            } else {
                setTimeout(addToast, 100);
            }
        };
        addToast();
    },

    watchNavigation() {
        let lastURL = location.href;
        
        const checkURL = () => {
            if (location.href !== lastURL) {
                lastURL = location.href;
                utils.log('Navigation detected', 'debug');
                
                if (state.isEnabled && state.cssContent) {
                    setTimeout(() => {
                        if (!document.getElementById(currentSite.styleID)) {
                            utils.log('Re-injecting CSS after navigation', 'debug');
                            styleInjector.inject(state.cssContent);
                        }
                    }, 500);
                }
            }
        };

        setInterval(checkURL, 1000);
    }
};

// Initialize
app.init();

})();
