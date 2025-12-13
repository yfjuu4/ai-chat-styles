// ==UserScript==
// @name         Universal AI Chat Styler (Multi-Site) - jsDelivr Optimized
// @namespace    http://yourdomain.example
// @version      3.0
// @description  Dynamically load custom CSS for ChatGPT and Claude AI via jsDelivr CDN
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function() {
'use strict';

// 🎯 Configuration
const CONFIG = {
    DEBUG_MODE: true,
    RETRY_DELAY: 300,
    MAX_RETRIES: 20,
    OBSERVER_THROTTLE: 500,
    CACHE_DURATION: 12 * 60 * 60 * 1000, // 12 hours
    CACHE_KEY_PREFIX: 'css_cache_v3_',
    BERRY_INITIAL_DELAY: 4000, // Increased for Berry Browser
    CHATGPT_READY_CHECK_INTERVAL: 200,
    CHATGPT_MAX_READY_CHECKS: 30,
    JSDELIVR_REFRESH_INTERVAL: 3600000, // 1 hour for CDN refresh
    MAX_CSS_SIZE: 100000 // 100KB max CSS size
};

// 🎨 Site configuration with jsDelivr URLs
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        // Primary: jsDelivr CDN URL
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/ChatGpt_style.css',
        // Fallback: GitHub raw URL
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/ChatGpt_style.css',
        
        styleID: 'chatgpt-enhanced-styles',
        enabledKey: 'chatgpt_styles_enabled',
        needsReadyCheck: true,
        readySelector: 'main, [class*="conversation"], #__next',
        aggressiveReapply: true,
        cdnType: 'jsdelivr',
        version: 'v3.0'
    },
    'claude.ai': {
        name: 'Claude AI',
        // Primary: jsDelivr CDN URL
        styleURL: 'https://cdn.jsdelivr.net/gh/yfjuu4/ai-chat-styles@main/Claude_AI_style.css',
        // Fallback: GitHub raw URL
        fallbackURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/main/Claude_AI_style.css',
        
        styleID: 'claude-enhanced-styles',
        enabledKey: 'claude_styles_enabled',
        needsReadyCheck: false,
        readySelector: 'body',
        aggressiveReapply: false,
        cdnType: 'jsdelivr',
        version: 'v3.0'
    }
};

// 🏗️ Detect current site
const currentDomain = window.location.hostname;
const currentSite = SITES[currentDomain] || null;

if (!currentSite) {
    console.log('AI Chat Styler: No configuration found for this domain');
    return;
}

// 📊 State management
const state = {
    site: currentSite,
    styleElement: null,
    observer: null,
    retryCount: 0,
    menuCommandId: null,
    currentURL: location.href,
    isLoading: false,
    hasGrants: false,
    isBerryBrowser: false,
    isReady: false,
    cssContent: null,
    appliedMethod: null,
    lastApplyTime: 0,
    lastCDNCheck: 0,
    cdnStatus: 'unknown',
    fetchAttempts: 0
};

// 🔍 Enhanced browser detection
(function detectCapabilities() {
    state.hasGrants = typeof GM_xmlhttpRequest !== 'undefined';

    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|mobile/i.test(userAgent);
    const isChromiumBased = /chrome|chromium/i.test(userAgent);
    const isBerry = /berry/i.test(userAgent) || !state.hasGrants && isMobile && isChromiumBased;

    state.isBerryBrowser = isBerry;

    if (state.isBerryBrowser) {
        console.log('🍓 Berry Browser detected - using jsDelivr optimized methods');
        console.log('🍓 User Agent:', navigator.userAgent);
        CONFIG.DEBUG_MODE = true; // Force debug mode in Berry
        state.enhancedDebug = true;
    }
})();

// 🛠️ Utility functions
const utils = {
    log(message, level = 'info') {
        if (!CONFIG.DEBUG_MODE && level === 'debug') return;
    
        const emoji = {
            'info': 'ℹ️',
            'success': '✅',
            'error': '❌',
            'debug': '🔍',
            'warning': '⚠️',
            'cdn': '📡',
            'berry': '🍓',
            'cache': '💾'
        }[level] || 'ℹ️';
    
        const prefix = `${emoji} [${currentSite.name}]`;
        const finalPrefix = state.isBerryBrowser ? `🍓 ${prefix}` : prefix;
        
        console.log(`${finalPrefix} ${message}`);
        
        // Log errors to localStorage for debugging
        if (level === 'error' && state.isBerryBrowser) {
            this.safeCall(() => {
                const errorLog = {
                    timestamp: Date.now(),
                    site: currentSite.name,
                    message: message,
                    url: location.href,
                    userAgent: navigator.userAgent.substring(0, 100),
                    state: {
                        hasGrants: state.hasGrants,
                        isLoading: state.isLoading,
                        fetchAttempts: state.fetchAttempts
                    }
                };
                
                const logKey = `ai_styler_error_${Date.now()}`;
                localStorage.setItem(logKey, JSON.stringify(errorLog));
                
                // Keep only last 10 errors
                const keys = Object.keys(localStorage).filter(k => k.startsWith('ai_styler_error_'));
                if (keys.length > 10) {
                    keys.sort().slice(0, keys.length - 10).forEach(k => localStorage.removeItem(k));
                }
            });
        }
    },

    throttle(func, delay) {
        let timeoutId;
        let lastExecTime = 0;

        return function(...args) {
            const context = this;
            const currentTime = Date.now();

            const execute = function() {
                lastExecTime = currentTime;
                func.apply(context, args);
            };

            clearTimeout(timeoutId);

            if (currentTime - lastExecTime > delay) {
                execute();
            } else {
                timeoutId = setTimeout(execute, delay - (currentTime - lastExecTime));
            }
        };
    },

    safeCall(fn, fallback = null) {
        try {
            return fn();
        } catch (e) {
            this.log(`Error in safeCall: ${e.message}`, 'debug');
            return fallback;
        }
    },

    getValue(key, defaultValue) {
        return this.safeCall(() => {
            if (typeof GM_getValue !== 'undefined') {
                return GM_getValue(key, defaultValue);
            }
            try {
                const item = localStorage.getItem(key);
                return item !== null ? JSON.parse(item) : defaultValue;
            } catch (e) {
                return defaultValue;
            }
        }, defaultValue);
    },

    setValue(key, value) {
        return this.safeCall(() => {
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue(key, value);
                return true;
            }
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                return false;
            }
        }, false);
    },

    getCurrentSiteEnabled() {
        return this.getValue(state.site.enabledKey, true);
    },

    setCurrentSiteEnabled(enabled) {
        return this.setValue(state.site.enabledKey, enabled);
    },

    getCachedCSS() {
        const cacheKey = CONFIG.CACHE_KEY_PREFIX + state.site.name;
        const cacheData = this.getValue(cacheKey, null);
    
        if (!cacheData) return null;
    
        const { css, timestamp, url, version } = cacheData;
        const now = Date.now();
    
        // Check if cache is for current URL
        if (url !== state.site.styleURL) {
            this.log('CSS URL changed, invalidating cache', 'warning');
            return null;
        }
    
        // Check if cache is expired
        if (now - timestamp > CONFIG.CACHE_DURATION) {
            this.log('Cache expired', 'debug');
            return null;
        }
    
        // Check version mismatch
        if (version !== state.site.version) {
            this.log('Version mismatch, invalidating cache', 'debug');
            return null;
        }
    
        this.log(`Using cached CSS (${Math.round((now - timestamp)/60000)}min old)`, 'cache');
        return css;
    },

    setCachedCSS(css) {
        const cacheKey = CONFIG.CACHE_KEY_PREFIX + state.site.name;
        const cacheData = {
            css: css,
            timestamp: Date.now(),
            url: state.site.styleURL,
            version: state.site.version,
            size: css.length
        };
        return this.setValue(cacheKey, cacheData);
    },

    clearCache() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(CONFIG.CACHE_KEY_PREFIX));
        keys.forEach(k => localStorage.removeItem(k));
        this.log('Cache cleared', 'success');
        return keys.length;
    },

    async waitForElement(selector, timeout = 10000) {
        const startTime = Date.now();
    
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    
        this.log(`Timeout waiting for: ${selector}`, 'warning');
        return null;
    },

    async waitForPageReady() {
        if (!state.site.needsReadyCheck) {
            return true;
        }

        this.log('Waiting for page to be ready...', 'debug');
    
        const element = await this.waitForElement(state.site.readySelector, 10000);
    
        if (element) {
            this.log('Page is ready', 'success');
        
            // Extra delay for Berry Browser
            if (state.isBerryBrowser && currentDomain === 'chatgpt.com') {
                this.log('Applying ChatGPT Berry Browser delay...', 'debug');
                await new Promise(resolve => setTimeout(resolve, CONFIG.BERRY_INITIAL_DELAY));
            }
        
            return true;
        }
    
        this.log('Page ready check timed out, continuing anyway', 'warning');
        return false;
    },

    // New: Test CDN connectivity
    async testCDNConnectivity() {
        const testURL = state.site.styleURL;
        this.log(`Testing CDN connectivity: ${testURL}`, 'cdn');
        
        try {
            const startTime = Date.now();
            const response = await fetch(testURL, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store'
            });
            const latency = Date.now() - startTime;
            
            state.cdnStatus = 'available';
            this.log(`CDN latency: ${latency}ms`, 'cdn');
            return true;
        } catch (error) {
            state.cdnStatus = 'unavailable';
            this.log(`CDN test failed: ${error.message}`, 'error');
            return false;
        }
    }
};

// 📥 Enhanced CSS loader - jsDelivr Optimized
const cssLoader = {
    async fetchExternalCSS() {
        state.fetchAttempts++;
        
        // 1. Check cache first
        const cachedCSS = utils.getCachedCSS();
        if (cachedCSS) {
            state.cssContent = cachedCSS;
            return cachedCSS;
        }

        utils.log(`Fetch attempt #${state.fetchAttempts} for ${state.site.name}`, 'info');
        utils.log(`Primary CDN: ${state.site.styleURL}`, 'cdn');
        if (state.site.fallbackURL) {
            utils.log(`Fallback: ${state.site.fallbackURL}`, 'debug');
        }

        // 2. Try GM_xmlhttpRequest first (Tampermonkey/Violentmonkey)
        if (state.hasGrants && typeof GM_xmlhttpRequest !== 'undefined') {
            try {
                const css = await this.fetchViaGM();
                utils.setCachedCSS(css);
                state.cssContent = css;
                state.cdnStatus = 'jsdelivr_via_gm';
                return css;
            } catch (error) {
                utils.log(`GM fetch failed: ${error.message}`, 'error');
            }
        }

        // 3. BERRY BROWSER OPTIMIZED PATH
        if (state.isBerryBrowser) {
            utils.log('Berry Browser detected - using optimized fetch strategy', 'berry');
            try {
                const css = await this.fetchForBerryBrowser();
                utils.setCachedCSS(css);
                state.cssContent = css;
                return css;
            } catch (berryError) {
                utils.log(`Berry optimized fetch failed: ${berryError.message}`, 'error');
                // Continue to fallback methods
            }
        }

        // 4. STANDARD BROWSERS: Direct fetch from jsDelivr
        try {
            const css = await this.fetchDirect();
            utils.setCachedCSS(css);
            state.cssContent = css;
            state.cdnStatus = 'jsdelivr_direct';
            return css;
        } catch (directError) {
            utils.log(`Direct jsDelivr fetch failed: ${directError.message}`, 'debug');
            
            // 5. FALLBACK 1: GitHub raw URL
            if (state.site.fallbackURL) {
                utils.log('Trying GitHub fallback URL...', 'debug');
                try {
                    const css = await this.fetchGitHubFallback();
                    utils.setCachedCSS(css);
                    state.cssContent = css;
                    state.cdnStatus = 'github_fallback';
                    return css;
                } catch (githubError) {
                    utils.log(`GitHub fallback failed: ${githubError.message}`, 'debug');
                }
            }
            
            // 6. FALLBACK 2: CORS proxy as last resort
            try {
                const css = await this.fetchViaCORSProxy();
                utils.setCachedCSS(css);
                state.cssContent = css;
                state.cdnStatus = 'cors_proxy';
                return css;
            } catch (proxyError) {
                utils.log(`All fetch methods exhausted`, 'error');
                throw new Error(`Could not fetch CSS from any source`);
            }
        }
    },

    // Method 1: GM_xmlhttpRequest
    fetchViaGM() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: state.site.styleURL,
                timeout: 15000,
                headers: {
                    'Accept': 'text/css,*/*',
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'Mozilla/5.0 (compatible; UserScript/3.0; +https://github.com/yfjuu4)'
                },
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        const css = response.responseText;
                        if (css && css.trim().length > 0) {
                            if (css.length > CONFIG.MAX_CSS_SIZE) {
                                utils.log(`CSS file very large: ${css.length} bytes`, 'warning');
                            }
                            utils.log(`Fetched ${css.length} chars via GM from jsDelivr`, 'success');
                            resolve(css);
                        } else {
                            reject(new Error('Empty response from jsDelivr'));
                        }
                    } else {
                        reject(new Error(`jsDelivr HTTP ${response.status}`));
                    }
                },
                onerror: () => reject(new Error('Network error with jsDelivr')),
                ontimeout: () => reject(new Error('jsDelivr request timeout'))
            });
        });
    },

    // Method 2: Standard direct fetch
    async fetchDirect() {
        utils.log(`Direct fetch from jsDelivr`, 'cdn');
        
        const startTime = Date.now();
        const response = await fetch(state.site.styleURL, {
            method: 'GET',
            headers: {
                'Accept': 'text/css,*/*',
                'User-Agent': 'Mozilla/5.0 (compatible; UserScript/3.0)'
            },
            mode: 'cors',
            cache: 'no-store',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        });
        
        const fetchTime = Date.now() - startTime;
        
        if (!response.ok) {
            throw new Error(`jsDelivr HTTP ${response.status}: ${response.statusText}`);
        }
        
        const css = await response.text();
        
        if (!css || css.trim().length === 0) {
            throw new Error('Empty CSS response from jsDelivr');
        }
        
        utils.log(`Fetched ${css.length} chars from jsDelivr in ${fetchTime}ms`, 'success');
        return css;
    },

    // Method 3: Berry Browser optimized fetch
    async fetchForBerryBrowser() {
        utils.log('Berry: Starting jsDelivr optimized fetch...', 'berry');
        state.cdnStatus = 'berry_optimized';
        
        const strategies = [
            { name: 'cors-mode', mode: 'cors', cache: 'reload' },
            { name: 'no-cors-mode', mode: 'no-cors', cache: 'reload' },
            { name: 'cors-no-cache', mode: 'cors', cache: 'no-cache' },
            { name: 'no-cors-no-cache', mode: 'no-cors', cache: 'no-cache' }
        ];
        
        // Try each strategy
        for (const strategy of strategies) {
            utils.log(`Berry: Trying ${strategy.name}...`, 'debug');
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(state.site.styleURL, {
                    method: 'GET',
                    headers: { 'Accept': 'text/css,*/*' },
                    mode: strategy.mode,
                    cache: strategy.cache,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                // With 'no-cors' we can't check status, but can try to get text
                const css = await response.text();
                
                if (css && css.trim().length > 10) {
                    utils.log(`Berry (${strategy.name}): Got ${css.length} chars`, 'success');
                    return css;
                }
            } catch (error) {
                utils.log(`Berry (${strategy.name}) failed: ${error.message}`, 'debug');
                continue;
            }
        }
        
        // If jsDelivr fails, try GitHub fallback
        if (state.site.fallbackURL) {
            utils.log('Berry: Trying GitHub fallback...', 'berry');
            
            try {
                const response = await fetch(state.site.fallbackURL, {
                    method: 'GET',
                    mode: 'no-cors',
                    cache: 'reload'
                });
                
                const css = await response.text();
                if (css && css.trim().length > 10) {
                    utils.log(`Berry: Got ${css.length} chars from GitHub fallback`, 'success');
                    state.cdnStatus = 'github_fallback_berry';
                    return css;
                }
            } catch (githubError) {
                utils.log(`Berry GitHub fallback failed: ${githubError.message}`, 'debug');
            }
        }
        
        throw new Error('Berry Browser: All fetch methods failed');
    },

    // Method 4: GitHub fallback
    async fetchGitHubFallback() {
        if (!state.site.fallbackURL) {
            throw new Error('No fallback URL configured');
        }
        
        utils.log(`Trying GitHub fallback`, 'debug');
        
        const response = await fetch(state.site.fallbackURL, {
            method: 'GET',
            headers: { 'Accept': 'text/css,*/*' },
            mode: 'cors',
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`GitHub HTTP ${response.status}`);
        }
        
        const css = await response.text();
        
        if (!css || css.trim().length === 0) {
            throw new Error('Empty CSS from GitHub');
        }
        
        utils.log(`Fetched ${css.length} chars from GitHub fallback`, 'success');
        return css;
    },

    // Method 5: CORS proxy
    async fetchViaCORSProxy() {
        utils.log('Trying CORS proxies...', 'debug');
        
        // Try jsDelivr URLs first
        const primaryProxies = [
            `https://corsproxy.io/?${encodeURIComponent(state.site.styleURL)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(state.site.styleURL)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(state.site.styleURL)}`,
            state.site.styleURL // Direct as last attempt
        ];
        
        for (let i = 0; i < primaryProxies.length; i++) {
            const proxyUrl = primaryProxies[i];
            try {
                utils.log(`Proxy ${i + 1}/${primaryProxies.length} for jsDelivr`, 'debug');
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: { 'Accept': 'text/css,*/*' },
                    signal: controller.signal,
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const css = await response.text();
                
                if (css && css.trim().length > 0) {
                    utils.log(`Fetched ${css.length} chars via proxy (jsDelivr)`, 'success');
                    return css;
                }
            } catch (error) {
                utils.log(`Proxy ${i + 1} failed: ${error.message}`, 'debug');
                continue;
            }
        }
        
        // If jsDelivr proxies fail, try GitHub URL through proxies
        if (state.site.fallbackURL) {
            utils.log('Trying GitHub through proxies...', 'debug');
            
            const fallbackProxies = [
                `https://corsproxy.io/?${encodeURIComponent(state.site.fallbackURL)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(state.site.fallbackURL)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(state.site.fallbackURL)}`
            ];
            
            for (let i = 0; i < fallbackProxies.length; i++) {
                const proxyUrl = fallbackProxies[i];
                try {
                    utils.log(`GitHub Proxy ${i + 1}/${fallbackProxies.length}`, 'debug');
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);
                    
                    const response = await fetch(proxyUrl, {
                        method: 'GET',
                        headers: { 'Accept': 'text/css,*/*' },
                        signal: controller.signal,
                        mode: 'cors',
                        cache: 'no-cache'
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const css = await response.text();
                    
                    if (css && css.trim().length > 0) {
                        utils.log(`Fetched ${css.length} chars via proxy (GitHub)`, 'success');
                        return css;
                    }
                } catch (error) {
                    utils.log(`GitHub Proxy ${i + 1} failed: ${error.message}`, 'debug');
                    if (i === fallbackProxies.length - 1) {
                        throw error;
                    }
                    continue;
                }
            }
        }
        
        throw new Error('All CORS proxies failed');
    }
};

// 🎨 Style manager (unchanged from your working version)
const styleManager = {
    async apply() {
        if (!utils.getCurrentSiteEnabled() || state.isLoading) {
            return false;
        }

        const now = Date.now();
        if (now - state.lastApplyTime < 500) {
            utils.log('Throttling apply attempt', 'debug');
            return false;
        }
        state.lastApplyTime = now;

        this.remove();
        state.isLoading = true;

        try {
            await utils.waitForPageReady();
        
            if (!state.cssContent) {
                utils.log('Fetching CSS...', 'info');
                await cssLoader.fetchExternalCSS();
            }

            if (!state.cssContent || state.cssContent.trim().length === 0) {
                throw new Error('No CSS content available');
            }

            const methods = [
                { name: 'blob-link', fn: () => this.injectViaBlob() },
                { name: 'style-element', fn: () => this.injectViaStyle() },
                { name: 'external-link', fn: () => this.injectViaExternalLink() }
            ];

            for (const method of methods) {
                try {
                    utils.log(`Trying ${method.name}...`, 'debug');
                    if (await method.fn()) {
                        state.appliedMethod = method.name;
                        utils.log(`✅ Styles applied via ${method.name}`, 'success');
                        state.isLoading = false;
                        return true;
                    }
                } catch (error) {
                    utils.log(`${method.name} failed: ${error.message}`, 'debug');
                }
            }
        
            throw new Error('All injection methods failed');
        
        } catch (error) {
            utils.log(`Failed to apply styles: ${error.message}`, 'error');
            state.isLoading = false;
            return false;
        }
    },

    async injectViaBlob() {
        if (!document.head) return false;
    
        const blob = new Blob([state.cssContent], { type: 'text/css' });
        const blobUrl = URL.createObjectURL(blob);
    
        const link = document.createElement('link');
        link.id = state.site.styleID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = blobUrl;
        link.setAttribute('data-method', 'blob');
        link.setAttribute('data-cdn', state.cdnStatus);
    
        return new Promise((resolve) => {
            link.onload = () => {
                state.styleElement = link;
                resolve(true);
            };
        
            link.onerror = () => {
                link.remove();
                URL.revokeObjectURL(blobUrl);
                resolve(false);
            };
        
            document.head.appendChild(link);
        
            setTimeout(() => {
                if (link.sheet) {
                    state.styleElement = link;
                    resolve(true);
                } else {
                    resolve(false);
                }
            }, 1000);
        });
    },

    injectViaStyle() {
        if (!document.head) return false;
    
        const style = document.createElement('style');
        style.id = state.site.styleID;
        style.type = 'text/css';
        style.textContent = state.cssContent;
        style.setAttribute('data-method', 'inline');
        style.setAttribute('data-cdn', state.cdnStatus);
    
        try {
            document.head.appendChild(style);
            state.styleElement = style;
            return true;
        } catch (error) {
            style.remove();
            return false;
        }
    },

    async injectViaExternalLink() {
        if (!document.head) return false;
    
        const link = document.createElement('link');
        link.id = state.site.styleID;
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = state.site.styleURL;
        link.setAttribute('data-method', 'external');
        link.setAttribute('data-cdn', 'jsdelivr_direct');
        link.setAttribute('crossorigin', 'anonymous');
    
        return new Promise((resolve) => {
            link.onload = () => {
                state.styleElement = link;
                resolve(true);
            };
        
            link.onerror = () => {
                link.remove();
                resolve(false);
            };
        
            document.head.appendChild(link);
        
            setTimeout(() => resolve(false), 3000);
        });
    },

    remove() {
        const existingStyle = document.getElementById(state.site.styleID);
        if (existingStyle) {
            if (existingStyle.tagName === 'LINK' && existingStyle.href.startsWith('blob:')) {
                URL.revokeObjectURL(existingStyle.href);
            }
            existingStyle.remove();
        }
    
        const orphans = document.querySelectorAll(`[data-method]`);
        orphans.forEach(el => {
            if (el.id === state.site.styleID || el.getAttribute('data-site') === currentDomain) {
                el.remove();
            }
        });
    
        state.styleElement = null;
        utils.log('Styles removed', 'debug');
    },

    isApplied() {
        return !!document.getElementById(state.site.styleID);
    },

    async forceReapply() {
        if (utils.getCurrentSiteEnabled() && !this.isApplied()) {
            utils.log('Force reapplying styles', 'debug');
            await this.apply();
        }
    }
};

// 👁️ Observer manager (unchanged from your working version)
const observerManager = {
    setup() {
        this.cleanup();
        if (!utils.getCurrentSiteEnabled()) return;

        if (state.site.aggressiveReapply || state.isBerryBrowser) {
            this.createAggressiveObserver();
        } else {
            this.createStandardObserver();
        }
    
        utils.log('Observer started', 'debug');
    },

    createStandardObserver() {
        const throttledReapply = utils.throttle(() => {
            styleManager.forceReapply();
        }, CONFIG.OBSERVER_THROTTLE);

        state.observer = new MutationObserver(mutations => {
            let shouldReapply = false;

            for (const mutation of mutations) {
                if (mutation.removedNodes.length > 0) {
                    for (const node of mutation.removedNodes) {
                        if (node.id === state.site.styleID) {
                            shouldReapply = true;
                            break;
                        }
                    }
                }
            }

            if (shouldReapply) {
                throttledReapply();
            }
        });

        state.observer.observe(document.head, {
            childList: true,
            subtree: false
        });
    },

    createAggressiveObserver() {
        let checkCount = 0;
        const maxChecks = 100;
    
        const checkAndReapply = async () => {
            if (checkCount++ > maxChecks) {
                clearInterval(intervalId);
                utils.log('Aggressive observer stopped after max checks', 'debug');
                return;
            }
        
            if (!styleManager.isApplied() && utils.getCurrentSiteEnabled()) {
                utils.log('Style missing, reapplying...', 'debug');
                await styleManager.forceReapply();
            }
        };
    
        const intervalId = setInterval(checkAndReapply, 2000);
    
        state.observer = {
            disconnect: () => clearInterval(intervalId)
        };
    },

    cleanup() {
        if (state.observer) {
            if (state.observer.disconnect) {
                state.observer.disconnect();
            }
            state.observer = null;
        }
        utils.log('Observer cleaned up', 'debug');
    }
};

// 📱 Menu manager with enhanced debug features
const menuManager = {
    setup() {
        if (typeof GM_registerMenuCommand !== 'undefined') {
            this.createMenuCommands();
        } else {
            this.createFloatingButton();
        }
    },

    createMenuCommands() {
        this.updateToggleCommand();
        
        // Add debug command in Berry Browser
        if (state.isBerryBrowser && typeof GM_registerMenuCommand !== 'undefined') {
            GM_registerMenuCommand('🐛 Debug Info', () => this.showDebugInfo());
            GM_registerMenuCommand('🗑️ Clear Cache', () => this.clearCache());
        }
    },

    createFloatingButton() {
        const button = document.createElement('div');
        button.id = 'ai-styler-btn';
        button.style.cssText = `
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
            z-index: 999999;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
        `;
    
        this.updateButtonState(button);
    
        // Click: Toggle styles
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this.toggleCurrentSiteStyles();
        });
    
        // Long press: Show debug info (Berry Browser)
        if (state.isBerryBrowser) {
            let longPressTimer;
            button.addEventListener('touchstart', (e) => {
                longPressTimer = setTimeout(() => {
                    this.showDebugInfo();
                    this.showToast('Debug info logged to console');
                }, 1500);
            });
            
            button.addEventListener('touchend', () => {
                clearTimeout(longPressTimer);
            });
            
            button.addEventListener('touchcancel', () => {
                clearTimeout(longPressTimer);
            });
        }
    
        const addButton = () => {
            if (document.body) {
                document.body.appendChild(button);
            } else {
                setTimeout(addButton, 100);
            }
        };
        addButton();
    },

    updateButtonState(button) {
        if (!button) button = document.getElementById('ai-styler-btn');
        if (!button) return;
    
        const isEnabled = utils.getCurrentSiteEnabled();
        button.innerHTML = isEnabled ? '🎨' : '🚫';
        button.style.opacity = isEnabled ? '1' : '0.6';
        button.title = `${state.site.name}: ${isEnabled ? 'ON' : 'OFF'} | CDN: ${state.cdnStatus}`;
        
        // Berry Browser: Add pulse animation when loading
        if (state.isLoading) {
            button.style.animation = 'pulse 1.5s infinite';
        } else {
            button.style.animation = 'none';
        }
    },

    updateToggleCommand() {
        utils.safeCall(() => {
            if (state.menuCommandId && typeof GM_unregisterMenuCommand !== 'undefined') {
                GM_unregisterMenuCommand(state.menuCommandId);
            }

            const isEnabled = utils.getCurrentSiteEnabled();
            const text = `${isEnabled ? '✅' : '❌'} ${state.site.name} Styles (CDN: ${state.cdnStatus})`;
        
            state.menuCommandId = GM_registerMenuCommand(text, () => {
                this.toggleCurrentSiteStyles();
            });
        });
    },

    toggleCurrentSiteStyles() {
        const newEnabled = !utils.getCurrentSiteEnabled();
        utils.setCurrentSiteEnabled(newEnabled);

        if (newEnabled) {
            styleManager.apply();
            observerManager.setup();
        } else {
            styleManager.remove();
            observerManager.cleanup();
        }

        this.updateButtonState();
        this.updateToggleCommand();
        this.showToast(`${state.site.name}: ${newEnabled ? 'ON' : 'OFF'} | CDN: ${state.cdnStatus}`);
    },

    showDebugInfo() {
        const info = `
🍓 Berry Browser Debug Info:
============================
Site: ${state.site.name}
URL: ${window.location.href}
CDN Status: ${state.cdnStatus}
CDN URL: ${state.site.styleURL}
Fallback URL: ${state.site.fallbackURL}
Has Grants: ${state.hasGrants}
Is Loading: ${state.isLoading}
Fetch Attempts: ${state.fetchAttempts}
CSS Content Length: ${state.cssContent ? state.cssContent.length : 'None'}
Applied Method: ${state.appliedMethod || 'None'}
Style Applied: ${styleManager.isApplied()}
Cache Size: ${localStorage.getItem(CONFIG.CACHE_KEY_PREFIX + state.site.name) ? 'Cached' : 'None'}
User Agent: ${navigator.userAgent}
============================
        `.trim();
        
        console.log(info);
        
        // Also show in toast
        this.showToast(`Debug info logged to console`);
    },

    clearCache() {
        const cleared = utils.clearCache();
        this.showToast(`Cleared ${cleared} cache entries`);
        
        // Force reload CSS
        if (utils.getCurrentSiteEnabled()) {
            state.cssContent = null;
            setTimeout(() => styleManager.forceReapply(), 500);
        }
    },

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 999998;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
    
        toast.textContent = message;
    
        const addToast = () => {
            if (document.body) {
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(10px)';
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            } else {
                setTimeout(addToast, 100);
            }
        };
        addToast();
    }
};

// 🧭 Navigation manager (unchanged from your working version)
const navigationManager = {
    init() {
        if (!state.isBerryBrowser) {
            this.overrideHistoryMethods();
        }
    
        window.addEventListener('popstate', this.handleURLChange);
        window.addEventListener('hashchange', this.handleURLChange);
    },

    overrideHistoryMethods() {
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
            originalPushState.apply(this, args);
            navigationManager.handleURLChange();
        };

        history.replaceState = function(...args) {
            originalReplaceState.apply(this, args);
            navigationManager.handleURLChange();
        };
    },

    handleURLChange: utils.throttle(() => {
        if (location.href !== state.currentURL) {
            state.currentURL = location.href;
            utils.log(`URL changed: ${state.currentURL}`, 'debug');
        
            if (utils.getCurrentSiteEnabled()) {
                setTimeout(() => styleManager.forceReapply(), 300);
            }
        }
    }, 500)
};

// 🚀 Main application
const app = {
    async init() {
        utils.log(`🚀 Initializing ${state.site.name} Styler v3.0 (jsDelivr)`, 'info');
        utils.log(`Mode: ${state.isBerryBrowser ? '🍓 Berry Browser' : 'Standard Browser'}`, 'info');
        utils.log(`CDN Provider: ${state.site.cdnType}`, 'cdn');
    
        // Initial delay - longer for Berry Browser
        const initialDelay = state.isBerryBrowser ? 2000 : 500;
    
        setTimeout(async () => {
            // Test CDN connectivity (non-blocking)
            if (state.isBerryBrowser) {
                utils.testCDNConnectivity().then(available => {
                    if (!available) {
                        utils.log('CDN may be unavailable, will use fallbacks', 'warning');
                    }
                });
            }
        
            await this.applyWithRetry();
            observerManager.setup();
            menuManager.setup();
            navigationManager.init();
            this.setupEventListeners();
        
            const status = utils.getCurrentSiteEnabled() ? 'ENABLED ✅' : 'DISABLED ❌';
            utils.log(`Initialization complete. Status: ${status}`, 'success');
            
            // Berry Browser: Log final state
            if (state.isBerryBrowser) {
                setTimeout(() => {
                    utils.log(`Final State - CSS: ${state.cssContent ? state.cssContent.length + ' chars' : 'None'}, Method: ${state.appliedMethod || 'None'}`, 'berry');
                }, 1000);
            }
        }, initialDelay);
    },

    async applyWithRetry() {
        if (!utils.getCurrentSiteEnabled()) return;

        for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
            try {
                utils.log(`Apply attempt ${attempt}/${CONFIG.MAX_RETRIES}`, 'debug');
            
                if (await styleManager.apply()) {
                    utils.log('Styles successfully applied!', 'success');
                    
                    // Update button with CDN info
                    menuManager.updateButtonState();
                    menuManager.updateToggleCommand();
                    
                    return;
                }
            } catch (error) {
                utils.log(`Attempt ${attempt} error: ${error.message}`, 'error');
            }

            if (attempt < CONFIG.MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            }
        }
    
        utils.log('Max retries reached - styles may not be applied', 'warning');
        
        // Berry Browser: Offer manual refresh
        if (state.isBerryBrowser && !styleManager.isApplied()) {
            setTimeout(() => {
                menuManager.showToast('CSS failed to load. Long-press button for debug.');
            }, 1000);
        }
    },

    setupEventListeners() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && utils.getCurrentSiteEnabled()) {
                setTimeout(() => styleManager.forceReapply(), 200);
            }
        });

        window.addEventListener('focus', () => {
            if (utils.getCurrentSiteEnabled()) {
                setTimeout(() => styleManager.forceReapply(), 200);
            }
        });

        window.addEventListener('beforeunload', () => {
            observerManager.cleanup();
        });
        
        // Add CSS for pulse animation
        this.addPulseAnimation();
    },

    addPulseAnimation() {
        if (!document.head) return;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
                50% { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,0.4); }
                100% { transform: scale(1); box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
            }
            @keyframes slideIn {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
};

// 🏁 Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

// Berry Browser: Add global error handler
if (state.isBerryBrowser) {
    window.addEventListener('error', (event) => {
        if (event.message && event.message.includes('fetch') || event.message.includes('CSS')) {
            utils.log(`Global error: ${event.message}`, 'error');
        }
    });
}

})();
