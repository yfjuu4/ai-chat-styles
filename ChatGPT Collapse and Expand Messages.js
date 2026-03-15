// ==UserScript==
// @name         ChatGPT Collapse and Expand Messages
// @namespace    https://github.com/ChinaGodMan/UserScripts
// @version      0.9.1
// @description  Add "Collapse or Expand" buttons to ChatGPT messages. Auto-collapse specific user phrases. Efficient version using MutationObserver.
// @match        https://chatgpt.com/*
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
        " à expliquer est :",
        "Please now proceed with the presentation of",
        "Veuillez maintenant procéder à la présentation du ou des",
        "Reference Rule:",
        "Règle de Référence :"
    ];

    const processedMessages = new WeakSet();

    function generateMessageId(message, index) {
        return `message-${index}-${message.innerText.substring(0, 30)}`;
    }

    function createToggleButton(message, messageId, isAutoCollapsed, isUserMessage) {
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Collapse or Expand';
        toggleButton.style.backgroundColor = isUserMessage ? (isAutoCollapsed ? 'green' : 'blue') : '#a30000';
        toggleButton.style.color = '#c6cdb0';
        toggleButton.style.border = 'none';
        toggleButton.style.padding = '5px 10px';
        toggleButton.style.marginBottom = '0px';
        toggleButton.style.cursor = 'pointer';
        toggleButton.classList.add('toggle-button');

        message.parentElement.insertBefore(toggleButton, message);

        toggleButton.addEventListener('click', function () {
            const collapsed = message.classList.toggle('collapsed');
            if (collapsed) {
                message.style.overflow = 'hidden';
                message.style.height = '100px';
                localStorage.setItem(messageId, 'collapsed');
                toggleButton.textContent = 'Expand';
            } else {
                message.style.overflow = 'visible';
                message.style.height = 'auto';
                localStorage.setItem(messageId, 'expanded');
                toggleButton.textContent = 'Collapse';
            }
        });
    }

    function processMessage(message, index) {
        if (processedMessages.has(message)) return;

        const isUserMessage = message.getAttribute('data-message-author-role') === 'user';
        const messageId = generateMessageId(message, index);
        const storedState = localStorage.getItem(messageId);

        if (message.offsetHeight < 200) return;

        const isAutoCollapsed = isUserMessage && autoCollapsePhrases.some(phrase => message.innerText.includes(phrase));
        if (!message.previousElementSibling || !message.previousElementSibling.classList.contains('toggle-button')) {
            createToggleButton(message, messageId, isAutoCollapsed, isUserMessage);
        }

        if (isAutoCollapsed && storedState !== 'expanded') {
            message.style.overflow = 'hidden';
            message.style.height = '100px';
            message.classList.add('collapsed');
            message.previousElementSibling.textContent = 'Expand';
        } else if (storedState === 'collapsed') {
            message.style.overflow = 'hidden';
            message.style.height = '100px';
            message.classList.add('collapsed');
            message.previousElementSibling.textContent = 'Expand';
        } else {
            message.style.overflow = 'visible';
            message.style.height = 'auto';
            message.classList.remove('collapsed');
            message.previousElementSibling.textContent = 'Collapse';
        }

        processedMessages.add(message);
    }

    function observeMessages() {
        const observer = new MutationObserver(() => {
            const messages = document.querySelectorAll('div[data-message-author-role]');
            messages.forEach((msg, i) => processMessage(msg, i));
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Style for collapsed messages
    const style = document.createElement('style');
    style.textContent = `
        .collapsed::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 10px;
            background: linear-gradient(to bottom, transparent, red);
        }
        .toggle-button {
            display: block;
            text-align: center;
        }
    `;
    document.head.appendChild(style);

    // Process any existing messages immediately
    function processExistingMessages() {
        const messages = document.querySelectorAll('div[data-message-author-role]');
        messages.forEach((msg, i) => processMessage(msg, i));
    }

    // Start observing immediately
    observeMessages();

    // Process messages on different events to catch them whenever they appear
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processExistingMessages);
    } else {
        processExistingMessages();
    }

    // Additional backup checks after delays to ensure messages are caught
    setTimeout(processExistingMessages, 1000);
    setTimeout(processExistingMessages, 2000);
})();
