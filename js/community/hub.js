/**
 * BlockVerse Community Hub - GitHub Issues Client
 * Uses GitHub Issues API as a free database for community content.
 * Supports browsing, publishing, rating, and commenting on node packs, games, and tutorials.
 */

const CommunityHub = {
    _apiBase: 'https://api.github.com',
    _repoOwner: 'TheStrongestOfTomorrow',
    _repoName: 'blockverse-community',
    _token: null,
    _username: null,
    _cacheTTL: 5 * 60 * 1000, // 5 minutes

    // ─── Initialization ───────────────────────────────────────────────

    /**
     * Initialize the hub. Optionally pass a token and username to skip auth.
     */
    init(token, username) {
        if (token) {
            this._token = token;
            sessionStorage.setItem('bv_community_token', token);
        } else {
            this._token = sessionStorage.getItem('bv_community_token') || null;
        }
        if (username) {
            this._username = username;
            sessionStorage.setItem('bv_community_username', username);
        } else {
            this._username = sessionStorage.getItem('bv_community_username') || null;
        }
    },

    // ─── Authentication ───────────────────────────────────────────────

    /**
     * Authenticate with a GitHub Personal Access Token.
     * Token needs `public_repo` scope (for public repo access).
     */
    async authWithPAT(token) {
        try {
            // Validate token by fetching user info
            const user = await this._fetch('/user');
            if (user.login) {
                this._token = token;
                this._username = user.login;
                sessionStorage.setItem('bv_community_token', token);
                sessionStorage.setItem('bv_community_username', user.login);
                sessionStorage.setItem('bv_community_user_info', JSON.stringify({
                    login: user.login,
                    id: user.id,
                    avatar_url: user.avatar_url,
                    name: user.name || user.login,
                }));
                return { success: true, user: { login: user.login, avatar_url: user.avatar_url, name: user.name } };
            }
            return { success: false, error: 'Token is invalid or has insufficient permissions.' };
        } catch (err) {
            return { success: false, error: err.message || 'Authentication failed.' };
        }
    },

    /**
     * Start GitHub Device Flow.
     * Delegates to the DeviceFlow module which handles the full flow:
     *   1. Request device code from GitHub
     *   2. User enters code at github.com/login/device
     *   3. Poll for authorization
     *   4. Return access token
     *
     * Requires a registered OAuth App client_id (configurable in the auth UI).
     * Falls back to PAT if not configured.
     */
    async startDeviceFlow() {
        if (!DeviceFlow.isAvailable()) {
            return {
                success: false,
                type: 'no-client',
                message: 'Device Flow requires an OAuth App client_id. Please configure one in the auth settings, or use a Personal Access Token (PAT) instead.',
            };
        }
        // Delegate to DeviceFlow module
        return await DeviceFlow.requestDeviceCode();
    },

    /**
     * Poll GitHub device flow for authorization.
     * Delegates to the DeviceFlow module.
     *
     * @param {string} deviceCode - The device_code from startDeviceFlow()
     * @param {function} onPolling - Optional callback for poll status updates
     * @param {number} interval - Polling interval in seconds
     */
    async pollDeviceFlow(deviceCode, onPolling, interval) {
        if (!DeviceFlow.isAvailable()) {
            return { success: false, error: 'Device Flow is not configured. Please use PAT authentication.' };
        }
        return await DeviceFlow.pollForToken(deviceCode, onPolling, interval);
    },

    /** Check if currently authenticated */
    isAuthenticated() {
        return !!(this._token && this._username);
    },

    /** Get current user info from cache */
    getUserInfo() {
        const cached = sessionStorage.getItem('bv_community_user_info');
        if (cached) {
            try { return JSON.parse(cached); } catch (e) { /* ignore */ }
        }
        return null;
    },

    /** Logout — clear cached credentials */
    logout() {
        this._token = null;
        this._username = null;
        sessionStorage.removeItem('bv_community_token');
        sessionStorage.removeItem('bv_community_username');
        sessionStorage.removeItem('bv_community_user_info');
        // Clear issue caches
        this._clearCache();
    },

    // ─── Cache helpers ────────────────────────────────────────────────

    _getCacheKey(key) {
        return `bv_cache_${key}`;
    },

    _getCached(key) {
        try {
            const raw = sessionStorage.getItem(this._getCacheKey(key));
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (Date.now() - entry.ts < this._cacheTTL) return entry.data;
            sessionStorage.removeItem(this._getCacheKey(key));
            return null;
        } catch (e) { return null; }
    },

    _setCache(key, data) {
        try {
            sessionStorage.setItem(this._getCacheKey(key), JSON.stringify({ data, ts: Date.now() }));
        } catch (e) { /* sessionStorage full, ignore */ }
    },

    _clearCache() {
        const keys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && k.startsWith('bv_cache_')) keys.push(k);
        }
        keys.forEach(k => sessionStorage.removeItem(k));
    },

    // ─── Fetch helper ─────────────────────────────────────────────────

    async _fetch(endpoint, options = {}) {
        const url = endpoint.startsWith('http') ? endpoint : `${this._apiBase}${endpoint}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            ...options.headers,
        };
        if (this._token) {
            headers['Authorization'] = `Bearer ${this._token}`;
        }
        const response = await fetch(url, { ...options, headers });
        // Handle rate limiting
        if (response.status === 403) {
            const data = await response.json().catch(() => ({}));
            if (data.message && data.message.includes('rate limit')) {
                throw new Error('GitHub API rate limit reached. Please wait a few minutes and try again, or authenticate for 5000 requests/hour.');
            }
        }
        if (response.status === 401) {
            throw new Error('Authentication failed. Your token may have expired.');
        }
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || `GitHub API error: ${response.status}`);
        }
        return response.json();
    },

    // ─── Content type labels ──────────────────────────────────────────

    _contentTypeLabels: {
        'node-pack': 'node-pack',
        'game': 'game-share',
        'tutorial': 'tutorial',
    },

    // ─── Browse / Search ──────────────────────────────────────────────

    /**
     * Browse content by type.
     * @param {'node-pack'|'game'|'tutorial'} type
     * @param {string} category - Optional category filter
     * @param {'newest'|'popular'|'recently-updated'} sort
     * @param {number} page - 1-indexed
     */
    async browseContent(type, category, sort, page) {
        const label = this._contentTypeLabels[type] || type;
        let cacheKey = `browse_${type}_${category || 'all'}_${sort || 'newest'}_${page || 1}`;
        const cached = this._getCached(cacheKey);
        if (cached) return cached;

        const params = new URLSearchParams({
            labels: label,
            state: 'open',
            per_page: '12',
            page: String(page || 1),
        });
        if (sort === 'newest') params.set('sort', 'created');
        else if (sort === 'recently-updated') params.set('sort', 'updated');
        else if (sort === 'popular') params.set('sort', 'comments'); // comments as popularity proxy
        params.set('direction', 'desc');

        const data = await this._fetch(`/repos/${this._repoOwner}/${this._repoName}/issues?${params}`);
        const items = await Promise.all(data.map(issue => this._parseIssueToContent(issue)));

        // Client-side category filter
        let filtered = items;
        if (category && category !== 'all') {
            filtered = items.filter(item => {
                const itemCats = (item.categories || []).map(c => c.toLowerCase());
                return itemCats.includes(category.toLowerCase());
            });
        }

        this._setCache(cacheKey, filtered);
        return filtered;
    },

    /** Shorthand: Browse node packs */
    async browseNodePacks(category, sort, page) {
        return this.browseContent('node-pack', category, sort, page);
    },

    /** Shorthand: Browse shared games */
    async browseGames(category, sort, page) {
        return this.browseContent('game', category, sort, page);
    },

    /** Shorthand: Browse tutorials */
    async browseTutorials(category, page) {
        return this.browseContent('tutorial', category, 'newest', page);
    },

    /**
     * Full-text search across all community content.
     * @param {string} query
     * @param {'node-pack'|'game'|'tutorial'|'all'} type
     */
    async search(query, type) {
        if (!query || query.trim().length === 0) return [];
        const cacheKey = `search_${query}_${type || 'all'}`;
        const cached = this._getCached(cacheKey);
        if (cached) return cached;

        const q = `${query} repo:${this._repoOwner}/${this._repoName} is:issue is:open`;
        const params = new URLSearchParams({ q });
        if (type && type !== 'all') {
            const label = this._contentTypeLabels[type] || type;
            params.set('q', `${q} label:${label}`);
        }

        const data = await this._fetch(`/search/issues?${params}`);
        const items = await Promise.all(
            (data.items || []).map(issue => this._parseIssueToContent(issue))
        );

        this._setCache(cacheKey, items);
        return items;
    },

    // ─── Publish Content ──────────────────────────────────────────────

    /**
     * Publish a node pack as a GitHub Issue.
     */
    async publishNodePack(name, description, nodes, category) {
        if (!this.isAuthenticated()) {
            return { success: false, error: 'You must be logged in to publish content.' };
        }
        if (!name || name.trim().length === 0) {
            return { success: false, error: 'Name is required.' };
        }
        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
            return { success: false, error: 'At least one node is required.' };
        }

        // Generate a share code (base64 of the nodes JSON)
        const shareCode = btoa(unescape(encodeURIComponent(JSON.stringify(nodes))));

        const labels = ['node-pack'];
        if (category) labels.push(category.toLowerCase());

        const title = `[NODE PACK] ${name.trim()}`;
        const body = this._contentToIssueBody({
            type: 'node-pack',
            name: name.trim(),
            description: description || '',
            author: this._username,
            version: '1.0',
            category: category || 'General',
            nodes,
            shareCode,
        });

        try {
            const issue = await this._fetch(`/repos/${this._repoOwner}/${this._repoName}/issues`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, labels }),
            });
            this._clearCache();
            return { success: true, issueNumber: issue.number, url: issue.html_url };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * Publish a game as a GitHub Issue.
     */
    async publishGame(name, description, gameData) {
        if (!this.isAuthenticated()) {
            return { success: false, error: 'You must be logged in to publish content.' };
        }

        const shareCode = btoa(unescape(encodeURIComponent(JSON.stringify(gameData || {}))));
        const title = `[GAME] ${name.trim()}`;
        const body = this._contentToIssueBody({
            type: 'game',
            name: name.trim(),
            description: description || '',
            author: this._username,
            version: '1.0',
            category: gameData?.category || 'General',
            shareCode,
        });

        try {
            const labels = ['game-share'];
            if (gameData?.category) labels.push(gameData.category.toLowerCase());
            const issue = await this._fetch(`/repos/${this._repoOwner}/${this._repoName}/issues`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, body, labels }),
            });
            this._clearCache();
            return { success: true, issueNumber: issue.number, url: issue.html_url };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    // ─── Download / Import Content ────────────────────────────────────

    /**
     * Download a node pack from an issue.
     */
    async downloadNodePack(issueNumber) {
        const issue = await this._fetch(`/repos/${this._repoOwner}/${this._repoName}/issues/${issueNumber}`);
        const content = this._parseIssueToContent(issue);
        if (content.type === 'node-pack' && content.shareCode) {
            try {
                const decoded = JSON.parse(decodeURIComponent(escape(atob(content.shareCode))));
                return { success: true, nodes: decoded, content };
            } catch (e) {
                return { success: false, error: 'Failed to decode node pack data.' };
            }
        }
        return { success: false, error: 'This issue does not contain a valid node pack.' };
    },

    /**
     * Download a game from an issue.
     */
    async downloadGame(issueNumber) {
        const issue = await this._fetch(`/repos/${this._repoOwner}/${this._repoName}/issues/${issueNumber}`);
        const content = this._parseIssueToContent(issue);
        if (content.type === 'game' && content.shareCode) {
            try {
                const decoded = JSON.parse(decodeURIComponent(escape(atob(content.shareCode))));
                return { success: true, gameData: decoded, content };
            } catch (e) {
                return { success: false, error: 'Failed to decode game data.' };
            }
        }
        return { success: false, error: 'This issue does not contain valid game data.' };
    },

    /** Import content from a base64 share code */
    importFromShareCode(shareCode) {
        try {
            const decoded = JSON.parse(decodeURIComponent(escape(atob(shareCode.trim()))));
            return { success: true, data: decoded };
        } catch (e) {
            return { success: false, error: 'Invalid share code. Please check and try again.' };
        }
    },

    // ─── Ratings (GitHub Reactions) ───────────────────────────────────

    /**
     * Rate content using GitHub Reactions API.
     * @param {number} issueNumber
     * @param {'+1'|'-1'|'heart'|'rocket'|'eyes'|'hooray'} reaction
     */
    async rateContent(issueNumber, reaction) {
        if (!this.isAuthenticated()) {
            return { success: false, error: 'You must be logged in to rate content.' };
        }
        const allowedReactions = ['+1', '-1', 'heart', 'rocket', 'eyes', 'hooray'];
        if (!allowedReactions.includes(reaction)) {
            return { success: false, error: `Invalid reaction type. Allowed: ${allowedReactions.join(', ')}` };
        }
        try {
            const result = await this._fetch(
                `/repos/${this._repoOwner}/${this._repoName}/issues/${issueNumber}/reactions`,
                {
                    method: 'POST',
                    headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' },
                    body: JSON.stringify({ content: reaction }),
                }
            );
            return { success: true, reaction: result };
        } catch (err) {
            if (err.message && err.message.includes('already exists')) {
                return { success: false, error: 'You have already reacted with this.' };
            }
            return { success: false, error: err.message };
        }
    },

    /**
     * Get all ratings/reactions for an issue.
     */
    async getRatings(issueNumber) {
        try {
            const reactions = await this._fetch(
                `/repos/${this._repoOwner}/${this._repoName}/issues/${issueNumber}/reactions`,
                { headers: { 'Accept': 'application/vnd.github.squirrel-girl-preview+json' } }
            );
            const summary = {
                total: reactions.length,
                '+1': 0,
                '-1': 0,
                heart: 0,
                rocket: 0,
                eyes: 0,
                hooray: 0,
                userReactions: [],
            };
            reactions.forEach(r => {
                if (summary[r.content] !== undefined) summary[r.content]++;
            });
            // If authenticated, find user's own reactions
            if (this.isAuthenticated()) {
                summary.userReactions = reactions
                    .filter(r => r.user && r.user.login === this._username)
                    .map(r => r.content);
            }
            return summary;
        } catch (err) {
            return { total: 0, error: err.message };
        }
    },

    // ─── Comments ─────────────────────────────────────────────────────

    /**
     * Add a comment to an issue.
     */
    async addComment(issueNumber, comment) {
        if (!this.isAuthenticated()) {
            return { success: false, error: 'You must be logged in to comment.' };
        }
        if (!comment || comment.trim().length === 0) {
            return { success: false, error: 'Comment cannot be empty.' };
        }
        try {
            const result = await this._fetch(
                `/repos/${this._repoOwner}/${this._repoName}/issues/${issueNumber}/comments`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ body: comment.trim() }),
                }
            );
            return { success: true, comment: result };
        } catch (err) {
            return { success: false, error: err.message };
        }
    },

    /**
     * Get comments for an issue.
     */
    async getComments(issueNumber) {
        try {
            const comments = await this._fetch(
                `/repos/${this._repoOwner}/${this._repoName}/issues/${issueNumber}/comments?per_page=50&sort=created&direction=desc`
            );
            return comments.map(c => ({
                id: c.id,
                author: c.user?.login || 'Unknown',
                avatarUrl: c.user?.avatar_url || '',
                body: c.body,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
                htmlUrl: c.html_url,
            }));
        } catch (err) {
            return [];
        }
    },

    // ─── User Content ─────────────────────────────────────────────────

    /**
     * Get all content published by a user.
     */
    async getUserContent(username) {
        const cacheKey = `user_${username}`;
        const cached = this._getCached(cacheKey);
        if (cached) return cached;

        try {
            const params = new URLSearchParams({
                creator: username,
                state: 'open',
                per_page: '30',
                sort: 'created',
                direction: 'desc',
            });
            const issues = await this._fetch(`/repos/${this._repoOwner}/${this._repoName}/issues?${params}`);
            // Filter to only content-type issues (exclude bug reports, feature requests, etc.)
            const contentLabels = Object.values(this._contentTypeLabels);
            const contentIssues = issues.filter(issue => {
                const labels = issue.labels || [];
                return labels.some(l => contentLabels.includes(l.name));
            });
            const items = await Promise.all(contentIssues.map(i => this._parseIssueToContent(i)));
            this._setCache(cacheKey, items);
            return items;
        } catch (err) {
            return [];
        }
    },

    // ─── Parse Issue → Content ────────────────────────────────────────

    async _parseIssueToContent(issue) {
        const labels = (issue.labels || []).map(l => l.name);
        let type = 'unknown';

        if (labels.includes('node-pack')) type = 'node-pack';
        else if (labels.includes('game-share')) type = 'game';
        else if (labels.includes('tutorial')) type = 'tutorial';

        // Extract metadata from the issue body
        const body = issue.body || '';
        let metadata = {};
        try {
            // Try to find frontmatter-like metadata
            const authorMatch = body.match(/\*\*Author:\*\*\s*@?(\S+)/i);
            const versionMatch = body.match(/\*\*Version:\*\*\s*([\d.]+)/i);
            const categoryMatch = body.match(/\*\*Category:\*\*\s*(.+)/i);
            const nodeCountMatch = body.match(/\*\*Nodes?:\*\*\s*(\d+)/i);
            const shareCodeMatch = body.match(/`([A-Za-z0-9+/=]{20,})`/);

            metadata = {
                author: authorMatch ? authorMatch[1] : issue.user?.login || 'Unknown',
                version: versionMatch ? versionMatch[1] : '1.0',
                category: categoryMatch ? categoryMatch[1].trim() : 'General',
                nodeCount: nodeCountMatch ? parseInt(nodeCountMatch[1]) : 0,
                shareCode: shareCodeMatch ? shareCodeMatch[1] : null,
            };

            // Extract description section
            const descMatch = body.match(/###\s*Description\s*\n([\s\S]*?)(?=\n###|\n```|$)/i);
            if (descMatch) {
                metadata.description = descMatch[1].trim();
            }

            // Extract JSON nodes if present
            const jsonMatch = body.match(/```json\s*\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                try {
                    metadata.nodes = JSON.parse(jsonMatch[1].trim());
                    metadata.nodeCount = metadata.nodes.length;
                } catch (e) { /* invalid JSON, skip */ }
            }
        } catch (e) { /* parse error, use defaults */ }

        // Get ratings
        let ratings = { total: 0, '+1': 0, heart: 0, rocket: 0 };
        try {
            ratings = await this.getRatings(issue.number);
        } catch (e) { /* ratings unavailable */ }

        // Determine the name from the title
        let name = issue.title;
        const prefixMatch = issue.title.match(/^\[(NODE PACK|GAME|TUTORIAL)\]\s*(.+)/i);
        if (prefixMatch) {
            name = prefixMatch[2].trim();
        }

        // Extract categories from labels (non-type labels)
        const typeLabels = new Set(Object.values(this._contentTypeLabels));
        const extraLabels = new Set(['verified', 'breaking', 'bug-report', 'feature-request']);
        const categories = labels.filter(l => !typeLabels.has(l) && !extraLabels.has(l));

        return {
            id: issue.number,
            name,
            type,
            description: metadata.description || '',
            author: metadata.author,
            version: metadata.version,
            category: metadata.category,
            categories,
            nodes: metadata.nodes || null,
            nodeCount: metadata.nodeCount,
            shareCode: metadata.shareCode,
            ratings,
            comments: issue.comments || 0,
            verified: labels.includes('verified'),
            breaking: labels.includes('breaking'),
            createdAt: issue.created_at,
            updatedAt: issue.updated_at,
            url: issue.html_url,
            avatarUrl: issue.user?.avatar_url || '',
            labels,
        };
    },

    // ─── Content → Issue Body ─────────────────────────────────────────

    _contentToIssueBody(content) {
        const { type, name, description, author, version, category, nodes, shareCode } = content;
        const typeLabel = type === 'node-pack' ? 'Node Pack' : type === 'game' ? 'Game' : 'Tutorial';
        const nodeCount = nodes ? nodes.length : 0;

        let body = `## ${typeLabel}: ${name}\n\n`;
        body += `**Author:** @${author}\n`;
        body += `**Version:** ${version}\n`;
        body += `**Category:** ${category}\n`;

        if (type === 'node-pack') {
            body += `**Nodes:** ${nodeCount}\n`;
        }

        body += `\n### Description\n${description}\n`;

        if (type === 'node-pack' && nodes && nodes.length > 0) {
            body += `\n### Nodes\n\`\`\`json\n${JSON.stringify(nodes, null, 2)}\n\`\`\`\n`;
        }

        if (shareCode) {
            body += `\n### Installation\n`;
            body += `Copy the share code below and paste it in BlockVerse Creator → My Blocks → Import:\n`;
            body += `\`${shareCode}\`\n`;
        }

        body += `\n---\n*Published via BlockVerse Community Hub*`;
        return body;
    },
};
