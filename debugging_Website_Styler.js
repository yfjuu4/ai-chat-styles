// ==UserScript==
// @name         Berry Browser CSS Loader Diagnostic
// @namespace    http://yourdomain.example
// @version      3.0-diagnostic
// @description  Comprehensive diagnostics for CSS loading issues
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
'use strict';

// Visual Debug Overlay
class DebugOverlay {
    constructor() {
        this.logs = [];
        this.maxLogs = 50;
        this.overlay = null;
        this.logContainer = null;
        this.createOverlay();
    }

    createOverlay() {
        // Wait for body to be available
        const initOverlay = () => {
            if (!document.body) {
                setTimeout(initOverlay, 100);
                return;
            }

            this.overlay = document.createElement('div');
            this.overlay.id = 'berry-debug-overlay';
            this.overlay.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                width: 95%;
                max-width: 600px;
                max-height: 400px;
                background: rgba(0, 0, 0, 0.95);
                color: #00ff00;
                font-family: 'Courier New', monospace;
                font-size: 11px;
                z-index: 2147483647;
                border: 2px solid #00ff00;
                border-radius: 8px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            `;

            // Header
            const header = document.createElement('div');
            header.style.cssText = `
                background: #1a1a1a;
                padding: 8px;
                border-bottom: 1px solid #00ff00;
                display: flex;
                justify-content: space-between;
                align-items: center;
                user-select: none;
            `;
            
            const title = document.createElement('span');
            title.textContent = `🍓 Berry Debug: ${window.location.hostname}`;
            title.style.fontWeight = 'bold';
            
            const controls = document.createElement('div');
            controls.style.cssText = 'display: flex; gap: 8px;';
            
            const minimizeBtn = document.createElement('button');
            minimizeBtn.textContent = '−';
            minimizeBtn.style.cssText = `
                background: #333;
                color: #00ff00;
                border: 1px solid #00ff00;
                padding: 2px 8px;
                cursor: pointer;
                border-radius: 4px;
            `;
            minimizeBtn.onclick = () => this.toggleMinimize();
            
            const clearBtn = document.createElement('button');
            clearBtn.textContent = '🗑️';
            clearBtn.style.cssText = minimizeBtn.style.cssText;
            clearBtn.onclick = () => this.clear();
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = minimizeBtn.style.cssText;
            closeBtn.onclick = () => this.overlay.style.display = 'none';
            
            controls.appendChild(minimizeBtn);
            controls.appendChild(clearBtn);
            controls.appendChild(closeBtn);
            
            header.appendChild(title);
            header.appendChild(controls);

            // Log container
            this.logContainer = document.createElement('div');
            this.logContainer.style.cssText = `
                flex: 1;
                overflow-y: auto;
                padding: 8px;
                line-height: 1.4;
            `;

            this.overlay.appendChild(header);
            this.overlay.appendChild(this.logContainer);
            document.body.appendChild(this.overlay);

            // Re-render existing logs
            this.render();
        };

        initOverlay();
    }

    toggleMinimize() {
        if (this.logContainer.style.display === 'none') {
            this.logContainer.style.display = 'block';
        } else {
            this.logContainer.style.display = 'none';
        }
    }

    clear() {
        this.logs = [];
        this.render();
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const colors = {
            'info': '#00ff00',
            'success': '#00ffff',
            'error': '#ff0000',
            'warning': '#ffff00',
            'debug': '#888888',
            'fetch': '#ff00ff'
        };

        const entry = {
            timestamp,
            message,
            level,
            color: colors[level] || '#00ff00'
        };

        this.logs.push(entry);
        
        // Keep only last N logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Also log to console
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);

        this.render();
    }

    render() {
        if (!this.logContainer) return;

        this.logContainer.innerHTML = this.logs.map(entry => 
            `<div style="color: ${entry.color}; margin-bottom: 4px;">
                <span style="color: #666;">[${entry.timestamp}]</span> 
                <span style="color: #999;">[${entry.level.toUpperCase()}]</span> 
                ${this.escapeHtml(entry.message)}
            </div>`
        ).join('');

        // Auto-scroll to bottom
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize debug overlay
const debugLog = new DebugOverlay();

// Configuration
const SITES = {
    'chatgpt.com': {
        name: 'ChatGPT',
        cssURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/ChatGpt_style.css',
        styleID: 'chatgpt-diagnostic-styles'
    },
    'claude.ai': {
        name: 'Claude AI',
        cssURL: 'https://raw.githubusercontent.com/yfjuu4/ai-chat-styles/refs/heads/main/Claude_AI_style.css',
        styleID: 'claude-diagnostic-styles'
    }
};

const currentSite = SITES[window.location.hostname];

if (!currentSite) {
    debugLog.log('Unknown site: ' + window.location.hostname, 'warning');
}

debugLog.log(`🚀 Diagnostic script loaded for ${currentSite?.name || 'Unknown Site'}`, 'info');
debugLog.log(`User Agent: ${navigator.userAgent}`, 'debug');
debugLog.log(`URL: ${window.location.href}`, 'debug');

// Intercept and log all fetch calls
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
    debugLog.log(`FETCH INTERCEPTED: ${url}`, 'fetch');
    
    const startTime = Date.now();
    
    return originalFetch.apply(this, args)
        .then(response => {
            const duration = Date.now() - startTime;
            debugLog.log(`FETCH SUCCESS: ${url} (${response.status}) [${duration}ms]`, 'success');
            
            // Clone the response to read it
            const clonedResponse = response.clone();
            
            // Log response details for CSS files
            if (url.includes('.css') || url.includes('githubusercontent')) {
                response.text().then(text => {
                    debugLog.log(`RESPONSE LENGTH: ${text.length} chars`, 'debug');
                    debugLog.log(`RESPONSE PREVIEW: ${text.substring(0, 100)}...`, 'debug');
                }).catch(err => {
                    debugLog.log(`Could not read response: ${err.message}`, 'error');
                });
            }
            
            return clonedResponse;
        })
        .catch(error => {
            const duration = Date.now() - startTime;
            debugLog.log(`FETCH FAILED: ${url} - ${error.message} [${duration}ms]`, 'error');
            throw error;
        });
};

// Intercept XMLHttpRequest
const XHROpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    debugLog.log(`XHR ${method}: ${url}`, 'fetch');
    
    this.addEventListener('load', function() {
        debugLog.log(`XHR SUCCESS: ${url} (${this.status})`, 'success');
    });
    
    this.addEventListener('error', function() {
        debugLog.log(`XHR ERROR: ${url}`, 'error');
    });
    
    return XHROpen.call(this, method, url, ...rest);
};

// Monitor DOM mutations to detect style injection
const styleObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'STYLE' || node.nodeName === 'LINK') {
                debugLog.log(`STYLE ADDED: ${node.nodeName} ${node.id || '(no id)'}`, 'success');
                if (node.href) {
                    debugLog.log(`  href: ${node.href}`, 'debug');
                }
            }
        });
        
        mutation.removedNodes.forEach(node => {
            if (node.nodeName === 'STYLE' || node.nodeName === 'LINK') {
                debugLog.log(`STYLE REMOVED: ${node.nodeName} ${node.id || '(no id)'}`, 'warning');
            }
        });
    });
});

// Start observing once head is available
const startObserver = () => {
    if (document.head) {
        styleObserver.observe(document.head, { childList: true, subtree: true });
        debugLog.log('Style observer started', 'info');
    } else {
        setTimeout(startObserver, 100);
    }
};
startObserver();

// Enhanced CSS Loader with detailed logging
async function diagnosticCSSLoad() {
    if (!currentSite) return;
    
    debugLog.log(`========== CSS LOAD ATTEMPT ==========`, 'info');
    debugLog.log(`Target URL: ${currentSite.cssURL}`, 'info');
    
    // Method 1: Direct Fetch
    try {
        debugLog.log('Attempting direct fetch...', 'fetch');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            debugLog.log('Fetch timeout triggered (15s)', 'warning');
            controller.abort();
        }, 15000);
        
        const response = await fetch(currentSite.cssURL, {
            method: 'GET',
            headers: {
                'Accept': 'text/css,*/*',
                'Cache-Control': 'no-cache'
            },
            signal: controller.signal,
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'omit'
        });
        
        clearTimeout(timeoutId);
        
        debugLog.log(`Fetch completed: Status ${response.status}`, 'success');
        debugLog.log(`Response headers:`, 'debug');
        debugLog.log(`  Content-Type: ${response.headers.get('content-type')}`, 'debug');
        debugLog.log(`  Content-Length: ${response.headers.get('content-length')}`, 'debug');
        debugLog.log(`  CORS headers: ${response.headers.get('access-control-allow-origin')}`, 'debug');
        
        const css = await response.text();
        
        debugLog.log(`CSS received: ${css.length} characters`, 'success');
        debugLog.log(`CSS preview: ${css.substring(0, 150)}...`, 'debug');
        
        // Inject the CSS
        const style = document.createElement('style');
        style.id = currentSite.styleID;
        style.textContent = css;
        
        if (document.head) {
            document.head.appendChild(style);
            debugLog.log('CSS injected into DOM', 'success');
        } else {
            debugLog.log('ERROR: document.head not available!', 'error');
        }
        
        // Verify injection
        setTimeout(() => {
            const injectedStyle = document.getElementById(currentSite.styleID);
            if (injectedStyle) {
                debugLog.log('✅ CSS injection verified - style element exists', 'success');
                debugLog.log(`  Style element has ${injectedStyle.sheet?.cssRules?.length || 0} CSS rules`, 'debug');
            } else {
                debugLog.log('❌ CSS injection failed - style element not found', 'error');
            }
        }, 1000);
        
    } catch (error) {
        debugLog.log(`FETCH FAILED: ${error.name} - ${error.message}`, 'error');
        debugLog.log(`Error stack: ${error.stack}`, 'debug');
        
        if (error.name === 'AbortError') {
            debugLog.log('Fetch was aborted (timeout)', 'error');
        } else if (error.message.includes('CORS')) {
            debugLog.log('CORS error detected', 'error');
        } else if (error.message.includes('network')) {
            debugLog.log('Network error detected', 'error');
        }
        
        // Try CORS proxy as fallback
        debugLog.log('Attempting CORS proxy fallback...', 'fetch');
        try {
            const proxyURL = `https://corsproxy.io/?${encodeURIComponent(currentSite.cssURL)}`;
            debugLog.log(`Proxy URL: ${proxyURL}`, 'debug');
            
            const proxyResponse = await fetch(proxyURL, {
                method: 'GET',
                mode: 'cors'
            });
            
            debugLog.log(`Proxy fetch: Status ${proxyResponse.status}`, proxyResponse.ok ? 'success' : 'error');
            
            const proxyCss = await proxyResponse.text();
            debugLog.log(`Proxy CSS received: ${proxyCss.length} characters`, 'success');
            
            const style = document.createElement('style');
            style.id = currentSite.styleID;
            style.textContent = proxyCss;
            document.head.appendChild(style);
            
            debugLog.log('CSS injected via proxy', 'success');
            
        } catch (proxyError) {
            debugLog.log(`Proxy fetch also failed: ${proxyError.message}`, 'error');
        }
    }
    
    debugLog.log(`========== CSS LOAD COMPLETE ==========`, 'info');
}

// Capture any CSP violations
document.addEventListener('securitypolicyviolation', (e) => {
    debugLog.log(`🚨 CSP VIOLATION DETECTED!`, 'error');
    debugLog.log(`  Blocked: ${e.blockedURI}`, 'error');
    debugLog.log(`  Violated Directive: ${e.violatedDirective}`, 'error');
    debugLog.log(`  Original Policy: ${e.originalPolicy}`, 'debug');
});

// Capture unhandled errors
window.addEventListener('error', (e) => {
    debugLog.log(`💥 UNHANDLED ERROR: ${e.message}`, 'error');
    debugLog.log(`  File: ${e.filename}:${e.lineno}:${e.colno}`, 'debug');
});

// Capture unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
    debugLog.log(`💥 UNHANDLED PROMISE REJECTION: ${e.reason}`, 'error');
});

// Wait for page to be somewhat ready, then attempt CSS load
const attemptLoad = () => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(diagnosticCSSLoad, 2000);
        });
    } else {
        setTimeout(diagnosticCSSLoad, 2000);
    }
};

attemptLoad();

// Add a manual trigger button
setTimeout(() => {
    if (document.body) {
        const triggerBtn = document.createElement('button');
        triggerBtn.textContent = '🔄 Retry CSS Load';
        triggerBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            background: #00ff00;
            color: black;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            z-index: 2147483646;
            box-shadow: 0 4px 12px rgba(0,255,0,0.4);
        `;
        triggerBtn.onclick = () => {
            debugLog.clear();
            debugLog.log('Manual retry triggered', 'info');
            diagnosticCSSLoad();
        };
        document.body.appendChild(triggerBtn);
    }
}, 3000);

debugLog.log('🍓 Berry diagnostic script fully initialized', 'success');
debugLog.log('Waiting 2 seconds before CSS load attempt...', 'info');

})();
