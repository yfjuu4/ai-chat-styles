// ==UserScript==
// @name         Claude AI Collapse and Expand Messages
// @namespace    https://github.com/ChinaGodMan/UserScripts
// @version      1.0.0
// @description  Add "Collapse or Expand" buttons to Claude AI messages. Auto-collapse specific user phrases. Efficient version using MutationObserver.
// @match        https://claude.ai/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const autoCollapsePhrases = [
        "This message should automatically and always be collapsed",
        "This prompt must automatically and always be folded",
        "Ce message doit automatiquement et toujours être replié",
        " to explain is:",
        "sentence to translate into ",
        "à traduire en ",
        "Other additional sections",
        "extract only the following specific sections",
        "Autres sections supplémentaires pour le mot",
        "pour la forme pronominale:",
        " à expliquer est:"
    ];

    const processedMessages = new WeakSet();

    function generateMessageId(message, index) {
        return `claude-message-${index}-${message.innerText.substring(0, 30)}`;
    }

    // NEW: Get or create shared button container
    function getOrCreateButtonContainer(message) {
        // Check if container already exists
        let container = message.previousElementSibling;
        if (container && container.classList.contains('shared-button-container')) {
            return container;
        }

        // Create new container
        container = document.createElement('div');
        container.classList.add('shared-button-container');
        container.style.display = 'flex';
        container.style.gap = '8px';
        container.style.marginBottom = '8px';
        container.style.flexWrap = 'wrap';
        
        message.parentElement.insertBefore(container, message);
        return container;
    }

    function createToggleButton(message, messageId, isAutoCollapsed, isUserMessage) {
        const container = getOrCreateButtonContainer(message);
        
        // Check if button already exists in container
        if (container.querySelector('.toggle-button')) {
            return;
        }

        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Collapse or Expand';
        toggleButton.style.backgroundColor = isUserMessage ? (isAutoCollapsed ? 'green' : 'blue') : '#a30000';
        toggleButton.style.color = '#c6cdb0';
        toggleButton.style.border = 'none';
        toggleButton.style.padding = '5px 10px';
        toggleButton.style.margin = '0';
        toggleButton.style.cursor = 'pointer';
        toggleButton.style.borderRadius = '4px';
        toggleButton.style.flex = '1';
        toggleButton.style.minWidth = 'fit-content';
        toggleButton.classList.add('toggle-button');

        container.appendChild(toggleButton);

        toggleButton.addEventListener('click', function () {
            const collapsed = message.classList.toggle('collapsed');
            if (collapsed) {
                message.style.overflow = 'hidden';
                message.style.maxHeight = '100px';
                localStorage.setItem(messageId, 'collapsed');
                toggleButton.textContent = '↕️ Expand ↕️';
            } else {
                message.style.overflow = 'visible';
                message.style.maxHeight = 'none';
                localStorage.setItem(messageId, 'expanded');
                toggleButton.textContent = 'Collapse ✡️';
            }
        });
    }

    function isUserMessage(element) {
        const parent = element.closest('[class*="font-user"]') ||
                      element.querySelector('[class*="font-user"]');
       
        const isAssistant = element.closest('[class*="font-claude"]') ||
                           element.querySelector('[class*="font-claude"]');
       
        return parent !== null || (isAssistant === null && element.textContent.length > 0);
    }

    function processMessage(message, index) {
        if (processedMessages.has(message)) return;

        const isUser = isUserMessage(message);
        const messageId = generateMessageId(message, index);
        const storedState = localStorage.getItem(messageId);

        if (message.offsetHeight < 200) return;

        const isAutoCollapsed = isUser && autoCollapsePhrases.some(phrase =>
            message.innerText.includes(phrase)
        );

        createToggleButton(message, messageId, isAutoCollapsed, isUser);

        // Get the button from the container
        const container = message.previousElementSibling;
        const toggleButton = container?.querySelector('.toggle-button');

        // Apply collapse state
        if (isAutoCollapsed && storedState !== 'expanded') {
            message.style.overflow = 'hidden';
            message.style.maxHeight = '100px';
            message.classList.add('collapsed');
            if (toggleButton) {
                toggleButton.textContent = '↕️ Expand ↕️';
            }
        } else if (storedState === 'collapsed') {
            message.style.overflow = 'hidden';
            message.style.maxHeight = '100px';
            message.classList.add('collapsed');
            if (toggleButton) {
                toggleButton.textContent = '↕️ Expand ↕️';
            }
        } else {
            message.style.overflow = 'visible';
            message.style.maxHeight = 'none';
            message.classList.remove('collapsed');
            if (toggleButton) {
                toggleButton.textContent = 'Collapse ✡️';
            }
        }

        processedMessages.add(message);
    }

    function observeMessages() {
        const observer = new MutationObserver(() => {
            const messages = document.querySelectorAll(
                '[class*="font-claude"], [class*="font-user"], ' +
                'div[class*="contents"] > div[class*="flex flex-col"]'
            );
           
            messages.forEach((msg, i) => {
                if (msg.innerText && msg.innerText.trim().length > 0) {
                    processMessage(msg, i);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            const messages = document.querySelectorAll(
                '[class*="font-claude"], [class*="font-user"], ' +
                'div[class*="contents"] > div[class*="flex flex-col"]'
            );
            messages.forEach((msg, i) => {
                if (msg.innerText && msg.innerText.trim().length > 0) {
                    processMessage(msg, i);
                }
            });
        }, 1000);
    }

    const style = document.createElement('style');
    style.textContent = `
        .collapsed {
            position: relative;
        }
        .collapsed::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 30px;
            background: linear-gradient(to bottom, transparent, rgba(255, 0, 0, 0.3));
            pointer-events: none;
        }
        .toggle-button {
            display: block;
            text-align: center;
            transition: background-color 0.3s ease;
        }
        .toggle-button:hover {
            opacity: 0.8;
        }
        .shared-button-container {
            align-items: stretch;
        }
    `;
    document.head.appendChild(style);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', observeMessages);
    } else {
        observeMessages();
    }
})();
