// ============================================
// BLOCKVERSE - Avatar Module
// ============================================
// Handles avatar customization (color, head/body shape, accessory)
// and renders a 2D front-view preview on a <canvas>.
// ============================================

const Avatar = (() => {
    'use strict';

    // ---- Current avatar configuration ----
    let _config = {
        bodyColor: '#3F51B5',
        headShape: 'default',
        bodyShape: 'default',
        accessory: 'none',
    };

    // ========================================
    //  Public API
    // ========================================

    /**
     * Initialize the avatar module.
     * - Load saved config for the current user.
     * - Populate colour picker, head/body/accessory selectors.
     * - Draw the initial preview.
     * - Wire up the save button.
     */
    function init() {
        _loadConfig();
        _populateColorPicker();
        _populateSelectors();
        _drawPreview();
        _setupSaveButton();
    }

    /** @returns {object} The current avatar config. */
    function getConfig() {
        return { ..._config };
    }

    /**
     * Set avatar config (partial or full).
     * @param {object} config
     */
    function setConfig(config) {
        _config = { ..._config, ...config };
        _drawPreview();
    }

    /**
     * Draw a 2D Roblox-like front-view avatar onto the given canvas.
     * Expected canvas size: 200 × 300.
     * @param {HTMLCanvasElement} [canvas]
     */
    function drawPreview(canvas) {
        canvas = canvas || document.getElementById('avatar-preview-canvas');
        if (!canvas) return;

        canvas.width = 200;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2; // horizontal centre

        ctx.clearRect(0, 0, w, h);

        // ---- Colour helpers ----
        const baseColor = _config.bodyColor;
        const darkerColor = _shadeColor(baseColor, -30);
        const lighterColor = _shadeColor(baseColor, 30);

        // ---- Dimensions (relative to canvas centre) ----
        let headW = 56, headH = 56, headR = 12;
        let bodyW = 48, bodyH = 60;
        let armW = 16, armH = 50;
        let legW = 20, legH = 40;

        // Head shape tweaks
        switch (_config.bodyShape) {
            case 'pointy': headR = 4; break;
            case 'round': headR = 28; break;
            case 'square': headR = 2; break;
            default: headR = 12;
        }
        switch (_config.headShape) {
            case 'round': headR = 28; break;
            case 'square': headR = 2; headW = 60; headH = 60; break;
            case 'pointy': headR = 4; headH = 64; break;
            default: headR = 12;
        }

        // Body shape tweaks
        switch (_config.bodyShape) {
            case 'slim': bodyW = 36; break;
            case 'wide': bodyW = 64; break;
            case 'tall': bodyH = 76; break;
            default: break;
        }

        // ---- Vertical layout positions ----
        const headTop = 30;
        const headBottom = headTop + headH;
        const bodyTop = headBottom + 4;
        const bodyBottom = bodyTop + bodyH;
        const legTop = bodyBottom;
        const legBottom = legTop + legH;

        // ---- Draw cape / wings (behind body) ----
        if (_config.accessory === 'cape') {
            ctx.save();
            ctx.fillStyle = darkerColor;
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(cx - bodyW / 2 - 6, bodyTop - 4);
            ctx.lineTo(cx - bodyW / 2 - 14, legBottom + 10);
            ctx.lineTo(cx + bodyW / 2 + 14, legBottom + 10);
            ctx.lineTo(cx + bodyW / 2 + 6, bodyTop - 4);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        if (_config.accessory === 'wings') {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.strokeStyle = lighterColor;
            ctx.lineWidth = 1.5;
            // Left wing
            ctx.beginPath();
            ctx.moveTo(cx - bodyW / 2 - 2, bodyTop + 10);
            ctx.quadraticCurveTo(cx - bodyW / 2 - 36, bodyTop - 20, cx - bodyW / 2 - 28, bodyTop + 40);
            ctx.quadraticCurveTo(cx - bodyW / 2 - 10, bodyTop + 30, cx - bodyW / 2 - 2, bodyTop + 50);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Right wing
            ctx.beginPath();
            ctx.moveTo(cx + bodyW / 2 + 2, bodyTop + 10);
            ctx.quadraticCurveTo(cx + bodyW / 2 + 36, bodyTop - 20, cx + bodyW / 2 + 28, bodyTop + 40);
            ctx.quadraticCurveTo(cx + bodyW / 2 + 10, bodyTop + 30, cx + bodyW / 2 + 2, bodyTop + 50);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // ---- Arms ----
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 4;
        // Left arm
        _roundRect(ctx, cx - bodyW / 2 - armW - 2, bodyTop + 4, armW, armH, 4, darkerColor);
        // Right arm
        _roundRect(ctx, cx + bodyW / 2 + 2, bodyTop + 4, armW, armH, 4, darkerColor);
        ctx.restore();

        // ---- Legs ----
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 4;
        _roundRect(ctx, cx - legW - 2, legTop, legW, legH, 4, darkerColor);
        _roundRect(ctx, cx + 2, legTop, legW, legH, 4, darkerColor);
        ctx.restore();

        // ---- Body ----
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 8;
        _roundRect(ctx, cx - bodyW / 2, bodyTop, bodyW, bodyH, 6, baseColor);
        // Subtle gradient overlay
        const bodyGrad = ctx.createLinearGradient(cx - bodyW / 2, bodyTop, cx + bodyW / 2, bodyBottom);
        bodyGrad.addColorStop(0, 'rgba(255,255,255,0.12)');
        bodyGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
        ctx.fillStyle = bodyGrad;
        _roundRect(ctx, cx - bodyW / 2, bodyTop, bodyW, bodyH, 6, bodyGrad);
        ctx.restore();

        // ---- Head ----
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 10;
        _roundRect(ctx, cx - headW / 2, headTop, headW, headH, headR, baseColor);
        // Highlight
        const headGrad = ctx.createLinearGradient(cx - headW / 2, headTop, cx + headW / 2, headBottom);
        headGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
        headGrad.addColorStop(1, 'rgba(0,0,0,0.05)');
        ctx.fillStyle = headGrad;
        _roundRect(ctx, cx - headW / 2, headTop, headW, headH, headR, headGrad);
        ctx.restore();

        // ---- Eyes ----
        const eyeY = headTop + headH * 0.42;
        const eyeSpacing = headW * 0.2;
        const eyeR = 6;
        // Whites
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(cx - eyeSpacing + 1, eyeY + 1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + eyeSpacing + 1, eyeY + 1, 3, 0, Math.PI * 2);
        ctx.fill();

        // ---- Smile ----
        const smileY = headTop + headH * 0.72;
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, smileY - 4, 8, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();

        // ---- Accessories drawn ON TOP of head ----
        if (_config.accessory === 'hat') {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 6;
            ctx.fillStyle = darkerColor;
            // Brim
            _roundRect(ctx, cx - headW / 2 - 8, headTop - 2, headW + 16, 6, 3, darkerColor);
            // Cone
            ctx.beginPath();
            ctx.moveTo(cx - headW / 2 + 8, headTop - 2);
            ctx.lineTo(cx, headTop - 32);
            ctx.lineTo(cx + headW / 2 - 8, headTop - 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        if (_config.accessory === 'crown') {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 6;
            const crownY = headTop - 6;
            const crownW = headW * 0.8;
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.moveTo(cx - crownW / 2, crownY + 16);
            ctx.lineTo(cx - crownW / 2, crownY);
            ctx.lineTo(cx - crownW / 4, crownY + 10);
            ctx.lineTo(cx, crownY - 4);
            ctx.lineTo(cx + crownW / 4, crownY + 10);
            ctx.lineTo(cx + crownW / 2, crownY);
            ctx.lineTo(cx + crownW / 2, crownY + 16);
            ctx.closePath();
            ctx.fill();
            // Gems
            ctx.fillStyle = '#E74C3C';
            ctx.beginPath();
            ctx.arc(cx, crownY + 8, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        if (_config.accessory === 'horns') {
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.2)';
            ctx.shadowBlur = 4;
            ctx.fillStyle = '#C0392B';
            // Left horn
            ctx.beginPath();
            ctx.moveTo(cx - headW / 2 + 4, headTop + 2);
            ctx.lineTo(cx - headW / 2 - 8, headTop - 20);
            ctx.lineTo(cx - headW / 2 + 14, headTop + 2);
            ctx.closePath();
            ctx.fill();
            // Right horn
            ctx.beginPath();
            ctx.moveTo(cx + headW / 2 - 4, headTop + 2);
            ctx.lineTo(cx + headW / 2 + 8, headTop - 20);
            ctx.lineTo(cx + headW / 2 - 14, headTop + 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    /**
     * Persist current avatar config to the logged-in user's localStorage record.
     */
    function saveAvatar() {
        if (!Auth.isLoggedIn()) {
            Utils.showToast('You must be logged in to save your avatar', 'error');
            return;
        }
        Auth.updateUserData(Auth.getCurrentUser(), { avatar: getConfig() });
        Utils.showToast('Avatar saved!', 'success');
    }

    /**
     * Return an HTML string for a small avatar display element.
     * @param {string} username
     * @param {'small'|'medium'|'large'} [size='medium']
     * @returns {string}
     */
    function getAvatarHTML(username, size = 'medium') {
        const sizeMap = { small: 32, medium: 48, large: 64 };
        const px = sizeMap[size] || 48;
        const userData = Auth.getUserData(username);
        const color = (userData && userData.avatar) ? userData.avatar.bodyColor : '#607D8B';
        const letter = (username || '?')[0].toUpperCase();
        return `<div class="avatar-circle avatar-${size}" style="width:${px}px;height:${px}px;background:${color};display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:700;font-size:${px * 0.42}px;text-shadow:0 1px 2px rgba(0,0,0,0.4);">${letter}</div>`;
    }

    // ========================================
    //  Private helpers
    // ========================================

    /** Load avatar config from the current user's stored data. */
    function _loadConfig() {
        if (!Auth.isLoggedIn()) return;
        const data = Auth.getUserData(Auth.getCurrentUser());
        if (data && data.avatar) {
            _config = { ..._config, ...data.avatar };
        }
    }

    /** Populate the colour picker grid in #avatar-body-colors. */
    function _populateColorPicker() {
        const container = document.getElementById('avatar-body-colors');
        if (!container) return;
        container.innerHTML = '';

        BV.AVATAR_COLORS.forEach((color) => {
            const el = document.createElement('div');
            el.className = 'color-circle';
            el.style.background = color;
            if (color.toLowerCase() === _config.bodyColor.toLowerCase()) {
                el.classList.add('active');
            }
            el.addEventListener('click', () => {
                container.querySelectorAll('.color-circle').forEach((c) => c.classList.remove('active'));
                el.classList.add('active');
                _config.bodyColor = color;
                _drawPreview();
            });
            container.appendChild(el);
        });
    }

    /** Populate head, body, and accessory selectors from BV.AVATAR_PARTS. */
    function _populateSelectors() {
        _populateOptionRow('avatar-head-options', BV.AVATAR_PARTS.head, 'headShape');
        _populateOptionRow('avatar-body-options', BV.AVATAR_PARTS.body, 'bodyShape');
        _populateOptionRow('avatar-accessory-options', BV.AVATAR_PARTS.accessory, 'accessory');
    }

    /**
     * Fill a div container with option buttons and wire click events.
     * @param {string} containerId
     * @param {string[]} options
     * @param {string} configKey
     */
    function _populateOptionRow(containerId, options, configKey) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            if (opt === _config[configKey]) btn.classList.add('selected');
            btn.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
            btn.addEventListener('click', () => {
                container.querySelectorAll('.option-btn').forEach((b) => b.classList.remove('selected'));
                btn.classList.add('selected');
                _config[configKey] = opt;
                _drawPreview();
            });
            container.appendChild(btn);
        });
    }

    /** Convenience: call drawPreview(). */
    function _drawPreview() {
        drawPreview();
    }

    /** Wire up the save avatar button. */
    function _setupSaveButton() {
        const btn = document.getElementById('btn-save-avatar');
        if (btn) {
            btn.addEventListener('click', saveAvatar);
        }
    }

    /**
     * Darken or lighten a hex colour.
     * @param {string} hex
     * @param {number} percent  Negative to darken, positive to lighten.
     * @returns {string}
     */
    function _shadeColor(hex, percent) {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r = Math.min(255, Math.max(0, r + Math.round(r * (percent / 100))));
        g = Math.min(255, Math.max(0, g + Math.round(g * (percent / 100))));
        b = Math.min(255, Math.max(0, b + Math.round(b * (percent / 100))));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    /**
     * Draw a rounded rectangle.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @param {number} r  Corner radius.
     * @param {string|CanvasGradient} fill
     */
    function _roundRect(ctx, x, y, w, h, r, fill) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    }

    // ========================================
    //  Return the public interface
    // ========================================
    return {
        init,
        getConfig,
        setConfig,
        drawPreview,
        saveAvatar,
        getAvatarHTML,
    };
})();
