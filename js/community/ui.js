/**
 * BlockVerse Community Hub - UI Module
 * Renders the full community interface: browse, publish, my content, tutorials.
 * Uses CommunityHub for all data operations.
 */

const CommunityUI = {
    _container: null,
    _currentView: 'browse',   // browse | publish | my-content | tutorials | import
    _contentType: 'all',      // all | node-pack | game | tutorial
    _sortBy: 'newest',        // newest | popular | recently-updated
    _searchQuery: '',
    _currentPage: 1,
    _isLoading: false,
    _itemsPerPage: 12,
    _selectedContent: null,

    // ─── Initialization ───────────────────────────────────────────────

    /**
     * Initialize the Community Hub UI.
     * @param {string} containerId - The DOM element ID to render into.
     */
    init(containerId) {
        this._container = document.getElementById(containerId);
        if (!this._container) {
            console.error('[CommunityUI] Container not found:', containerId);
            return;
        }
        CommunityHub.init();
        this._render();
        this._bindEvents();
    },

    // ─── Main Render ──────────────────────────────────────────────────

    _render() {
        const user = CommunityHub.getUserInfo();
        const isAuth = CommunityHub.isAuthenticated();

        this._container.innerHTML = `
            <!-- Auth Bar -->
            <div class="community-auth-bar">
                <div class="community-auth-left">
                    ${isAuth && user ? `
                        <img src="${user.avatar_url}" alt="" class="community-avatar">
                        <span class="community-username">${user.name || user.login}</span>
                        <button class="btn btn-sm btn-ghost community-logout-btn" id="community-logout">Logout</button>
                    ` : `
                        <span class="community-guest-text">Not connected</span>
                    `}
                </div>
                <div class="community-auth-right">
                    ${!isAuth ? `
                        <button class="btn btn-sm btn-primary community-login-btn" id="community-login-btn">
                            🔑 Connect GitHub
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Navigation Tabs -->
            <div class="community-tabs">
                <button class="community-tab ${this._currentView === 'browse' ? 'active' : ''}" data-view="browse">
                    🏠 Browse
                </button>
                <button class="community-tab ${this._currentView === 'publish' ? 'active' : ''}" data-view="publish">
                    ✏️ Publish
                </button>
                <button class="community-tab ${this._currentView === 'my-content' ? 'active' : ''}" data-view="my-content">
                    📂 My Content
                </button>
                <button class="community-tab ${this._currentView === 'tutorials' ? 'active' : ''}" data-view="tutorials">
                    📚 Tutorials
                </button>
                <button class="community-tab ${this._currentView === 'import' ? 'active' : ''}" data-view="import">
                    📥 Import
                </button>
            </div>

            <!-- Content Area -->
            <div class="community-content" id="community-content-area">
                ${this._renderCurrentView()}
            </div>

            <!-- Detail Modal (hidden) -->
            <div class="community-modal hidden" id="community-detail-modal">
                <div class="community-modal-backdrop" id="community-modal-backdrop"></div>
                <div class="community-modal-panel">
                    <div class="community-modal-header">
                        <h2 id="community-modal-title">Content Details</h2>
                        <button class="community-modal-close" id="community-modal-close">&times;</button>
                    </div>
                    <div class="community-modal-body" id="community-modal-body"></div>
                </div>
            </div>

            <!-- Auth Modal (hidden) -->
            <div class="community-modal hidden" id="community-auth-modal">
                <div class="community-modal-backdrop" id="community-auth-modal-backdrop"></div>
                <div class="community-modal-panel community-auth-panel">
                    <div class="community-modal-header">
                        <h2>Connect GitHub</h2>
                        <button class="community-modal-close" id="community-auth-modal-close">&times;</button>
                    </div>
                    <div class="community-modal-body" id="community-auth-modal-body"></div>
                </div>
            </div>
        `;
    },

    _renderCurrentView() {
        switch (this._currentView) {
            case 'browse': return this._renderBrowseView();
            case 'publish': return this._renderPublishView();
            case 'my-content': return this._renderMyContentView();
            case 'tutorials': return this._renderTutorialsView();
            case 'import': return this._renderImportView();
            default: return this._renderBrowseView();
        }
    },

    // ─── Browse View ──────────────────────────────────────────────────

    _renderBrowseView() {
        return `
            <!-- Search & Filters -->
            <div class="community-browse-controls">
                <div class="community-search-box">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="community-search" placeholder="Search node packs, games, tutorials..." 
                           value="${this._escapeHtml(this._searchQuery)}" maxlength="100">
                </div>
                <div class="community-filters">
                    <div class="community-filter-group">
                        <label>Type:</label>
                        <div class="community-filter-buttons">
                            <button class="btn btn-sm ${this._contentType === 'all' ? 'btn-primary' : 'btn-ghost'}" data-filter-type="all">All</button>
                            <button class="btn btn-sm ${this._contentType === 'node-pack' ? 'btn-primary' : 'btn-ghost'}" data-filter-type="node-pack">🧩 Nodes</button>
                            <button class="btn btn-sm ${this._contentType === 'game' ? 'btn-primary' : 'btn-ghost'}" data-filter-type="game">🎮 Games</button>
                            <button class="btn btn-sm ${this._contentType === 'tutorial' ? 'btn-primary' : 'btn-ghost'}" data-filter-type="tutorial">📚 Tutorials</button>
                        </div>
                    </div>
                    <div class="community-filter-group">
                        <label>Sort:</label>
                        <div class="community-filter-buttons">
                            <button class="btn btn-sm ${this._sortBy === 'newest' ? 'btn-primary' : 'btn-ghost'}" data-sort="newest">Newest</button>
                            <button class="btn btn-sm ${this._sortBy === 'popular' ? 'btn-primary' : 'btn-ghost'}" data-sort="popular">Popular</button>
                            <button class="btn btn-sm ${this._sortBy === 'recently-updated' ? 'btn-primary' : 'btn-ghost'}" data-sort="recently-updated">Updated</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Grid -->
            <div class="community-grid" id="community-grid">
                <div class="community-loading-state">
                    <div class="auth-spinner"></div>
                    <p>Loading community content...</p>
                </div>
            </div>

            <!-- Pagination -->
            <div class="community-pagination hidden" id="community-pagination">
                <button class="btn btn-sm btn-ghost" id="community-prev-page" ${this._currentPage <= 1 ? 'disabled' : ''}>← Previous</button>
                <span class="community-page-info">Page ${this._currentPage}</span>
                <button class="btn btn-sm btn-ghost" id="community-next-page">Next →</button>
            </div>
        `;
    },

    // ─── Publish View ─────────────────────────────────────────────────

    _renderPublishView() {
        if (!CommunityHub.isAuthenticated()) {
            return `
                <div class="community-empty-state">
                    <div class="empty-icon">🔒</div>
                    <h3>Login Required</h3>
                    <p>Connect your GitHub account to publish content.</p>
                    <button class="btn btn-primary" id="publish-login-btn">Connect GitHub</button>
                </div>
            `;
        }

        return `
            <div class="community-publish">
                <div class="section-header">
                    <h2>✏️ Publish Content</h2>
                </div>

                <!-- Publish Type Selector -->
                <div class="publish-type-selector">
                    <button class="btn btn-primary publish-type-btn active" data-publish-type="node-pack">🧩 Node Pack</button>
                    <button class="btn btn-ghost publish-type-btn" data-publish-type="game">🎮 Game</button>
                </div>

                <!-- Node Pack Form -->
                <div class="publish-form" id="publish-node-pack-form">
                    <div class="form-group">
                        <label>Pack Name *</label>
                        <input type="text" id="publish-pack-name" placeholder="My Awesome Node Pack" maxlength="60">
                    </div>
                    <div class="form-group">
                        <label>Description *</label>
                        <textarea id="publish-pack-desc" placeholder="Describe what your node pack does..." maxlength="500" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select id="publish-pack-category">
                            <option value="Motion">🏃 Motion</option>
                            <option value="Physics">⚡ Physics</option>
                            <option value="Combat">⚔️ Combat</option>
                            <option value="UI">🖥️ UI</option>
                            <option value="Audio">🔊 Audio</option>
                            <option value="Effects">✨ Effects</option>
                            <option value="Utility">🔧 Utility</option>
                            <option value="Multiplayer">👥 Multiplayer</option>
                            <option value="General">📦 General</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Nodes (JSON) *</label>
                        <textarea id="publish-nodes-json" placeholder='[{"id":"custom_1","name":"My Node","description":"Does something cool","inputs":[{"name":"x","type":"number"}],"outputType":"action","code":"// your code here"}]' rows="10" style="font-family: var(--font-mono); font-size: 0.82rem;"></textarea>
                        <small class="form-hint">Paste an array of node objects. Each node needs: id, name, description, inputs, outputType, code.</small>
                    </div>
                    <div id="publish-pack-error" class="form-error"></div>
                    <button class="btn btn-primary btn-lg" id="publish-pack-btn">🚀 Publish Node Pack</button>
                    <div id="publish-pack-loading" class="auth-loading" style="display:none;">
                        <div class="auth-spinner"></div> Publishing...
                    </div>
                </div>

                <!-- Game Form -->
                <div class="publish-form hidden" id="publish-game-form">
                    <div class="form-group">
                        <label>Game Name *</label>
                        <input type="text" id="publish-game-name" placeholder="My Shared Game" maxlength="60">
                    </div>
                    <div class="form-group">
                        <label>Description *</label>
                        <textarea id="publish-game-desc" placeholder="Describe your game..." maxlength="500" rows="3"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select id="publish-game-category">
                            <option value="sandbox">🏗️ Sandbox</option>
                            <option value="obby">🏃 Obby</option>
                            <option value="tycoon">💰 Tycoon</option>
                            <option value="racing">🏎️ Racing</option>
                            <option value="adventure">⚔️ Adventure</option>
                            <option value="roleplay">🎭 Roleplay</option>
                            <option value="minigame">🎯 Minigame</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Game Data (JSON)</label>
                        <textarea id="publish-game-data" placeholder='{"category":"obby","blocks":[...]}' rows="6" style="font-family: var(--font-mono); font-size: 0.82rem;"></textarea>
                        <small class="form-hint">Optional: Export your game data from the Creator Studio and paste it here.</small>
                    </div>
                    <div id="publish-game-error" class="form-error"></div>
                    <button class="btn btn-primary btn-lg" id="publish-game-btn">🚀 Publish Game</button>
                    <div id="publish-game-loading" class="auth-loading" style="display:none;">
                        <div class="auth-spinner"></div> Publishing...
                    </div>
                </div>
            </div>
        `;
    },

    // ─── My Content View ──────────────────────────────────────────────

    _renderMyContentView() {
        if (!CommunityHub.isAuthenticated()) {
            return `
                <div class="community-empty-state">
                    <div class="empty-icon">🔒</div>
                    <h3>Login Required</h3>
                    <p>Connect your GitHub account to see your published content.</p>
                    <button class="btn btn-primary" id="mycontent-login-btn">Connect GitHub</button>
                </div>
            `;
        }

        const user = CommunityHub.getUserInfo();
        return `
            <div class="section-header">
                <h2>📂 My Content</h2>
                <span class="text-muted">Showing content by @${user?.login || ''}</span>
            </div>
            <div class="community-grid" id="community-my-grid">
                <div class="community-loading-state">
                    <div class="auth-spinner"></div>
                    <p>Loading your content...</p>
                </div>
            </div>
        `;
    },

    // ─── Tutorials View ───────────────────────────────────────────────

    _renderTutorialsView() {
        return `
            <div class="community-tutorials">
                <div class="section-header">
                    <h2>📚 Tutorials & Guides</h2>
                </div>

                <!-- Built-in tutorials -->
                <div class="tutorial-section">
                    <h3>🧩 How to Create Custom Nodes</h3>
                    <div class="tutorial-cards">
                        <div class="tutorial-card">
                            <div class="tutorial-card-header">
                                <span class="tutorial-card-icon">📖</span>
                                <h4>Getting Started with Custom Nodes</h4>
                            </div>
                            <p>Learn how to create your first custom node for the BlockVerse Creator Studio.</p>
                            <div class="tutorial-steps">
                                <ol>
                                    <li><strong>Open Creator Studio</strong> — Click "Creator Studio" in the lobby sidebar.</li>
                                    <li><strong>Go to My Blocks</strong> — Click the "My Blocks" tab in the scripting panel.</li>
                                    <li><strong>Create a New Block</strong> — Click "+ New Block" to open the editor.</li>
                                    <li><strong>Define Inputs</strong> — Add inputs like "number", "string", "boolean", or "object".</li>
                                    <li><strong>Set Output Type</strong> — Choose "action" (fires an event), "value" (returns data), or "condition" (true/false).</li>
                                    <li><strong>Write Code</strong> — Use the BlockVerse API to make your node do something.</li>
                                    <li><strong>Test</strong> — Connect your node in a script and press Play to test it.</li>
                                </ol>
                            </div>
                        </div>

                        <div class="tutorial-card">
                            <div class="tutorial-card-header">
                                <span class="tutorial-card-icon">⚡</span>
                                <h4>Node Types & Outputs</h4>
                            </div>
                            <p>Understand the different node types and how to use them effectively.</p>
                            <div class="tutorial-steps">
                                <div class="tutorial-code-block">
                                    <strong>Action Node</strong> — Executes code when triggered.<br>
                                    <code>outputType: "action"</code><br><br>
                                    <strong>Value Node</strong> — Returns a computed value.<br>
                                    <code>outputType: "value"</code> (use <code>return</code> statement)<br><br>
                                    <strong>Condition Node</strong> — Returns true or false.<br>
                                    <code>outputType: "condition"</code> (use <code>return true/false</code>)
                                </div>
                            </div>
                        </div>

                        <div class="tutorial-card">
                            <div class="tutorial-card-header">
                                <span class="tutorial-card-icon">🧪</span>
                                <h4>BlockVerse Node API</h4>
                            </div>
                            <p>Key APIs available inside custom node code:</p>
                            <div class="tutorial-code-block">
                                <code>Player</code> — Reference to the current player<br>
                                <code>World</code> — Access the world/block data<br>
                                <code>Game</code> — Game state and settings<br>
                                <code>Tween.moveTo(obj, x, y, z, duration)</code> — Smooth movement<br>
                                <code>World.getBlock(x, y, z)</code> — Get block at position<br>
                                <code>World.setBlock(x, y, z, type)</code> — Place a block<br>
                                <code>Chat.send(message)</code> — Send chat message<br>
                                <code>Events.on('eventName', callback)</code> — Listen for events
                            </div>
                        </div>

                        <div class="tutorial-card">
                            <div class="tutorial-card-header">
                                <span class="tutorial-card-icon">📦</span>
                                <h4>Sharing & Publishing Node Packs</h4>
                            </div>
                            <p>Share your custom nodes with the community.</p>
                            <div class="tutorial-steps">
                                <ol>
                                    <li><strong>Export</strong> — In My Blocks, select nodes and click "Export Pack".</li>
                                    <li><strong>Get Share Code</strong> — A base64 code will be generated.</li>
                                    <li><strong>Publish</strong> — Go to the "Publish" tab, paste your nodes JSON, fill in details, and click Publish.</li>
                                    <li><strong>Alternatively</strong> — Use the "Import" tab to import packs from share codes.</li>
                                </ol>
                            </div>
                        </div>

                        <div class="tutorial-card">
                            <div class="tutorial-card-header">
                                <span class="tutorial-card-icon">💡</span>
                                <h4>Tips & Best Practices</h4>
                            </div>
                            <ul class="tutorial-tips">
                                <li>Keep node code focused — one node should do one thing well.</li>
                                <li>Add clear descriptions so others know what your node does.</li>
                                <li>Use meaningful input names like "targetX" instead of "x1".</li>
                                <li>Handle edge cases — check if inputs are valid before using them.</li>
                                <li>Test your nodes in different scenarios before publishing.</li>
                                <li>Version your packs — update the version number when making changes.</li>
                                <li>Add a "breaking" label if your update changes existing node behavior.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Community tutorials from issues -->
                <div class="tutorial-section">
                    <h3>🌐 Community Tutorials</h3>
                    <div class="community-grid" id="community-tutorials-grid">
                        <div class="community-loading-state">
                            <div class="auth-spinner"></div>
                            <p>Loading community tutorials...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ─── Import View ──────────────────────────────────────────────────

    _renderImportView() {
        return `
            <div class="community-import">
                <div class="section-header">
                    <h2>📥 Import Content</h2>
                </div>
                <div class="import-form">
                    <div class="form-group">
                        <label>Share Code</label>
                        <textarea id="import-share-code" placeholder="Paste the base64 share code here..." rows="4" style="font-family: var(--font-mono); font-size: 0.82rem;"></textarea>
                        <small class="form-hint">You can get share codes from community node packs and games.</small>
                    </div>
                    <div id="import-error" class="form-error"></div>
                    <div id="import-result" class="import-result hidden"></div>
                    <button class="btn btn-primary" id="import-btn">📥 Import</button>
                </div>
            </div>
        `;
    },

    // ─── Content Card ─────────────────────────────────────────────────

    _renderContentCard(item) {
        const typeIcons = { 'node-pack': '🧩', 'game': '🎮', 'tutorial': '📚' };
        const typeLabels = { 'node-pack': 'Node Pack', 'game': 'Game', 'tutorial': 'Tutorial' };
        const icon = typeIcons[item.type] || '📦';
        const typeLabel = typeLabels[item.type] || 'Content';
        const timeAgo = this._timeAgo(item.createdAt);
        const thumbsUp = item.ratings?.['+1'] || 0;
        const hearts = item.ratings?.heart || 0;
        const rockets = item.ratings?.rocket || 0;

        return `
            <div class="community-card" data-issue-number="${item.id}" onclick="CommunityUI._openDetail(${item.id})">
                <div class="community-card-header">
                    <div class="community-card-type">
                        <span>${icon}</span> ${typeLabel}
                    </div>
                    ${item.verified ? '<span class="community-badge verified">✓ Verified</span>' : ''}
                    ${item.breaking ? '<span class="community-badge breaking">⚠ Breaking</span>' : ''}
                </div>
                <div class="community-card-body">
                    <h3 class="community-card-title">${this._escapeHtml(item.name)}</h3>
                    <p class="community-card-desc">${this._escapeHtml(item.description || 'No description provided.')}</p>
                    ${item.category ? `<span class="community-card-category">${this._escapeHtml(item.category)}</span>` : ''}
                    ${item.nodeCount > 0 ? `<span class="community-card-node-count">${item.nodeCount} node${item.nodeCount !== 1 ? 's' : ''}</span>` : ''}
                </div>
                <div class="community-card-footer">
                    <div class="community-card-meta">
                        <img src="${item.avatarUrl}" alt="" class="community-card-avatar" onerror="this.style.display='none'">
                        <span>@${this._escapeHtml(item.author)}</span>
                        <span class="text-muted">· ${timeAgo}</span>
                    </div>
                    <div class="community-card-ratings">
                        ${thumbsUp > 0 ? `<span title="Thumbs up">👍 ${thumbsUp}</span>` : ''}
                        ${hearts > 0 ? `<span title="Hearts">❤️ ${hearts}</span>` : ''}
                        ${rockets > 0 ? `<span title="Rockets">🚀 ${rockets}</span>` : ''}
                        ${item.comments > 0 ? `<span title="Comments">💬 ${item.comments}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    },

    // ─── Detail Modal ─────────────────────────────────────────────────

    async _openDetail(issueNumber) {
        const modal = document.getElementById('community-detail-modal');
        const titleEl = document.getElementById('community-modal-title');
        const bodyEl = document.getElementById('community-modal-body');
        if (!modal || !titleEl || !bodyEl) return;

        modal.classList.remove('hidden');

        // Show loading
        bodyEl.innerHTML = '<div class="community-loading-state"><div class="auth-spinner"></div><p>Loading...</p></div>';

        try {
            // Fetch the issue details
            const issue = await CommunityHub._fetch(
                `/repos/${CommunityHub._repoOwner}/${CommunityHub._repoName}/issues/${issueNumber}`
            );
            const content = await CommunityHub._parseIssueToContent(issue);
            const comments = await CommunityHub.getComments(issueNumber);
            this._selectedContent = content;

            const typeIcons = { 'node-pack': '🧩', 'game': '🎮', 'tutorial': '📚' };
            const icon = typeIcons[content.type] || '📦';

            titleEl.textContent = content.name;

            let html = `
                <div class="detail-header">
                    <div class="detail-type-badge">${icon} ${content.type}</div>
                    <div class="detail-meta">
                        <img src="${content.avatarUrl}" alt="" class="community-card-avatar" onerror="this.style.display='none'">
                        <span>by @${this._escapeHtml(content.author)}</span>
                        <span class="text-muted">· v${content.version}</span>
                        <span class="text-muted">· ${this._timeAgo(content.createdAt)}</span>
                    </div>
                    ${content.verified ? '<span class="community-badge verified">✓ Verified</span>' : ''}
                    ${content.breaking ? '<span class="community-badge breaking">⚠ Breaking</span>' : ''}
                    ${content.category ? `<span class="community-card-category">${this._escapeHtml(content.category)}</span>` : ''}
                </div>

                <div class="detail-description">
                    <p>${this._escapeHtml(content.description || 'No description provided.').replace(/\n/g, '<br>')}</p>
                </div>

                ${content.nodeCount > 0 ? `<div class="detail-stat">🧩 ${content.nodeCount} node${content.nodeCount !== 1 ? 's' : ''}</div>` : ''}

                <!-- Ratings -->
                <div class="detail-ratings">
                    <span class="detail-ratings-label">Rate:</span>
                    <div class="detail-rating-buttons">
                        <button class="btn btn-sm btn-ghost rating-btn" data-reaction="+1" title="Thumbs up">👍 ${content.ratings?.['+1'] || 0}</button>
                        <button class="btn btn-sm btn-ghost rating-btn" data-reaction="heart" title="Love it">❤️ ${content.ratings?.heart || 0}</button>
                        <button class="btn btn-sm btn-ghost rating-btn" data-reaction="rocket" title="Awesome">🚀 ${content.ratings?.rocket || 0}</button>
                        <button class="btn btn-sm btn-ghost rating-btn" data-reaction="-1" title="Needs work">👎 ${content.ratings?.['-1'] || 0}</button>
                    </div>
                </div>

                ${content.shareCode ? `
                <!-- Download/Import -->
                <div class="detail-actions">
                    <button class="btn btn-accent" id="detail-download-btn">
                        ${content.type === 'node-pack' ? '📥 Import Node Pack' : '🎮 Import Game'}
                    </button>
                    <button class="btn btn-secondary" id="detail-copy-code-btn">📋 Copy Share Code</button>
                </div>
                ` : ''}

                <!-- Comments Section -->
                <div class="detail-comments">
                    <h3>💬 Comments (${comments.length})</h3>
                    ${CommunityHub.isAuthenticated() ? `
                        <div class="comment-form">
                            <textarea id="detail-comment-input" placeholder="Write a comment..." rows="2" maxlength="500"></textarea>
                            <button class="btn btn-sm btn-primary" id="detail-comment-submit">Post Comment</button>
                        </div>
                    ` : '<p class="text-muted">Login to comment.</p>'}
                    <div class="comments-list" id="detail-comments-list">
                        ${comments.length === 0 ? '<p class="text-muted">No comments yet. Be the first!</p>' : ''}
                        ${comments.map(c => `
                            <div class="comment-item">
                                <img src="${c.avatarUrl}" alt="" class="comment-avatar" onerror="this.style.display='none'">
                                <div class="comment-body">
                                    <div class="comment-meta">
                                        <span class="comment-author">@${this._escapeHtml(c.author)}</span>
                                        <span class="text-muted">${this._timeAgo(c.createdAt)}</span>
                                    </div>
                                    <div class="comment-text">${this._escapeHtml(c.body).replace(/\n/g, '<br>')}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <a href="${content.url}" target="_blank" rel="noopener" class="detail-github-link">
                    🔗 View on GitHub
                </a>
            `;

            bodyEl.innerHTML = html;

            // Bind rating buttons
            bodyEl.querySelectorAll('.rating-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const reaction = btn.dataset.reaction;
                    const result = await CommunityHub.rateContent(issueNumber, reaction);
                    if (result.success) {
                        // Refresh the detail
                        CommunityHub._clearCache();
                        this._openDetail(issueNumber);
                    } else {
                        this._showToast(result.error, 'error');
                    }
                });
            });

            // Bind download button
            const downloadBtn = document.getElementById('detail-download-btn');
            if (downloadBtn) {
                downloadBtn.addEventListener('click', async () => {
                    let result;
                    if (content.type === 'node-pack') {
                        result = await CommunityHub.downloadNodePack(issueNumber);
                    } else {
                        result = await CommunityHub.downloadGame(issueNumber);
                    }
                    if (result.success) {
                        this._showToast('Content imported successfully!', 'success');
                    } else {
                        this._showToast(result.error, 'error');
                    }
                });
            }

            // Bind copy share code button
            const copyBtn = document.getElementById('detail-copy-code-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', () => {
                    if (content.shareCode) {
                        navigator.clipboard.writeText(content.shareCode).then(() => {
                            copyBtn.textContent = '✅ Copied!';
                            setTimeout(() => { copyBtn.textContent = '📋 Copy Share Code'; }, 2000);
                        });
                    }
                });
            }

            // Bind comment submit
            const commentSubmit = document.getElementById('detail-comment-submit');
            if (commentSubmit) {
                commentSubmit.addEventListener('click', async () => {
                    const input = document.getElementById('detail-comment-input');
                    const text = input.value.trim();
                    if (!text) return;
                    commentSubmit.disabled = true;
                    const result = await CommunityHub.addComment(issueNumber, text);
                    commentSubmit.disabled = false;
                    if (result.success) {
                        input.value = '';
                        CommunityHub._clearCache();
                        this._openDetail(issueNumber);
                    } else {
                        this._showToast(result.error, 'error');
                    }
                });
            }

        } catch (err) {
            bodyEl.innerHTML = `<div class="community-empty-state"><p style="color: var(--danger);">Error loading content: ${this._escapeHtml(err.message)}</p></div>`;
        }
    },

    _closeDetail() {
        const modal = document.getElementById('community-detail-modal');
        if (modal) modal.classList.add('hidden');
    },

    // ─── Auth Modal ───────────────────────────────────────────────────

    _openAuthModal() {
        const modal = document.getElementById('community-auth-modal');
        const body = document.getElementById('community-auth-modal-body');
        if (!modal || !body) return;
        modal.classList.remove('hidden');
        DeviceFlow.renderAuthUI(body, (user) => {
            this._closeAuthModal();
            this._render();
            this._loadCurrentView();
            this._showToast(`Connected as @${user.login}`, 'success');
        });
    },

    _closeAuthModal() {
        const modal = document.getElementById('community-auth-modal');
        if (modal) modal.classList.add('hidden');
    },

    // ─── Data Loading ─────────────────────────────────────────────────

    async _loadCurrentView() {
        switch (this._currentView) {
            case 'browse':
                await this._loadBrowse();
                break;
            case 'my-content':
                await this._loadMyContent();
                break;
            case 'tutorials':
                await this._loadTutorials();
                break;
        }
    },

    async _loadBrowse() {
        const grid = document.getElementById('community-grid');
        if (!grid) return;

        grid.innerHTML = '<div class="community-loading-state"><div class="auth-spinner"></div><p>Loading...</p></div>';

        try {
            let items;
            if (this._searchQuery) {
                items = await CommunityHub.search(this._searchQuery, this._contentType);
            } else {
                const type = this._contentType === 'all' ? 'node-pack' : this._contentType;
                items = await CommunityHub.browseContent(type, null, this._sortBy, this._currentPage);
            }

            // If "all", also load games and merge
            if (this._contentType === 'all' && !this._searchQuery) {
                const games = await CommunityHub.browseContent('game', null, this._sortBy, this._currentPage);
                const tutorials = await CommunityHub.browseContent('tutorial', null, this._sortBy, this._currentPage);
                items = [...items, ...games, ...tutorials];
                // Sort by updatedAt desc
                items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                // Deduplicate
                const seen = new Set();
                items = items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
            }

            if (items.length === 0) {
                grid.innerHTML = `
                    <div class="community-empty-state">
                        <div class="empty-icon">🔍</div>
                        <h3>${this._searchQuery ? 'No results found' : 'No content yet'}</h3>
                        <p>${this._searchQuery ? 'Try a different search term.' : 'Be the first to publish community content!'}</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = items.map(item => this._renderContentCard(item)).join('');

            // Show pagination
            const pagination = document.getElementById('community-pagination');
            if (pagination && items.length >= this._itemsPerPage) {
                pagination.classList.remove('hidden');
            }
        } catch (err) {
            grid.innerHTML = `
                <div class="community-empty-state">
                    <div class="empty-icon">⚠️</div>
                    <h3>Error</h3>
                    <p>${this._escapeHtml(err.message)}</p>
                    <button class="btn btn-primary" onclick="CommunityUI._loadBrowse()">Retry</button>
                </div>
            `;
        }
    },

    async _loadMyContent() {
        const grid = document.getElementById('community-my-grid');
        if (!grid) return;
        const user = CommunityHub.getUserInfo();
        if (!user) return;

        grid.innerHTML = '<div class="community-loading-state"><div class="auth-spinner"></div><p>Loading...</p></div>';

        try {
            const items = await CommunityHub.getUserContent(user.login);
            if (items.length === 0) {
                grid.innerHTML = `
                    <div class="community-empty-state">
                        <div class="empty-icon">📂</div>
                        <h3>No content yet</h3>
                        <p>Start publishing node packs or games!</p>
                        <button class="btn btn-primary" onclick="CommunityUI._switchView('publish')">Create Content</button>
                    </div>
                `;
                return;
            }
            grid.innerHTML = items.map(item => this._renderContentCard(item)).join('');
        } catch (err) {
            grid.innerHTML = `<div class="community-empty-state"><p style="color: var(--danger);">${this._escapeHtml(err.message)}</p></div>`;
        }
    },

    async _loadTutorials() {
        const grid = document.getElementById('community-tutorials-grid');
        if (!grid) return;

        try {
            const items = await CommunityHub.browseTutorials();
            if (items.length === 0) {
                grid.innerHTML = '<p class="text-muted" style="padding: 1rem;">No community tutorials yet.</p>';
                return;
            }
            grid.innerHTML = items.map(item => this._renderContentCard(item)).join('');
        } catch (err) {
            grid.innerHTML = `<p class="text-muted" style="padding: 1rem;">Could not load community tutorials.</p>`;
        }
    },

    // ─── Event Binding ────────────────────────────────────────────────

    _bindEvents() {
        this._container.addEventListener('click', (e) => {
            // Tab navigation
            const tab = e.target.closest('.community-tab');
            if (tab) {
                this._switchView(tab.dataset.view);
                return;
            }

            // Content type filter
            const typeFilter = e.target.closest('[data-filter-type]');
            if (typeFilter) {
                this._contentType = typeFilter.dataset.filterType;
                this._currentPage = 1;
                CommunityHub._clearCache();
                this._render();
                this._loadBrowse();
                return;
            }

            // Sort filter
            const sortBtn = e.target.closest('[data-sort]');
            if (sortBtn) {
                this._sortBy = sortBtn.dataset.sort;
                this._currentPage = 1;
                CommunityHub._clearCache();
                this._render();
                this._loadBrowse();
                return;
            }

            // Pagination
            if (e.target.id === 'community-prev-page' && this._currentPage > 1) {
                this._currentPage--;
                this._render();
                this._loadBrowse();
                return;
            }
            if (e.target.id === 'community-next-page') {
                this._currentPage++;
                this._render();
                this._loadBrowse();
                return;
            }

            // Login buttons
            if (e.target.id === 'community-login-btn' || e.target.id === 'publish-login-btn' || e.target.id === 'mycontent-login-btn') {
                this._openAuthModal();
                return;
            }

            // Logout
            if (e.target.id === 'community-logout') {
                CommunityHub.logout();
                this._render();
                this._showToast('Disconnected from GitHub.', 'success');
                return;
            }

            // Modal close
            if (e.target.id === 'community-modal-close' || e.target.id === 'community-modal-backdrop') {
                this._closeDetail();
                return;
            }
            if (e.target.id === 'community-auth-modal-close' || e.target.id === 'community-auth-modal-backdrop') {
                this._closeAuthModal();
                return;
            }

            // Publish type toggle
            const publishType = e.target.closest('[data-publish-type]');
            if (publishType) {
                this._switchPublishType(publishType.dataset.publishType);
                return;
            }

            // Publish node pack
            if (e.target.id === 'publish-pack-btn') {
                this._publishNodePack();
                return;
            }

            // Publish game
            if (e.target.id === 'publish-game-btn') {
                this._publishGame();
                return;
            }

            // Import
            if (e.target.id === 'import-btn') {
                this._importShareCode();
                return;
            }
        });

        // Search input (debounced)
        let searchTimeout;
        this._container.addEventListener('input', (e) => {
            if (e.target.id === 'community-search') {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this._searchQuery = e.target.value.trim();
                    this._currentPage = 1;
                    CommunityHub._clearCache();
                    this._loadBrowse();
                }, 400);
            }
        });
    },

    _switchView(view) {
        this._currentView = view;
        this._render();
        this._bindEvents(); // Re-bind after re-render
        this._loadCurrentView();
    },

    _switchPublishType(type) {
        const nodeForm = document.getElementById('publish-node-pack-form');
        const gameForm = document.getElementById('publish-game-form');
        const buttons = this._container.querySelectorAll('.publish-type-btn');
        if (!nodeForm || !gameForm) return;

        buttons.forEach(b => {
            b.classList.remove('btn-primary', 'active');
            b.classList.add('btn-ghost');
        });
        const activeBtn = this._container.querySelector(`[data-publish-type="${type}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('btn-ghost');
            activeBtn.classList.add('btn-primary', 'active');
        }

        if (type === 'node-pack') {
            nodeForm.classList.remove('hidden');
            gameForm.classList.add('hidden');
        } else {
            nodeForm.classList.add('hidden');
            gameForm.classList.remove('hidden');
        }
    },

    async _publishNodePack() {
        const nameEl = document.getElementById('publish-pack-name');
        const descEl = document.getElementById('publish-pack-desc');
        const catEl = document.getElementById('publish-pack-category');
        const nodesEl = document.getElementById('publish-nodes-json');
        const errorEl = document.getElementById('publish-pack-error');
        const loadingEl = document.getElementById('publish-pack-loading');
        const btn = document.getElementById('publish-pack-btn');

        if (!nameEl || !descEl || !catEl || !nodesEl || !errorEl || !loadingEl || !btn) return;

        errorEl.style.display = 'none';
        loadingEl.style.display = 'flex';
        btn.disabled = true;

        let nodes;
        try {
            nodes = JSON.parse(nodesEl.value.trim());
        } catch (e) {
            errorEl.textContent = 'Invalid JSON in nodes field. Please check syntax.';
            errorEl.style.display = 'block';
            loadingEl.style.display = 'none';
            btn.disabled = false;
            return;
        }

        const result = await CommunityHub.publishNodePack(nameEl.value.trim(), descEl.value.trim(), nodes, catEl.value);

        loadingEl.style.display = 'none';
        btn.disabled = false;

        if (result.success) {
            this._showToast(`Published! Issue #${result.issueNumber}`, 'success');
            nameEl.value = '';
            descEl.value = '';
            nodesEl.value = '';
            CommunityHub._clearCache();
        } else {
            errorEl.textContent = result.error;
            errorEl.style.display = 'block';
        }
    },

    async _publishGame() {
        const nameEl = document.getElementById('publish-game-name');
        const descEl = document.getElementById('publish-game-desc');
        const catEl = document.getElementById('publish-game-category');
        const dataEl = document.getElementById('publish-game-data');
        const errorEl = document.getElementById('publish-game-error');
        const loadingEl = document.getElementById('publish-game-loading');
        const btn = document.getElementById('publish-game-btn');

        if (!nameEl || !descEl || !catEl || !errorEl || !loadingEl || !btn) return;

        errorEl.style.display = 'none';
        loadingEl.style.display = 'flex';
        btn.disabled = true;

        let gameData = {};
        if (dataEl && dataEl.value.trim()) {
            try {
                gameData = JSON.parse(dataEl.value.trim());
            } catch (e) {
                errorEl.textContent = 'Invalid JSON in game data field.';
                errorEl.style.display = 'block';
                loadingEl.style.display = 'none';
                btn.disabled = false;
                return;
            }
        }
        gameData.category = catEl.value;

        const result = await CommunityHub.publishGame(nameEl.value.trim(), descEl.value.trim(), gameData);

        loadingEl.style.display = 'none';
        btn.disabled = false;

        if (result.success) {
            this._showToast(`Published! Issue #${result.issueNumber}`, 'success');
            nameEl.value = '';
            descEl.value = '';
            if (dataEl) dataEl.value = '';
            CommunityHub._clearCache();
        } else {
            errorEl.textContent = result.error;
            errorEl.style.display = 'block';
        }
    },

    _importShareCode() {
        const input = document.getElementById('import-share-code');
        const errorEl = document.getElementById('import-error');
        const resultEl = document.getElementById('import-result');
        if (!input || !errorEl || !resultEl) return;

        errorEl.style.display = 'none';
        resultEl.classList.add('hidden');

        const code = input.value.trim();
        if (!code) {
            errorEl.textContent = 'Please paste a share code.';
            errorEl.style.display = 'block';
            return;
        }

        const result = CommunityHub.importFromShareCode(code);
        if (result.success) {
            resultEl.classList.remove('hidden');
            resultEl.innerHTML = `
                <h4>✅ Import Successful!</h4>
                <pre class="import-preview">${this._escapeHtml(JSON.stringify(result.data, null, 2))}</pre>
                <p class="text-muted">Content has been parsed. Use it in the Creator Studio.</p>
            `;
        } else {
            errorEl.textContent = result.error;
            errorEl.style.display = 'block';
        }
    },

    // ─── Toast Notifications ──────────────────────────────────────────

    _showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            padding: 0.75rem 1.25rem;
            background: ${type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--secondary)' : 'var(--primary)'};
            color: var(--text-primary);
            border-radius: var(--radius-sm);
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: var(--shadow-md);
            animation: chatFadeIn 0.3s ease;
            margin-top: 0.5rem;
            max-width: 400px;
        `;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // ─── Utilities ────────────────────────────────────────────────────

    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    _timeAgo(dateStr) {
        if (!dateStr) return '';
        const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months}mo ago`;
        const years = Math.floor(months / 12);
        return `${years}y ago`;
    },
};
