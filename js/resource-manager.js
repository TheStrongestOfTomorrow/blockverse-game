// ============================================
// BLOCKVERSE - Resource Manager (Cleanup)
// ============================================
// Centralized cleanup for event listeners, intervals, timeouts.
// Prevents memory leaks from orphaned event handlers.
// ============================================

const ResourceManager = (() => {
    'use strict';

    const _listeners = new Map();   // key -> { target, event, handler }
    const _intervals = new Set();   // intervalId set
    const _timeouts = new Set();    // timeoutId set

    /**
     * Register an event listener with automatic cleanup tracking
     */
    function addListener(target, eventName, handler) {
        if (!target) return;

        target.addEventListener(eventName, handler);

        const key = `${eventName}`;
        if (!_listeners.has(key)) {
            _listeners.set(key, []);
        }
        _listeners.get(key).push({ target, handler });
    }

    /**
     * Register an interval for later cleanup
     */
    function addInterval(intervalId) {
        _intervals.add(intervalId);
        return intervalId;
    }

    /**
     * Register a timeout for later cleanup
     */
    function addTimeout(timeoutId) {
        _timeouts.add(timeoutId);
        return timeoutId;
    }

    /**
     * Clean up all registered resources
     */
    function cleanup() {
        console.log('[ResourceManager] Cleaning up resources...');

        // Remove all event listeners
        _listeners.forEach((handlers) => {
            handlers.forEach(({ target, handler, event }) => {
                // Re-find event name from closure
                const parent = _listeners.entries();
                for (const [eventName, list] of parent) {
                    if (list.includes({ target, handler })) {
                        target.removeEventListener(eventName, handler);
                        break;
                    }
                }
            });
        });
        _listeners.clear();

        // Clear all intervals
        _intervals.forEach(id => clearInterval(id));
        _intervals.clear();

        // Clear all timeouts
        _timeouts.forEach(id => clearTimeout(id));
        _timeouts.clear();

        console.log('[ResourceManager] Cleanup complete');
    }

    /**
     * Get current resource counts (for debugging)
     */
    function getStats() {
        let listenerCount = 0;
        _listeners.forEach(handlers => {
            listenerCount += handlers.length;
        });
        return {
            listeners: listenerCount,
            intervals: _intervals.size,
            timeouts: _timeouts.size,
        };
    }

    return {
        addListener,
        addInterval,
        addTimeout,
        cleanup,
        getStats,
    };
})();
