/**
 * BlockVerse Tutorials Engine
 * Handles: progress tracking, search, navigation, code copy, section marking
 */

const Tutorials = (() => {
    const STORAGE_KEY = 'blockverse-tutorial-progress';

    const TUTORIAL_IDS = [
        'getting-started',
        'block-basics',
        'player-control',
        'first-game',
        'custom-nodes',
        'variables',
        'sharing',
        'api-reference'
    ];

    const SEARCH_INDEX = [
        { id: 'getting-started', title: 'Getting Started with Scripting', icon: '\u{1F3AF}', tags: ['beginner', 'hello world', 'visual blocks', 'beginner mode', 'events', 'looks', 'workspace'] },
        { id: 'block-basics', title: 'Block Basics', icon: '\u{1F9F1}', tags: ['blocks', 'place', 'remove', 'find', 'get', 'grass', 'stone', 'gold', 'diamond', 'obsidian', 'lava', 'coordinates'] },
        { id: 'player-control', title: 'Player Control', icon: '\u{1F3B3}', tags: ['player', 'position', 'teleport', 'move', 'speed', 'tween', 'touch', 'death', 'respawn'] },
        { id: 'first-game', title: 'Making Your First Game (Obby)', icon: '\u{1F3C6}', tags: ['obby', 'game', 'course', 'checkpoint', 'win', 'publish', 'platform', 'score', 'lava', 'diamond'] },
        { id: 'custom-nodes', title: 'Custom Nodes (My Blocks)', icon: '\u{1F9E9}', tags: ['custom', 'nodes', 'blocks', 'my blocks', 'reuse', 'share', 'export', 'import', 'library', 'advanced'] },
        { id: 'variables', title: 'Variables & Game State', icon: '\u{1F4CA}', tags: ['variable', 'score', 'timer', 'countdown', 'state', 'condition', 'if', 'game', 'multiplayer'] },
        { id: 'sharing', title: 'Sharing Your Creations', icon: '\u{1F310}', tags: ['share', 'publish', 'community', 'hub', 'friends', 'game code', 'feedback'] },
        { id: 'api-reference', title: 'JavaScript API Reference', icon: '\u{1F4D6}', tags: ['api', 'reference', 'block', 'player', 'ui', 'chat', 'tween', 'sound', 'events', 'timer', 'math', 'javascript', 'function', 'method'] }
    ];

    let _progress = {};

    /* ---- Init ---- */
    function init() {
        loadProgress();
        restoreUI();
        setupSearch();
        setupMobileNav();
        setupScrollSpy();
        setupKeyboard();
        updateProgressBar();
    }

    /* ---- Progress ---- */
    function loadProgress() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            _progress = raw ? JSON.parse(raw) : {};
        } catch (e) {
            _progress = {};
        }
    }

    function saveProgress() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_progress));
        } catch (e) { /* silent */ }
    }

    function markComplete(tutorialId, btnEl) {
        if (!_progress[tutorialId]) {
            _progress[tutorialId] = true;
            saveProgress();
        }
        if (btnEl) {
            btnEl.classList.add('completed');
            btnEl.innerHTML = '\u2705 Completed!';
        }
        updateProgressBar();
        updateTOC();
    }

    function isComplete(tutorialId) {
        return !!_progress[tutorialId];
    }

    function getProgress() {
        const total = TUTORIAL_IDS.length;
        const done = TUTORIAL_IDS.filter(id => _progress[id]).length;
        return { total, done, percent: Math.round((done / total) * 100) };
    }

    function updateProgressBar() {
        const { done, total, percent } = getProgress();
        const bar = document.getElementById('progress-bar');
        const count = document.getElementById('progress-count');
        const text = document.getElementById('progress-text');

        if (bar) bar.style.width = percent + '%';
        if (count) count.textContent = done;
        if (text) text.textContent = done + ' / ' + total;
    }

    /* ---- Restore UI from saved progress ---- */
    function restoreUI() {
        // Update each section's complete button
        TUTORIAL_IDS.forEach(id => {
            if (isComplete(id)) {
                const section = document.getElementById('sec-' + id);
                if (section) {
                    const btn = section.querySelector('.complete-section-btn');
                    if (btn) {
                        btn.classList.add('completed');
                        btn.innerHTML = '\u2705 Completed!';
                    }
                }
            }
        });

        updateTOC();
    }

    function updateTOC() {
        TUTORIAL_IDS.forEach(id => {
            const check = document.getElementById('check-' + id);
            const tocItem = check ? check.closest('.toc-item') : null;
            if (!tocItem) return;

            if (isComplete(id)) {
                tocItem.classList.add('completed');
            } else {
                tocItem.classList.remove('completed');
            }
        });
    }

    /* ---- Search ---- */
    function setupSearch() {
        const navInput = document.getElementById('nav-search-input');
        const overlay = document.getElementById('search-overlay');
        const overlayInput = document.getElementById('search-input');
        const resultsContainer = document.getElementById('search-results');

        if (navInput) {
            navInput.addEventListener('focus', () => {
                openSearch();
                if (overlayInput) overlayInput.value = navInput.value;
                if (overlayInput) overlayInput.focus();
            });
        }

        if (overlayInput) {
            overlayInput.addEventListener('input', () => {
                renderSearchResults(overlayInput.value, resultsContainer);
            });
        }

        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeSearch();
            });
        }

        // Expose globally for inline onclick
        window.closeSearchModal = closeSearch;
    }

    function openSearch() {
        const overlay = document.getElementById('search-overlay');
        const input = document.getElementById('search-input');
        if (overlay) {
            overlay.classList.add('active');
            if (input) {
                input.value = '';
                input.focus();
                renderSearchResults('', document.getElementById('search-results'));
            }
        }
    }

    function closeSearch() {
        const overlay = document.getElementById('search-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    function search(query) {
        if (!query || query.trim().length === 0) return SEARCH_INDEX;

        const q = query.toLowerCase().trim();
        const results = [];

        SEARCH_INDEX.forEach(item => {
            const titleMatch = item.title.toLowerCase().includes(q);
            const tagMatch = item.tags.some(tag => tag.includes(q));

            // Also search within section content
            let contentMatch = false;
            const section = document.getElementById('sec-' + item.id);
            if (section) {
                contentMatch = section.textContent.toLowerCase().includes(q);
            }

            if (titleMatch || tagMatch || contentMatch) {
                results.push({
                    ...item,
                    score: (titleMatch ? 10 : 0) + (tagMatch ? 5 : 0) + (contentMatch ? 2 : 0)
                });
            }
        });

        return results.sort((a, b) => b.score - a.score);
    }

    function renderSearchResults(query, container) {
        if (!container) return;

        const results = search(query);

        if (results.length === 0) {
            container.innerHTML = '<div class="search-no-results">No results found. Try a different search term.</div>';
            return;
        }

        container.innerHTML = results.map(r => {
            // Extract a snippet from the section
            const section = document.getElementById('sec-' + r.id);
            let snippet = '';
            if (section && query) {
                const text = section.textContent;
                const idx = text.toLowerCase().indexOf(query.toLowerCase());
                if (idx !== -1) {
                    const start = Math.max(0, idx - 40);
                    const end = Math.min(text.length, idx + query.length + 60);
                    snippet = (start > 0 ? '...' : '') + text.substring(start, end).replace(/\s+/g, ' ') + (end < text.length ? '...' : '');
                }
            }

            return '<div class="search-result-item" onclick="Tutorials.scrollToSection(\'' + r.id + '\'); closeSearchModal();">' +
                '<span class="sr-icon">' + r.icon + '</span>' +
                '<div>' +
                '<div class="sr-title">' + r.title + '</div>' +
                (snippet ? '<div class="sr-snippet">' + escapeHtml(snippet) + '</div>' : '') +
                '</div>' +
                '</div>';
        }).join('');
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ---- Navigation ---- */
    function scrollToSection(tutorialId) {
        const section = document.getElementById('sec-' + tutorialId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });

            // Highlight the section briefly
            section.style.transition = 'box-shadow 0.3s ease';
            section.style.boxShadow = '0 0 0 2px rgba(var(--primary-rgb), 0.4)';
            setTimeout(() => {
                section.style.boxShadow = 'none';
            }, 2000);
        }
    }

    function setupScrollSpy() {
        const sections = TUTORIAL_IDS.map(id => ({
            id,
            el: document.getElementById('sec-' + id)
        }));

        const tocItems = document.querySelectorAll('.toc-item');

        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    updateActiveSection(sections, tocItems);
                    ticking = false;
                });
                ticking = true;
            }
        });

        // TOC click handlers
        tocItems.forEach(item => {
            item.addEventListener('click', () => {
                const sectionId = item.getAttribute('data-section');
                if (sectionId) scrollToSection(sectionId);

                // Close mobile sidebar
                closeMobileSidebar();
            });
        });

        // Initial call
        updateActiveSection(sections, tocItems);
    }

    function updateActiveSection(sections, tocItems) {
        const scrollY = window.scrollY + 120;
        let activeId = null;

        for (let i = sections.length - 1; i >= 0; i--) {
            if (sections[i].el && sections[i].el.offsetTop <= scrollY) {
                activeId = sections[i].id;
                break;
            }
        }

        tocItems.forEach(item => {
            const secId = item.getAttribute('data-section');
            if (secId === activeId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    /* ---- Mobile Nav ---- */
    function setupMobileNav() {
        const toggle = document.getElementById('mobile-toggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');

        if (toggle && sidebar) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                if (overlay) overlay.classList.toggle('active');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', closeMobileSidebar);
        }
    }

    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    /* ---- Keyboard ---- */
    function setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            // Press "/" to open search (when not in an input)
            if (e.key === '/' && !isInInput(e)) {
                e.preventDefault();
                openSearch();
            }

            // Press Escape to close search
            if (e.key === 'Escape') {
                closeSearch();
            }
        });
    }

    function isInInput(e) {
        const tag = e.target.tagName.toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    }

    /* ---- Code Copy ---- */
    function copyCode(btnEl) {
        const codeBlock = btnEl.closest('.code-block');
        if (!codeBlock) return;

        const pre = codeBlock.querySelector('pre');
        if (!pre) return;

        const text = pre.textContent || pre.innerText;

        navigator.clipboard.writeText(text).then(() => {
            btnEl.classList.add('copied');
            btnEl.innerHTML = '\u2705 Copied!';

            setTimeout(() => {
                btnEl.classList.remove('copied');
                btnEl.innerHTML = '\u{1F4CB} Copy';
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                btnEl.classList.add('copied');
                btnEl.innerHTML = '\u2705 Copied!';
                setTimeout(() => {
                    btnEl.classList.remove('copied');
                    btnEl.innerHTML = '\u{1F4CB} Copy';
                }, 2000);
            } catch (err) {
                btnEl.innerHTML = '\u274C Failed';
                setTimeout(() => {
                    btnEl.innerHTML = '\u{1F4CB} Copy';
                }, 2000);
            }
            document.body.removeChild(textarea);
        });
    }

    /* ---- Public API ---- */
    return {
        init,
        markComplete,
        isComplete,
        getProgress,
        search,
        scrollToSection,
        copyCode
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Tutorials.init();
});