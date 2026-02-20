/**
 * Emote System — Clash Royale-style emotes & premade texts for PvP battles.
 * Emotes are purchasable in the shop (except starter pack).
 * Each emote has: id, label, gif URL (or emoji fallback), category, price.
 * Supports AI reactions, cooldown, and block/unblock.
 */

const Emote = (() => {

    // ── All available emotes ────────────────────────────────
    // category: 'emote' (gif-style) or 'text' (premade message)
    // price: 0 = free (starter pack), >0 = must buy in shop
    const ALL_EMOTES = [
        // ── Starter emotes (free) ──
        { id: 'thumbs_up', label: '👍', type: 'emote', price: 0, display: '👍', sound: 'notification' },
        { id: 'good_luck', label: 'Good luck!', type: 'text', price: 0, display: 'Good luck!', sound: 'uiClick' },
        { id: 'gg', label: 'GG', type: 'text', price: 0, display: 'GG', sound: 'uiClick' },
        { id: 'thanks', label: 'Thanks!', type: 'text', price: 0, display: 'Thanks!', sound: 'uiClick' },

        // ── Purchasable emotes ──
        { id: 'laugh', label: '😂', type: 'emote', price: 15, display: '😂', sound: 'notification' },
        { id: 'fire', label: '🔥', type: 'emote', price: 0, isBP: true, bpTier: 20, display: '🔥', sound: 'notification' },
        { id: 'angry', label: '😤', type: 'emote', price: 15, display: '😤', sound: 'notification' },
        { id: 'clap', label: '👏', type: 'emote', price: 15, display: '👏', sound: 'notification' },
        { id: 'cool', label: '😎', type: 'emote', price: 0, isBP: true, bpTier: 40, display: '😎', sound: 'notification' },
        { id: 'flex', label: '💪', type: 'emote', price: 20, display: '💪', sound: 'notification' },
        { id: 'think', label: '🤔', type: 'emote', price: 15, display: '🤔', sound: 'notification' },
        { id: 'cry', label: '😢', type: 'emote', price: 15, display: '😢', sound: 'notification' },
        { id: 'wave', label: '👋', type: 'emote', price: 10, display: '👋', sound: 'notification' },
        { id: 'heart', label: '❤️', type: 'emote', price: 20, display: '❤️', sound: 'notification' },
        { id: 'skull', label: '💀', type: 'emote', price: 0, isBP: true, bpTier: 90, display: '💀', sound: 'notification' },
        { id: 'crown', label: '👑', type: 'emote', price: 0, isBP: true, bpTier: 60, display: '👑', sound: 'notification' },

        // ── Purchasable texts ──
        { id: 'well_played', label: 'Well played!', type: 'text', price: 10, display: 'Well played!', sound: 'uiClick' },
        { id: 'oops', label: 'Oops!', type: 'text', price: 10, display: 'Oops!', sound: 'uiClick' },
        { id: 'wow', label: 'Wow!', type: 'text', price: 10, display: 'Wow!', sound: 'uiClick' },
        { id: 'ez', label: 'EZ', type: 'text', price: 20, display: 'EZ', sound: 'uiClick' },
        { id: 'no_way', label: 'No way!', type: 'text', price: 15, display: 'No way!', sound: 'uiClick' },
        { id: 'try_harder', label: 'Try harder!', type: 'text', price: 25, display: 'Try harder!', sound: 'uiClick' },
        { id: 'im_fast', label: "I'm fast!", type: 'text', price: 20, display: "I'm fast!", sound: 'uiClick' },
        { id: 'nervous', label: 'Nervous...', type: 'text', price: 10, display: 'Nervous...', sound: 'uiClick' },
    ];

    // AI-usable emote IDs (it picks from these contextually)
    const AI_EMOTES = {
        onPlayerMistake: ['laugh', 'thumbs_up', 'oops', 'think'],
        onPlayerAhead: ['angry', 'nervous', 'fire', 'try_harder'],
        onAISolveStreak: ['cool', 'flex', 'fire', 'im_fast'],
        onAIMistake: ['oops', 'cry', 'think', 'nervous'],
        onBattleStart: ['good_luck', 'wave', 'thumbs_up'],
        onBattleWin: ['ez', 'crown', 'laugh', 'cool'],
        onBattleLose: ['gg', 'well_played', 'clap'],
    };

    const COOLDOWN_MS = 3000;
    const MUTE_KEY = 'sudoku_emote_muted';

    let lastEmoteTime = 0;
    let muted = false;
    let onEmoteCallback = null;

    function init() {
        const saved = localStorage.getItem(MUTE_KEY);
        if (saved !== null) muted = saved === 'true';
    }

    function setMuted(val) {
        muted = val;
        localStorage.setItem(MUTE_KEY, muted);
    }

    function isMuted() { return muted; }

    function getAllEmotes() { return ALL_EMOTES; }

    function getEmoteById(id) {
        return ALL_EMOTES.find(e => e.id === id) || null;
    }

    /**
     * Get emotes the player owns (unlocked).
     */
    function getPlayerEmotes() {
        const data = Player.getData();
        const unlocked = data.unlockedEmotes || ['thumbs_up', 'good_luck', 'gg', 'thanks'];
        return ALL_EMOTES.filter(e => unlocked.includes(e.id));
    }

    /**
     * Buy an emote from the shop.
     */
    function buyEmote(emoteId) {
        const emote = getEmoteById(emoteId);
        if (!emote) return { success: false, reason: 'Emote not found' };

        // Ensure we deduct from Player directly via helper if needed, but getData() returns the ref.
        const data = Player.getData();
        if (!data.unlockedEmotes) data.unlockedEmotes = ['thumbs_up', 'good_luck', 'gg', 'thanks'];

        if (data.unlockedEmotes.includes(emoteId)) return { success: false, reason: 'Already owned' };
        if (Player.getCoins() < emote.price) return { success: false, reason: 'Not enough coins' };

        // Instead of modifying data.coins directly, use Player.awardForCompletion or a new method, but since we can access data, let's do it safely
        data.coins -= emote.price;
        data.unlockedEmotes.push(emoteId);
        Player.save();
        return { success: true };
    }

    function isEmoteUnlocked(emoteId) {
        const data = Player.getData();
        const unlocked = data.unlockedEmotes || ['thumbs_up', 'good_luck', 'gg', 'thanks'];
        return unlocked.includes(emoteId);
    }

    /**
     * Player sends an emote (with cooldown enforcement).
     * Returns the emote object, or null if on cooldown.
     */
    function playerSend(emoteId) {
        const now = Date.now();
        if (now - lastEmoteTime < COOLDOWN_MS) return null; // On cooldown

        const emote = getEmoteById(emoteId);
        if (!emote) return null;

        lastEmoteTime = now;

        // Play the associated sound
        if (emote.sound && Sound[emote.sound]) {
            Sound[emote.sound]();
        }

        return emote;
    }

    /**
     * AI sends an emote based on context.
     * Returns emote object or null if muted/skipped.
     */
    function aiSend(context) {
        if (muted) return null;

        const pool = AI_EMOTES[context];
        if (!pool || pool.length === 0) return null;

        // AI doesn't always react (30-70% chance depending on context)
        const reactionChance = context === 'onBattleStart' ? 0.8 : 0.35;
        if (Math.random() > reactionChance) return null;

        const emoteId = pool[Math.floor(Math.random() * pool.length)];
        const emote = getEmoteById(emoteId);
        if (!emote) return null;

        // Play the associated sound
        if (emote.sound && Sound[emote.sound]) {
            Sound[emote.sound]();
        }

        return emote;
    }

    /**
     * Get cooldown remaining in ms (0 if ready).
     */
    function getCooldownRemaining() {
        return Math.max(0, COOLDOWN_MS - (Date.now() - lastEmoteTime));
    }

    return {
        init,
        setMuted,
        isMuted,
        getAllEmotes,
        getEmoteById,
        getPlayerEmotes,
        buyEmote,
        isEmoteUnlocked,
        playerSend,
        aiSend,
        getCooldownRemaining,
        COOLDOWN_MS,
    };
})();
