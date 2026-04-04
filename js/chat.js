// ============================================
// BLOCKVERSE - Chat Module
// ============================================
// In-game chat system: open/close input, send/receive messages,
// system notifications, keyboard shortcuts, and message history.
// ============================================

const Chat = (() => {
    'use strict';

    // Track whether the chat input is currently visible
    let _inputVisible = false;

    // DOM references (cached on init)
    let _inputWrapper = null;
    let _inputEl = null;
    let _sendBtn = null;
    let _messagesEl = null;

    // ========================================
    //  Public API
    // ========================================

    /**
     * Initialize the chat module.
     * - Cache DOM references.
     * - Wire up keyboard shortcuts (T / Enter / Escape).
     * - Wire up the send button.
     */
    function init() {
        _inputWrapper = document.getElementById('chat-input-wrapper');
        _inputEl = document.getElementById('chat-input');
        _sendBtn = document.getElementById('chat-send');
        _messagesEl = document.getElementById('chat-messages');

        // Ensure the input starts hidden
        if (_inputWrapper) _inputWrapper.classList.add('hidden');

        _setupKeyboardShortcuts();
        _setupSendButton();
    }

    /**
     * Show the chat input and focus it.
     * Unlocks the pointer lock so the user can type.
     */
    function openInput() {
        if (_inputWrapper) {
            _inputWrapper.classList.remove('hidden');
        }
        if (_inputEl) {
            _inputEl.value = '';
            _inputEl.focus();
        }
        _inputVisible = true;

        // Unlock pointer so user can interact with input
        if (typeof Player !== 'undefined' && Player.unlock) {
            Player.unlock();
        }
    }

    /**
     * Hide the chat input and re-lock the pointer.
     */
    function closeInput() {
        if (_inputWrapper) {
            _inputWrapper.classList.add('hidden');
        }
        _inputVisible = false;

        // Re-lock pointer for game controls
        if (typeof Player !== 'undefined' && Player.lock) {
            Player.lock();
        }
    }

    /**
     * Send a chat message.
     * @param {string} text
     */
    function sendMessage(text) {
        // Trim and validate
        text = (text || '').trim();
        if (!text) return;

        // Enforce max length
        if (text.length > BV.CHAT_MAX_LENGTH) {
            text = text.substring(0, BV.CHAT_MAX_LENGTH);
        }

        const username = Auth.getCurrentUser() || 'Unknown';

        // Display locally
        addMessage(username, text, 'player');

        // Broadcast to all peers
        if (typeof Multiplayer !== 'undefined') {
            Multiplayer.broadcast({
                type: BV.MSG.PLAYER_CHAT,
                payload: { username, text },
            });
        }

        // Clear and close
        if (_inputEl) _inputEl.value = '';
        closeInput();
    }

    /**
     * Add a message to the chat display.
     * @param {string} username
     * @param {string} text
     * @param {'player'|'system'} [type='player']
     */
    function addMessage(username, text, type = 'player') {
        if (!_messagesEl) return;

        const msgEl = document.createElement('div');

        if (type === 'system') {
            msgEl.className = 'chat-message chat-system';
            msgEl.innerHTML = `<em class="chat-system-text">${_escapeHTML(text)}</em>`;
        } else {
            msgEl.className = 'chat-message chat-player';
            msgEl.innerHTML = `<span class="chat-username" style="color:${BV.COLORS.ACCENT}">${_escapeHTML(username)}</span><span class="chat-text">${_escapeHTML(text)}</span>`;
        }

        _messagesEl.appendChild(msgEl);

        // Enforce message limit
        _trimMessages();

        // Auto-scroll to bottom
        _messagesEl.scrollTop = _messagesEl.scrollHeight;
    }

    /**
     * Shortcut for system messages.
     * @param {string} text
     */
    function addSystemMessage(text) {
        addMessage('', text, 'system');
    }

    /**
     * Check whether the chat input overlay is currently open.
     * @returns {boolean}
     */
    function isVisible() {
        return _inputVisible;
    }

    // ========================================
    //  Private helpers
    // ========================================

    /**
     * Set up global keyboard shortcuts for the chat.
     * - T or / : open chat input
     * - Enter (when focused): send message
     * - Escape: close chat input
     */
    function _setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only act when the game screen is active
            const gameScreen = document.getElementById('screen-game');
            if (!gameScreen || !gameScreen.classList.contains('active')) return;

            // Enter key: send if input is open
            if (e.key === 'Enter' && _inputVisible) {
                e.preventDefault();
                sendMessage(_inputEl ? _inputEl.value : '');
                return;
            }

            // Escape: close input if open
            if (e.key === 'Escape' && _inputVisible) {
                e.preventDefault();
                closeInput();
                return;
            }

            // T or / : open chat (only if NOT already in an input/textarea)
            if ((e.key === 't' || e.key === 'T' || e.key === '/') && !_inputVisible) {
                const tag = e.target.tagName.toLowerCase();
                if (tag === 'input' || tag === 'textarea') return;

                e.preventDefault();
                openInput();
            }
        });
    }

    /** Wire up the chat send button click. */
    function _setupSendButton() {
        if (!_sendBtn) return;

        _sendBtn.addEventListener('click', () => {
            sendMessage(_inputEl ? _inputEl.value : '');
        });
    }

    /**
     * Remove oldest messages when the count exceeds BV.CHAT_MAX_MESSAGES.
     */
    function _trimMessages() {
        if (!_messagesEl) return;
        while (_messagesEl.children.length > BV.CHAT_MAX_MESSAGES) {
            _messagesEl.removeChild(_messagesEl.firstChild);
        }
    }

    /**
     * Escape HTML special characters to prevent XSS in chat.
     * @param {string} str
     * @returns {string}
     */
    function _escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ========================================
    //  Return the public interface
    // ========================================
    return {
        init,
        openInput,
        closeInput,
        sendMessage,
        addMessage,
        addSystemMessage,
        isVisible,
    };
})();
