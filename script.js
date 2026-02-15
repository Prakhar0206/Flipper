/**
 * Flipper - Premium Coin Flip Simulator
 * @author Prakhar Aggarwal
 */
class CoinFlipSimulator {
    constructor() {
        // Constants (8, 48)
        this.ANIMATION_DURATION = 3000;
        this.ANIMATION_DURATION_REDUCED = 500;
        this.SETTLE_DURATION = 300;
        this.STATS_UPDATE_DURATION = 400;
        this.SHAKE_DURATION = 500;
        this.THEME_DEBOUNCE = 500;
        this.ARIA_TIMEOUT = 1000;
        this.MAX_ROTATION = 100000;
        this.LEFT_ZONE = 0.25;
        this.RIGHT_ZONE = 0.75;
        this.DOUBLE_TAP_DELAY = 300;

        // Elements mapping
        this.elementIds = [
            'coin', 'flipBtn', 'resetBtn', 'resultLabel', 'shadow',
            'headsCount', 'tailsCount', 'themeToggle', 'confirmOverlay',
            'confirmHeads', 'confirmTails', 'confirmCancel', 'confirmReset',
            'confirmIcon', 'ariaLive', 'themeIcon'
        ];

        this.elements = {};

        // Element Validation (12)
        try {
            this.elementIds.forEach(id => {
                const el = document.getElementById(id);
                if (!el) throw new Error(`Missing DOM element: ${id}`);
                this.elements[id] = el;
            });
        } catch (error) {
            console.error('Initialization failed:', error);
            // In production, might want to show a UI error here
            return;
        }

        // State
        this.state = {
            isFlipping: false,
            currentRotation: 0,
            stats: this.loadStats(), // (14, 15, 36)
            theme: this.loadTheme(),
            isReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            lastTapTime: 0
        };

        // Cache for check (31)
        this.areStatsZero = (this.state.stats.heads === 0 && this.state.stats.tails === 0);

        // Trackers for cleanup 
        this.timeouts = {
            flip: null,
            settle: null,
            theme: null,
            shake: null,
            statsHeads: null,
            statsTails: null,
            aria: null
        };

        this.cleanupFns = [];
        this.audioContext = null;

        this.init();
    }

    /**
     * Initialize application
     */
    init() {
        this.bindEvents();
        this.updateStatsDisplay();
        this.loadStoredRotation();
        this.applyTheme();

        // (24) Initialize CSS variable
        this.elements.coin.style.setProperty('--final-rotation', `${this.state.currentRotation}deg`);

        // Listen for motion preference changes (20)
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const motionHandler = (e) => { this.state.isReducedMotion = e.matches; };
        motionQuery.addEventListener('change', motionHandler);
        this.cleanupFns.push(() => motionQuery.removeEventListener('change', motionHandler));

        // (45) Sync CSS variable with JS constant
        document.documentElement.style.setProperty('--animation-duration', `${this.ANIMATION_DURATION}ms`);
    }

    /**
     * Bind all event listeners with cleanup tracking
     */
    bindEvents() {
        const addListener = (element, event, handler, options) => {
            const boundHandler = handler.bind(this);
            element.addEventListener(event, boundHandler, options);
            this.cleanupFns.push(() => element.removeEventListener(event, boundHandler, options));
        };

        addListener(this.elements.flipBtn, 'click', this.handleFlip);

        // (41) Pass both coordinates
        addListener(this.elements.flipBtn, 'touchstart', (e) => {
            e.preventDefault();

            // (42) Double tap prevention
            const now = Date.now();
            if (now - this.state.lastTapTime < this.DOUBLE_TAP_DELAY) return;
            this.state.lastTapTime = now;

            this.handleFlip({
                clientX: e.touches[0].clientX,
                clientY: e.touches[0].clientY,
                type: 'touch'
            });
        }, { passive: false });

        addListener(this.elements.resetBtn, 'click', this.showResetConfirmation);
        addListener(this.elements.confirmCancel, 'click', this.hideResetConfirmation);
        addListener(this.elements.confirmReset, 'click', this.confirmReset);
        addListener(this.elements.confirmOverlay, 'click', this.handleOverlayClick);

        addListener(this.elements.themeToggle, 'click', this.toggleTheme);
        addListener(document, 'keydown', this.handleKeyboard);
    }

    /**
     * Create or resume AudioContext safely
     */
    async createAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) { return null; }
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        return this.audioContext;
    }

    async playFlipSound() {
        const ctx = await this.createAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }

    async playLandSound() {
        const ctx = await this.createAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    }

    /**
     * Determine heads/tails based on input method
     */
    determineOutcome(event) {
        if (!event || typeof event.clientX !== 'number') {
            return Math.random() < 0.5 ? 'heads' : 'tails';
        }

        const rect = this.elements.flipBtn.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percent = x / rect.width;

        if (percent < this.LEFT_ZONE) return 'heads';
        if (percent > this.RIGHT_ZONE) return 'tails';

        return Math.random() < 0.5 ? 'heads' : 'tails';
    }

    /**
     * Start the flip sequence
     */
    handleFlip(event) {
        if (this.state.isFlipping) return;

        this.state.isFlipping = true;
        this.elements.flipBtn.disabled = true;
        this.elements.flipBtn.textContent = 'FLIPPING...';

        // (26) Clear result text content
        this.elements.resultLabel.classList.remove('show');
        this.elements.resultLabel.textContent = '';

        this.announce('Flipping coin...'); // (39)

        this.playFlipSound();

        const outcome = this.determineOutcome(event);

        if (this.state.currentRotation > this.MAX_ROTATION) {
            this.state.currentRotation = this.state.currentRotation % 360;
            this.elements.coin.style.transition = 'none';
            // (33) RAF for smoothness
            requestAnimationFrame(() => {
                this.elements.coin.style.transform = `rotateX(${this.state.currentRotation}deg)`;
                // Force reflow
                void this.elements.coin.offsetWidth;
                this.elements.coin.style.transition = '';
            });
        }

        // (50) Simplified rotation logic
        const extraSpins = 5 + Math.floor(Math.random() * 5);
        const baseRotation = this.state.currentRotation + (extraSpins * 360);
        const targetRotation = this.calculateTargetRotation(baseRotation, outcome);

        // (33) RAF
        requestAnimationFrame(() => {
            this.elements.coin.classList.add('coin-flipping');
            this.elements.coin.style.transform = `rotateX(${targetRotation}deg)`;

            if (!this.state.isReducedMotion) {
                this.elements.shadow.classList.add('shadow-animate');
            }
        });

        this.state.currentRotation = targetRotation;

        const duration = this.state.isReducedMotion ? this.ANIMATION_DURATION_REDUCED : this.ANIMATION_DURATION;

        if (this.timeouts.flip) clearTimeout(this.timeouts.flip);

        this.timeouts.flip = setTimeout(() => {
            this.completeFlip(outcome);
        }, duration);
    }

    // (50) Helper
    calculateTargetRotation(base, outcome) {
        const mod = base % 360;
        return outcome === 'heads'
            ? base - mod + 360
            : base - mod + 180 + 360;
    }

    /**
     * Finish flip and show result
     */
    completeFlip(outcome) {
        if (!this.state.isFlipping) return;

        this.state.isFlipping = false;
        this.elements.flipBtn.disabled = false;
        this.elements.flipBtn.textContent = 'FLIP COIN';

        this.playLandSound();

        this.elements.coin.classList.remove('coin-flipping');
        // (44) Reset transition
        this.elements.coin.style.transition = 'none';

        if (!this.state.isReducedMotion) {
            this.elements.coin.style.setProperty('--final-rotation', `${this.state.currentRotation}deg`);
            this.elements.coin.classList.add('coin-settling');

            if (this.timeouts.settle) clearTimeout(this.timeouts.settle);
            this.timeouts.settle = setTimeout(() => {
                this.elements.coin.classList.remove('coin-settling');
                // (44) Restore transition for next flip
                this.elements.coin.style.transition = '';
            }, this.SETTLE_DURATION);
        } else {
            this.elements.coin.style.transition = '';
        }

        this.elements.resultLabel.textContent = outcome.toUpperCase();

        // (25) Cleanup shadow safely
        try {
            this.elements.shadow.classList.remove('shadow-animate');
        } catch (e) { }

        // Small delay to allow reflow for transition
        requestAnimationFrame(() => {
            this.elements.resultLabel.classList.add('show');
        });

        this.announce(`Result is ${outcome}`);

        this.updateStats(outcome);
        this.saveState();
    }

    /**
     * Update internal stats buffer
     */
    updateStats(result) {
        if (result === 'heads') this.state.stats.heads++;
        else this.state.stats.tails++;

        this.areStatsZero = false; // (31) Update cache

        this.updateStatsDisplay(result); // (28) Pass changed result
        this.saveStats();
    }

    /**
     * Update visual counters
     */
    updateStatsDisplay(changedOutcome = null) {
        this.elements.headsCount.textContent = this.state.stats.heads;
        this.elements.tailsCount.textContent = this.state.stats.tails;

        if (!this.state.isReducedMotion && changedOutcome) {
            // (28) Only animate what changed
            if (changedOutcome === 'heads') {
                this.animateStat(this.elements.headsCount, 'statsHeads');
            } else if (changedOutcome === 'tails') {
                this.animateStat(this.elements.tailsCount, 'statsTails');
            }
        }
    }

    // (28) Helper
    animateStat(element, timeoutKey) {
        element.classList.remove('updated');
        void element.offsetWidth; // Force reflow
        element.classList.add('updated');

        if (this.timeouts[timeoutKey]) clearTimeout(this.timeouts[timeoutKey]);
        this.timeouts[timeoutKey] = setTimeout(() => {
            element.classList.remove('updated');
        }, this.STATS_UPDATE_DURATION);
    }

    /**
     * Reset stats to zero
     */
    resetStats() {
        this.state.stats = { heads: 0, tails: 0 };
        this.areStatsZero = true; // (31)

        this.elements.headsCount.textContent = '0';
        this.elements.tailsCount.textContent = '0';

        this.saveStats();
        this.elements.resultLabel.classList.remove('show');
        this.announce('Statistics reset to zero');
        this.hideResetConfirmation();
    }

    announce(msg) {
        if (this.elements.ariaLive) {
            this.elements.ariaLive.textContent = msg;
            if (this.timeouts.aria) clearTimeout(this.timeouts.aria);
            this.timeouts.aria = setTimeout(() => {
                if (this.elements.ariaLive) this.elements.ariaLive.textContent = '';
            }, this.ARIA_TIMEOUT);
        }
    }

    /**
     * Open confirmation modal
     */
    showResetConfirmation() {
        // (51) Check isFlipping
        if (this.state.isFlipping) return;
        if (this.elements.confirmOverlay.classList.contains('show')) return;

        // (31) Use cache
        if (this.areStatsZero) return;

        this.elements.confirmHeads.textContent = this.state.stats.heads;
        this.elements.confirmTails.textContent = this.state.stats.tails;
        this.elements.confirmOverlay.classList.add('show');

        // (37) Auto focus cancel (safer choice)
        setTimeout(() => this.elements.confirmCancel.focus(), 50);
        this.trapFocus(this.elements.confirmOverlay);

        if (!this.state.isReducedMotion) {
            this.elements.confirmIcon.classList.add('shake');
            if (this.timeouts.shake) clearTimeout(this.timeouts.shake);
            this.timeouts.shake = setTimeout(() => {
                this.elements.confirmIcon.classList.remove('shake');
            }, this.SHAKE_DURATION);
        }
    }

    hideResetConfirmation() {
        this.elements.confirmOverlay.classList.remove('show');
        this.elements.resetBtn.focus();
    }

    handleOverlayClick(e) {
        if (e.target === this.elements.confirmOverlay) {
            this.hideResetConfirmation();
        }
    }

    confirmReset() {
        this.resetStats();
    }

    trapFocus(element) {
        const focusable = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        const handleTrap = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first.focus();
                    }
                }
            }
        };

        element.addEventListener('keydown', handleTrap);
        this.cleanupFns.push(() => element.removeEventListener('keydown', handleTrap));
    }

    handleKeyboard(e) {
        if (e.key === 'Escape') {
            if (this.elements.confirmOverlay.classList.contains('show')) {
                this.hideResetConfirmation();
                return;
            }
        }

        // (52) Return if dialog open
        if (this.elements.confirmOverlay.classList.contains('show')) return;

        // (51) Return if flipping
        if (this.state.isFlipping) return;

        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

        const rect = this.elements.flipBtn.getBoundingClientRect();

        if (e.code === 'ArrowLeft') {
            e.preventDefault();
            this.handleFlip({ clientX: rect.left + 10, type: 'keyboard' });
        }
        if (e.code === 'ArrowRight') {
            e.preventDefault();
            this.handleFlip({ clientX: rect.right - 10, type: 'keyboard' });
        }
        if (e.code === 'Space' || e.code === 'Enter') {
            if (document.activeElement === document.body || document.activeElement === this.elements.flipBtn) {
                e.preventDefault();
                this.handleFlip({ type: 'keydown' });
            }
        }
    }

    toggleTheme() {
        if (this.timeouts.theme) return;

        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();

        // (40) Update Aria Label
        this.elements.themeToggle.setAttribute('aria-label', `Switch to ${this.state.theme === 'dark' ? 'light' : 'dark'} mode`);
        this.announce(`Theme changed to ${this.state.theme}`);

        // (34) Safe Set Item
        try {
            localStorage.setItem('flipper-theme-v1', this.state.theme); // (53)
        } catch (e) { }

        this.timeouts.theme = setTimeout(() => {
            this.timeouts.theme = null;
        }, this.THEME_DEBOUNCE);
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.state.theme);

        const icon = this.elements.themeIcon;
        icon.style.opacity = '0';
        icon.style.transform = 'scale(0.8)';

        setTimeout(() => {
            const isLight = this.state.theme === 'light';
            // (32) Use element reference
            const sun = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
            const moon = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';

            icon.innerHTML = isLight ? sun : moon;

            icon.style.opacity = '1';
            icon.style.transform = 'scale(1)';
        }, 200);
    }

    loadTheme() {
        try {
            // (53) Migration support could go here
            return localStorage.getItem('flipper-theme-v1') || 'dark';
        } catch (e) { return 'dark'; }
    }

    loadStats() {
        try {
            // (53) New prefix
            const saved = localStorage.getItem('flipper-stats-v1');
            const parsed = saved ? JSON.parse(saved) : { heads: 0, tails: 0 };

            // (36) Negative check + Number check
            if (typeof parsed.heads !== 'number' || isNaN(parsed.heads) || parsed.heads < 0) parsed.heads = 0;
            if (typeof parsed.tails !== 'number' || isNaN(parsed.tails) || parsed.tails < 0) parsed.tails = 0;

            return parsed;
        } catch (e) {
            return { heads: 0, tails: 0 };
        }
    }

    saveStats() {
        // (34) Safe save
        try {
            localStorage.setItem('flipper-stats-v1', JSON.stringify(this.state.stats));
        } catch (e) {
            console.warn('Storage quota exceeded');
        }
    }

    loadStoredRotation() {
        try {
            let rot = parseInt(localStorage.getItem('flipper-rotation-v1'));
            if (isNaN(rot)) rot = 0;
            this.state.currentRotation = rot % 360;
            if (this.elements.coin) {
                this.elements.coin.style.transform = `rotateX(${this.state.currentRotation}deg)`;
            }
        } catch (e) {
            this.state.currentRotation = 0;
        }
    }

    saveState() {
        try {
            localStorage.setItem('flipper-rotation-v1', this.state.currentRotation);
        } catch (e) { }
    }

    destroy() {
        this.cleanupFns.forEach(fn => fn());
        this.cleanupFns = [];
        Object.values(this.timeouts).forEach(id => {
            if (id) clearTimeout(id);
        });
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.coinFlipApp = new CoinFlipSimulator();
});
