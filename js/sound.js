/**
 * Sound Effects System — Web Audio API
 * All sounds are synthesized, no external files needed.
 */

const Sound = (() => {
    let ctx = null;
    let muted = false;

    const SOUND_KEY = 'sudoku_sound_muted';

    function getCtx() {
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return ctx;
    }

    function init() {
        const saved = localStorage.getItem(SOUND_KEY);
        if (saved !== null) muted = saved === 'true';

        // Resume AudioContext on first user interaction
        const resume = () => {
            if (ctx && ctx.state === 'suspended') ctx.resume();
            document.removeEventListener('click', resume);
            document.removeEventListener('touchstart', resume);
        };
        document.addEventListener('click', resume);
        document.addEventListener('touchstart', resume);
    }

    function setMuted(val) {
        muted = val;
        localStorage.setItem(SOUND_KEY, muted);
    }

    function isMuted() { return muted; }

    // ── Core oscillator helper ──────────────────────────────
    function playTone(freq, type, duration, volume = 0.15, delay = 0) {
        if (muted) return;
        const c = getCtx();
        const osc = c.createOscillator();
        const gain = c.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, c.currentTime + delay);
        gain.gain.setValueAtTime(volume, c.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);

        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(c.currentTime + delay);
        osc.stop(c.currentTime + delay + duration);
    }

    function playNoise(duration, volume = 0.05) {
        if (muted) return;
        const c = getCtx();
        const bufSize = c.sampleRate * duration;
        const buf = c.createBuffer(1, bufSize, c.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        const src = c.createBufferSource();
        const gain = c.createGain();
        src.buffer = buf;
        gain.gain.setValueAtTime(volume, c.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
        src.connect(gain);
        gain.connect(c.destination);
        src.start();
    }

    // ── Individual sound definitions ────────────────────────

    /** Soft click for cell selection */
    function cellTap() {
        playTone(800, 'sine', 0.08, 0.08);
    }

    /** Satisfying pop for correct number */
    function numberCorrect() {
        playTone(523, 'sine', 0.1, 0.12);
        playTone(659, 'sine', 0.1, 0.12, 0.06);
        playTone(784, 'sine', 0.15, 0.1, 0.12);
    }

    /** Error buzz for wrong number */
    function numberWrong() {
        playTone(200, 'sawtooth', 0.15, 0.1);
        playTone(160, 'sawtooth', 0.2, 0.08, 0.1);
    }

    /** Light tick for note toggle */
    function noteToggle() {
        playTone(1200, 'sine', 0.04, 0.06);
    }

    /** Soft swoosh for erase */
    function erase() {
        playTone(600, 'sine', 0.12, 0.06);
        playTone(400, 'sine', 0.1, 0.05, 0.05);
    }

    /** Magic chime for hint */
    function hint() {
        playTone(880, 'sine', 0.12, 0.1);
        playTone(1108, 'sine', 0.12, 0.1, 0.1);
        playTone(1318, 'sine', 0.2, 0.08, 0.2);
    }

    /** Subtle whoosh for undo/redo */
    function undo() {
        playTone(500, 'triangle', 0.1, 0.06);
        playTone(400, 'triangle', 0.08, 0.04, 0.05);
    }

    /** Victory fanfare */
    function win() {
        playTone(523, 'sine', 0.15, 0.12);
        playTone(659, 'sine', 0.15, 0.12, 0.15);
        playTone(784, 'sine', 0.15, 0.12, 0.3);
        playTone(1046, 'sine', 0.4, 0.15, 0.45);
    }

    /** Defeat sound */
    function lose() {
        playTone(400, 'sine', 0.2, 0.1);
        playTone(350, 'sine', 0.2, 0.1, 0.2);
        playTone(300, 'sine', 0.3, 0.1, 0.4);
        playTone(200, 'sine', 0.5, 0.08, 0.6);
    }

    /** UI click for menu buttons */
    function uiClick() {
        playTone(700, 'sine', 0.06, 0.07);
    }

    /** Subtle hover tick */
    function uiHover() {
        playTone(1000, 'sine', 0.03, 0.03);
    }

    /** Epic horn for battle start */
    function battleStart() {
        playTone(261, 'sawtooth', 0.3, 0.08);
        playTone(329, 'sawtooth', 0.3, 0.08, 0.15);
        playTone(392, 'sawtooth', 0.3, 0.08, 0.3);
        playTone(523, 'sawtooth', 0.5, 0.1, 0.45);
    }

    /** Battle win stinger */
    function battleWin() {
        playTone(523, 'square', 0.12, 0.08);
        playTone(659, 'square', 0.12, 0.08, 0.12);
        playTone(784, 'square', 0.12, 0.08, 0.24);
        playTone(1046, 'square', 0.3, 0.1, 0.36);
    }

    /** Battle lose stinger */
    function battleLose() {
        playTone(400, 'square', 0.15, 0.08);
        playTone(350, 'square', 0.15, 0.08, 0.15);
        playTone(300, 'square', 0.2, 0.08, 0.3);
        playTone(200, 'square', 0.4, 0.06, 0.45);
    }

    /** Warning buzz for time penalty */
    function penalty() {
        playTone(180, 'sawtooth', 0.12, 0.08);
        playNoise(0.08, 0.04);
    }

    /** Notification ding for hint gained */
    function notification() {
        playTone(880, 'sine', 0.1, 0.1);
        playTone(1174, 'sine', 0.15, 0.08, 0.1);
    }

    /** Pause blip */
    function pause() {
        playTone(600, 'triangle', 0.08, 0.06);
        playTone(450, 'triangle', 0.1, 0.05, 0.06);
    }

    /** Resume blip */
    function resume() {
        playTone(450, 'triangle', 0.08, 0.06);
        playTone(600, 'triangle', 0.1, 0.05, 0.06);
    }

    return {
        init,
        setMuted,
        isMuted,
        cellTap,
        numberCorrect,
        numberWrong,
        noteToggle,
        erase,
        hint,
        undo,
        win,
        lose,
        uiClick,
        uiHover,
        battleStart,
        battleWin,
        battleLose,
        penalty,
        notification,
        pause,
        resume,
    };
})();
