/**
 * Flipper - Premium Coin Flip Simulator
 * @author Prakhar Aggarwal
 */
class CoinFlipSimulator {
    constructor() {
        this.elements = {
            coin: document.getElementById('coin'),
            flipBtn: document.getElementById('flipBtn'),
            resetBtn: document.getElementById('resetBtn'),
            resultLabel: document.getElementById('resultLabel'),
            shadow: document.getElementById('shadow'),
            headsCount: document.getElementById('headsCount'),
            tailsCount: document.getElementById('tailsCount'),
            themeToggle: document.getElementById('themeToggle'),
            confirmOverlay: document.getElementById('confirmOverlay'),
            confirmHeads: document.getElementById('confirmHeads'),
            confirmTails: document.getElementById('confirmTails'),
            confirmCancel: document.getElementById('confirmCancel'),
            confirmReset: document.getElementById('confirmReset'),
            confirmIcon: document.getElementById('confirmIcon'),
            ariaLive: document.getElementById('ariaLive')
        };

        this.state = {
            isFlipping: false,
            currentRotation: 0,
            stats: this.loadStats(),
            theme: this.loadTheme()
        };

        this.ANIMATION_DURATION = 3000;
        this.audioContext = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateStatsDisplay();
        this.loadStoredRotation();
        this.applyTheme();
    }

    bindEvents() {
        this.elements.flipBtn.addEventListener('click', (e) => this.handleFlip(e));

        this.elements.flipBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleFlip({
                clientX: e.touches[0].clientX,
                type: 'touch'
            });
        }, { passive: false });

        this.elements.resetBtn.addEventListener('click', () => this.showResetConfirmation());
        this.elements.confirmCancel.addEventListener('click', () => this.hideResetConfirmation());
        this.elements.confirmReset.addEventListener('click', () => this.confirmReset());

        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    createAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) { }
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }

    playFlipSound() {
        const ctx = this.createAudioContext();
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

    playLandSound() {
        const ctx = this.createAudioContext();
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

    determineOutcome(event) {
        if (typeof event.clientX !== 'number' || event.clientX === 0) {
            return Math.random() < 0.5 ? 'heads' : 'tails';
        }

        const rect = this.elements.flipBtn.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percent = x / rect.width;

        if (percent < 0.25) return 'heads';
        if (percent > 0.75) return 'tails';

        return Math.random() < 0.5 ? 'heads' : 'tails';
    }

    handleFlip(event) {
        if (this.state.isFlipping) return;

        this.state.isFlipping = true;
        this.elements.flipBtn.disabled = true;
        this.elements.flipBtn.textContent = 'FLIPPING...';
        this.elements.resultLabel.classList.remove('show');

        this.playFlipSound();

        const outcome = this.determineOutcome(event);
        const extraSpins = 5 + Math.floor(Math.random() * 5);
        const baseRotation = this.state.currentRotation + (extraSpins * 360);

        const targetRotation = outcome === 'heads'
            ? baseRotation - (baseRotation % 360) + 360
            : baseRotation - (baseRotation % 360) + 180 + 360;

        this.elements.coin.classList.add('coin-flipping');
        this.elements.coin.style.transform = `rotateX(${targetRotation}deg)`;
        this.elements.shadow.classList.add('shadow-animate');

        this.state.currentRotation = targetRotation;

        setTimeout(() => {
            this.completeFlip(outcome);
        }, this.ANIMATION_DURATION);
    }

    completeFlip(outcome) {
        this.state.isFlipping = false;
        this.elements.flipBtn.disabled = false;
        this.elements.flipBtn.textContent = 'FLIP COIN';

        this.playLandSound();

        this.elements.coin.classList.remove('coin-flipping');

        this.elements.coin.style.setProperty('--final-rotation', `${this.state.currentRotation}deg`);
        this.elements.coin.classList.add('coin-settling');
        setTimeout(() => this.elements.coin.classList.remove('coin-settling'), 300);

        this.elements.resultLabel.textContent = outcome.toUpperCase();
        this.elements.resultLabel.classList.add('show');
        this.elements.shadow.classList.remove('shadow-animate');

        this.announce(`Coin flip result: ${outcome}`);

        this.updateStats(outcome);
        localStorage.setItem('proflip-rotation', this.state.currentRotation);
    }

    updateStats(result) {
        if (result === 'heads') this.state.stats.heads++;
        else this.state.stats.tails++;

        this.updateStatsDisplay();
        this.saveStats();
    }

    updateStatsDisplay() {
        this.elements.headsCount.textContent = this.state.stats.heads;
        this.elements.tailsCount.textContent = this.state.stats.tails;

        this.elements.headsCount.classList.add('updated');
        this.elements.tailsCount.classList.add('updated');
        setTimeout(() => {
            this.elements.headsCount.classList.remove('updated');
            this.elements.tailsCount.classList.remove('updated');
        }, 400);
    }

    resetStats() {
        this.state.stats = { heads: 0, tails: 0 };
        this.updateStatsDisplay();
        this.saveStats();
        this.elements.resultLabel.classList.remove('show');
        this.announce('Statistics reset');
        this.hideResetConfirmation();
    }

    announce(msg) {
        if (this.elements.ariaLive) {
            this.elements.ariaLive.textContent = msg;
            setTimeout(() => this.elements.ariaLive.textContent = '', 1000);
        }
    }

    showResetConfirmation() {
        if (this.state.stats.heads === 0 && this.state.stats.tails === 0) return;

        this.elements.confirmHeads.textContent = this.state.stats.heads;
        this.elements.confirmTails.textContent = this.state.stats.tails;
        this.elements.confirmOverlay.classList.add('show');
        this.elements.confirmIcon.classList.add('shake');
        setTimeout(() => this.elements.confirmIcon.classList.remove('shake'), 500);
    }

    hideResetConfirmation() {
        this.elements.confirmOverlay.classList.remove('show');
    }

    confirmReset() {
        this.resetStats();
    }

    handleKeyboard(e) {
        if (this.state.isFlipping) return;
        if (e.key === 'Escape') this.hideResetConfirmation();

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
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.applyTheme();
        localStorage.setItem('proflip-theme', this.state.theme);
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.state.theme);
        const isLight = this.state.theme === 'light';
        const sun = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
        const moon = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';

        document.getElementById('themeIcon').innerHTML = isLight ? sun : moon;
    }

    loadTheme() {
        return localStorage.getItem('proflip-theme') || 'dark';
    }

    loadStats() {
        const saved = localStorage.getItem('proflip-stats');
        return saved ? JSON.parse(saved) : { heads: 0, tails: 0 };
    }

    saveStats() {
        localStorage.setItem('proflip-stats', JSON.stringify(this.state.stats));
    }

    loadStoredRotation() {
        const rot = parseInt(localStorage.getItem('proflip-rotation'));
        if (!isNaN(rot)) {
            this.state.currentRotation = rot;
            this.elements.coin.style.transform = `rotateX(${rot}deg)`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CoinFlipSimulator();
});
