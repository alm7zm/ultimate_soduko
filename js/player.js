/**
 * Player Progression System
 * Manages XP, leveling, coins, streaks, daily quests, stats, and cosmetics.
 * All data persisted to localStorage.
 */

const Player = (() => {

    const STORAGE_KEY = 'sudoku_player';

    // ── XP & Leveling ─────────────────────────────────────
    const XP_PER_DIFFICULTY = {
        easy: 50,
        medium: 100,
        hard: 200,
        expert: 350,
        evil: 500,
    };

    function xpForLevel(level) {
        return level * level * 100;
    }

    function levelFromXP(xp) {
        return Math.floor(Math.sqrt(xp / 100));
    }

    // ── Themes ─────────────────────────────────────────────
    const THEMES = [
        {
            id: 'default',
            name: 'Midnight',
            description: 'Deep navy dark mode',
            price: 0,
            preview: ['#0a0e1a', '#1e2745', '#6366f1'],
        },
        {
            id: 'neon',
            name: 'Neon Pulse',
            description: 'Electric glow on black',
            price: 0,
            isBP: true,
            bpTier: 50,
            preview: ['#0d0d0d', '#1a1a2e', '#39ff14'],
        },
        {
            id: 'woodcraft',
            name: 'Woodcraft',
            description: 'Warm amber & natural tones',
            price: 75,
            preview: ['#2c1810', '#3d2914', '#d4a056'],
        },
        {
            id: 'cyberpunk',
            name: 'Cyberpunk',
            description: 'Purple & cyan neon city',
            price: 0,
            isBP: true,
            bpTier: 80,
            preview: ['#0f0a1a', '#1a1035', '#e040fb'],
        },
        {
            id: 'ocean',
            name: 'Deep Ocean',
            description: 'Soothing oceanic blues',
            price: 80,
            preview: ['#001f3f', '#003366', '#0074D9'],
        },
        {
            id: 'forest',
            name: 'Emerald Forest',
            description: 'Deep forest greens',
            price: 80,
            preview: ['#0d2319', '#153624', '#2ecc71'],
        },
        {
            id: 'sunset',
            name: 'Sunset Sky',
            description: 'Warm orange and purple',
            price: 150,
            preview: ['#2A0845', '#6441A5', '#FF4B2B'],
        },
        {
            id: 'vampire',
            name: 'Vampire',
            description: 'Crimson red on pitch black',
            price: 200,
            preview: ['#000000', '#1a0000', '#ff0000'],
        },
        {
            id: 'gold',
            name: 'Royal Gold',
            description: 'Luxurious gold and obsidian',
            price: 500,
            preview: ['#111111', '#1a1a1a', '#FFD700'],
        },
        {
            id: 'hacker',
            name: 'Hacker Terminal',
            description: 'Classic green phosphor',
            price: 300,
            preview: ['#000000', '#0a0a0a', '#00ff00'],
        },
    ];

    // ── Quest Templates ────────────────────────────────────
    const QUEST_TEMPLATES = [
        {
            type: 'solve_count', text: 'Solve {n} {diff} puzzle(s)', params: (seed) => {
                const diffs = ['easy', 'medium', 'hard', 'expert'];
                return { n: 1 + (seed % 3), diff: diffs[seed % diffs.length] };
            }
        },
        { type: 'no_hints', text: 'Solve a puzzle without using hints', params: () => ({}) },
        {
            type: 'under_time', text: 'Solve a puzzle in under {mins} minutes', params: (seed) => {
                return { mins: 5 + (seed % 6) };
            }
        },
        { type: 'use_notes', text: 'Use notes in a puzzle', params: () => ({}) },
        { type: 'no_mistakes', text: 'Solve a puzzle with zero mistakes', params: () => ({}) },
        {
            type: 'solve_any', text: 'Solve {n} puzzle(s) of any difficulty', params: (seed) => {
                return { n: 2 + (seed % 3) };
            }
        },
    ];

    // ── Weekly Mission Templates ───────────────────────────
    const WEEKLY_MISSION_TEMPLATES = [
        {
            type: 'weekly_solve_total', text: 'Solve {n} puzzles this week',
            params: (seed) => ({ n: 5 + (seed % 6) }),
            bpXP: 150,
        },
        {
            type: 'weekly_hard_solves', text: 'Solve {n} Hard+ puzzles',
            params: (seed) => ({ n: 2 + (seed % 3) }),
            bpXP: 200,
        },
        {
            type: 'weekly_pvp_wins', text: 'Win {n} PvP battle(s)',
            params: (seed) => ({ n: 1 + (seed % 3) }),
            bpXP: 250,
        },
        {
            type: 'weekly_no_mistakes', text: 'Solve {n} puzzle(s) with zero mistakes',
            params: (seed) => ({ n: 2 + (seed % 2) }),
            bpXP: 200,
        },
        {
            type: 'weekly_under_time', text: 'Solve {n} puzzle(s) in under 5 minutes',
            params: (seed) => ({ n: 3 + (seed % 3) }),
            bpXP: 180,
        },
        {
            type: 'weekly_streak', text: 'Maintain a {n}-day streak',
            params: (seed) => ({ n: 3 + (seed % 4) }),
            bpXP: 300,
        },
    ];

    // ── Battle Pass Tiers (100 levels) ─────────────────────
    function generateBPTiers() {
        const tiers = [];
        for (let i = 1; i <= 100; i++) {
            const xpNeeded = 100 + (i - 1) * 20; // 100, 120, 140, ... 2080
            let reward;

            if (i % 10 === 0) {
                // Milestone tiers: special rewards
                if (i === 10) reward = { type: 'coins', amount: 100, label: '100 Coins' };
                else if (i === 20) reward = { type: 'emote', id: 'fire', label: '🔥 Emote' };
                else if (i === 30) reward = { type: 'coins', amount: 200, label: '200 Coins' };
                else if (i === 40) reward = { type: 'emote', id: 'cool', label: '😎 Emote' };
                else if (i === 50) reward = { type: 'theme', id: 'neon', label: 'Neon Pulse Theme' };
                else if (i === 60) reward = { type: 'emote', id: 'crown', label: '👑 Emote' };
                else if (i === 70) reward = { type: 'coins', amount: 500, label: '500 Coins' };
                else if (i === 80) reward = { type: 'theme', id: 'cyberpunk', label: 'Cyberpunk Theme' };
                else if (i === 90) reward = { type: 'emote', id: 'skull', label: '💀 Emote' };
                else if (i === 100) reward = { type: 'coins', amount: 1000, label: '🏆 1000 Coins' };
            } else if (i % 5 === 0) {
                // Every 5: coins
                reward = { type: 'coins', amount: 25 + Math.floor(i / 5) * 5, label: `${25 + Math.floor(i / 5) * 5} Coins` };
            } else {
                // Regular tiers: small coins or XP
                if (i % 3 === 0) {
                    reward = { type: 'xp', amount: 50 + i * 2, label: `${50 + i * 2} XP` };
                } else {
                    reward = { type: 'coins', amount: 10 + Math.floor(i / 3) * 2, label: `${10 + Math.floor(i / 3) * 2} Coins` };
                }
            }

            tiers.push({ tier: i, xpNeeded, reward });
        }
        return tiers;
    }

    const BP_TIERS = generateBPTiers();

    // ── Default Player Data ────────────────────────────────
    // ── Leagues ────────────────────────────────────────────
    const LEAGUES = [
        { id: 'bronze', name: 'Bronze', icon: '🥉', minELO: 0, color: '#cd7f32' },
        { id: 'silver', name: 'Silver', icon: '🥈', minELO: 1200, color: '#c0c0c0' },
        { id: 'gold', name: 'Gold', icon: '🥇', minELO: 1500, color: '#ffd700' },
        { id: 'diamond', name: 'Diamond', icon: '💎', minELO: 1800, color: '#b9f2ff' },
    ];

    function createDefaultData() {
        return {
            xp: 0,
            coins: 0,
            level: 0,
            streak: 0,
            lastPlayedDate: null,
            totalGamesPlayed: 0,
            totalGamesWon: 0,
            bestTimes: {},
            unlockedThemes: ['default'],
            activeTheme: 'default',
            unlockedEmotes: ['thumbs_up', 'good_luck', 'gg', 'thanks'],
            quests: [],
            questDate: null,
            questProgress: {},
            todayStats: {
                date: null,
                puzzlesSolved: {},
                totalSolved: 0,
                usedNotes: false,
                solvedNoHints: false,
                solvedNoMistakes: false,
                bestTime: Infinity,
            },
            // PvP / League
            elo: 1000,
            pvpWins: 0,
            pvpLosses: 0,
            pvpDraws: 0,
            matchHistory: [],  // last 20 matches

            // Battle Pass
            bp: {
                season: 1,
                xp: 0,
                tier: 0, // current tier (0 = not started)
                claimed: [], // array of tier numbers already claimed
            },

            // Weekly missions
            weeklyMissions: [],
            weeklyMissionDate: null, // ISO week start date
            weeklyProgress: {},
        };
    }

    let data = createDefaultData();

    // ── Persistence ────────────────────────────────────────
    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function load() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                data = { ...createDefaultData(), ...JSON.parse(saved) };
            } catch (e) {
                data = createDefaultData();
            }
        } else {
            data = createDefaultData();
        }

        // Ensure missing arrays exist
        if (!data.unlockedEmotes) data.unlockedEmotes = ['thumbs_up', 'good_luck', 'gg', 'thanks'];
        if (!data.bp) data.bp = { season: 1, xp: 0, tier: 0, claimed: [] };
        if (!data.weeklyProgress) data.weeklyProgress = {};

        updateStreak();
        ensureDailyQuests();
        return data;
    }

    // ── Streak ─────────────────────────────────────────────
    function getTodayStr() {
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    }

    function getYesterdayStr() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    }

    function updateStreak() {
        const today = getTodayStr();
        const yesterday = getYesterdayStr();

        if (data.lastPlayedDate === today) {
            // Already played today, streak is current
        } else if (data.lastPlayedDate === yesterday) {
            // Played yesterday, streak continues (will increment on next game)
        } else if (data.lastPlayedDate && data.lastPlayedDate !== today) {
            // Missed a day — reset streak
            data.streak = 0;
        }
    }

    function recordPlay() {
        const today = getTodayStr();
        if (data.lastPlayedDate !== today) {
            if (data.lastPlayedDate === getYesterdayStr()) {
                data.streak++;
            } else {
                data.streak = 1;
            }
            data.lastPlayedDate = today;
        }
        save();
    }

    // ── Daily Quests ───────────────────────────────────────
    function ensureDailyQuests() {
        const today = getTodayStr();
        if (data.questDate !== today) {
            generateDailyQuests(today);
        }
        // Reset today stats if new day
        if (!data.todayStats || data.todayStats.date !== today) {
            data.todayStats = {
                date: today,
                puzzlesSolved: {},
                totalSolved: 0,
                usedNotes: false,
                solvedNoHints: false,
                solvedNoMistakes: false,
                bestTime: Infinity,
            };
        }
    }

    function generateDailyQuests(dateStr) {
        // Seed from date for deterministic quests
        const seed = dateStr.split('-').reduce((a, b) => a + parseInt(b), 0);
        const shuffled = [...QUEST_TEMPLATES].sort((a, b) => {
            const ha = hashStr(a.type + dateStr);
            const hb = hashStr(b.type + dateStr);
            return ha - hb;
        });

        data.quests = shuffled.slice(0, 3).map((template, i) => {
            const params = template.params(seed + i);
            let text = template.text;
            if (params.n) text = text.replace('{n}', params.n);
            if (params.diff) text = text.replace('{diff}', capitalize(params.diff));
            if (params.mins) text = text.replace('{mins}', params.mins);

            return {
                id: `${dateStr}-${i}`,
                type: template.type,
                text,
                params,
                completed: false,
                xpReward: 30 + i * 20,
                coinReward: 5 + i * 5,
            };
        });

        data.questDate = dateStr;
        data.questProgress = {};
        save();
    }

    function hashStr(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    // ── Quest Checking ─────────────────────────────────────
    function checkQuests(gameResult) {
        const completedQuests = [];

        for (const quest of data.quests) {
            if (quest.completed) continue;

            let done = false;
            const p = quest.params;

            switch (quest.type) {
                case 'solve_count':
                    done = (data.todayStats.puzzlesSolved[p.diff] || 0) >= p.n;
                    break;
                case 'no_hints':
                    done = data.todayStats.solvedNoHints;
                    break;
                case 'under_time':
                    done = data.todayStats.bestTime <= p.mins * 60;
                    break;
                case 'use_notes':
                    done = data.todayStats.usedNotes;
                    break;
                case 'no_mistakes':
                    done = data.todayStats.solvedNoMistakes;
                    break;
                case 'solve_any':
                    done = data.todayStats.totalSolved >= p.n;
                    break;
            }

            if (done) {
                quest.completed = true;
                data.xp += quest.xpReward;
                data.coins += quest.coinReward;
                completedQuests.push(quest);
            }
        }

        save();
        return completedQuests;
    }

    // ── XP & Coins Award ──────────────────────────────────
    function awardForCompletion(difficulty, timeSeconds, mistakes, hintsUsed, usedNotes) {
        const baseXP = XP_PER_DIFFICULTY[difficulty] || 100;

        // Speed bonus: up to 50% extra for fast solves
        const parTime = { easy: 300, medium: 600, hard: 900, expert: 1200, evil: 1800 };
        const par = parTime[difficulty] || 600;
        const speedMultiplier = timeSeconds < par ? 1 + (0.5 * (1 - timeSeconds / par)) : 1;

        // Accuracy bonus: 25% for no mistakes
        const accuracyMultiplier = mistakes === 0 ? 1.25 : 1;

        const earnedXP = Math.round(baseXP * speedMultiplier * accuracyMultiplier);
        const earnedCoins = Math.round(earnedXP / 10);

        const oldLevel = data.level;
        data.xp += earnedXP;
        data.coins += earnedCoins;
        data.level = levelFromXP(data.xp);
        data.totalGamesPlayed++;
        data.totalGamesWon++;

        const leveledUp = data.level > oldLevel;

        // Update best time
        if (!data.bestTimes[difficulty] || timeSeconds < data.bestTimes[difficulty]) {
            data.bestTimes[difficulty] = timeSeconds;
        }

        // Record play for streak
        recordPlay();

        // Update today stats for quests
        ensureDailyQuests();
        data.todayStats.totalSolved++;
        data.todayStats.puzzlesSolved[difficulty] = (data.todayStats.puzzlesSolved[difficulty] || 0) + 1;
        if (hintsUsed === 0) data.todayStats.solvedNoHints = true;
        if (mistakes === 0) data.todayStats.solvedNoMistakes = true;
        if (usedNotes) data.todayStats.usedNotes = true;
        if (timeSeconds < data.todayStats.bestTime) data.todayStats.bestTime = timeSeconds;

        // Check daily quests
        const completedQuests = checkQuests();

        // Track weekly progress for Battle Pass
        ensureWeeklyMissions();
        if (!data.weeklyProgress) data.weeklyProgress = {};
        data.weeklyProgress.totalSolved = (data.weeklyProgress.totalSolved || 0) + 1;
        if (['hard', 'expert', 'evil'].includes(difficulty)) {
            data.weeklyProgress.hardSolves = (data.weeklyProgress.hardSolves || 0) + 1;
        }
        if (mistakes === 0) {
            data.weeklyProgress.noMistakeSolves = (data.weeklyProgress.noMistakeSolves || 0) + 1;
        }
        if (timeSeconds < 300) {
            data.weeklyProgress.fastSolves = (data.weeklyProgress.fastSolves || 0) + 1;
        }

        // Award BP XP from daily quest completions
        completedQuests.forEach(q => {
            addBPXP(50 + q.xpReward); // Daily quests give BP XP too
        });

        // Also give base BP XP for solving a puzzle
        addBPXP(30);

        // Check weekly missions
        const completedWeekly = checkWeeklyMissions();

        save();

        return {
            xp: earnedXP,
            coins: earnedCoins,
            totalXP: data.xp,
            totalCoins: data.coins,
            level: data.level,
            leveledUp,
            newLevel: data.level,
            completedQuests,
            completedWeekly,
        };
    }

    function recordLoss() {
        data.totalGamesPlayed++;
        recordPlay();
        save();
    }

    // ── ELO & League ──────────────────────────────────────
    function updateELO(delta, matchData) {
        data.elo = Math.max(0, (data.elo || 1000) + delta);

        if (matchData.result === 'win') data.pvpWins = (data.pvpWins || 0) + 1;
        else if (matchData.result === 'lose') data.pvpLosses = (data.pvpLosses || 0) + 1;
        else data.pvpDraws = (data.pvpDraws || 0) + 1;

        // Add to match history (keep last 20)
        if (!data.matchHistory) data.matchHistory = [];
        data.matchHistory.unshift({
            ...matchData,
            elo: data.elo,
            eloDelta: delta,
            date: new Date().toISOString(),
        });
        if (data.matchHistory.length > 20) data.matchHistory.pop();

        // Award bonus coins for PvP wins
        if (matchData.result === 'win') {
            data.coins += 15;
            data.xp += 75;
            data.level = levelFromXP(data.xp);

            // Track weekly PvP progress
            ensureWeeklyMissions();
            if (!data.weeklyProgress) data.weeklyProgress = {};
            data.weeklyProgress.pvpWins = (data.weeklyProgress.pvpWins || 0) + 1;
            addBPXP(60); // BP XP for PvP win
            checkWeeklyMissions();
        }

        save();
    }

    function getELO() { return data.elo || 1000; }

    function getLeague() {
        const elo = getELO();
        for (let i = LEAGUES.length - 1; i >= 0; i--) {
            if (elo >= LEAGUES[i].minELO) return LEAGUES[i];
        }
        return LEAGUES[0];
    }

    function getLeagues() { return LEAGUES; }

    function getMatchHistory() { return data.matchHistory || []; }

    function getPvPRecord() {
        return {
            wins: data.pvpWins || 0,
            losses: data.pvpLosses || 0,
            draws: data.pvpDraws || 0,
        };
    }

    // ── Shop ───────────────────────────────────────────────
    function buyTheme(themeId) {
        const theme = THEMES.find(t => t.id === themeId);
        if (!theme) return { success: false, reason: 'Theme not found' };
        if (data.unlockedThemes.includes(themeId)) return { success: false, reason: 'Already owned' };
        if (data.coins < theme.price) return { success: false, reason: 'Not enough coins' };

        data.coins -= theme.price;
        data.unlockedThemes.push(themeId);
        save();
        return { success: true };
    }

    function equipTheme(themeId) {
        if (!data.unlockedThemes.includes(themeId)) return false;
        data.activeTheme = themeId;
        save();
        return true;
    }

    function isThemeUnlocked(themeId) {
        return data.unlockedThemes.includes(themeId);
    }

    // ── Getters ────────────────────────────────────────────
    function getData() { return data; }
    function getXP() { return data.xp; }
    function getCoins() { return data.coins; }
    function getLevel() { return data.level; }
    function getStreak() { return data.streak; }
    function getActiveTheme() { return data.activeTheme; }
    function getThemes() { return THEMES; }
    function getQuests() { return data.quests; }

    function getXPProgress() {
        const currentLevelXP = xpForLevel(data.level);
        const nextLevelXP = xpForLevel(data.level + 1);
        const progress = data.xp - currentLevelXP;
        const needed = nextLevelXP - currentLevelXP;
        return { progress, needed, percent: Math.min(100, (progress / needed) * 100) };
    }

    function getStats() {
        return {
            totalGamesPlayed: data.totalGamesPlayed,
            totalGamesWon: data.totalGamesWon,
            winRate: data.totalGamesPlayed > 0
                ? Math.round((data.totalGamesWon / data.totalGamesPlayed) * 100)
                : 0,
            bestTimes: data.bestTimes,
            streak: data.streak,
            level: data.level,
            xp: data.xp,
        };
    }

    // ── Battle Pass ────────────────────────────────────────
    function getBPData() {
        if (!data.bp) data.bp = { season: 1, xp: 0, tier: 0, claimed: [] };
        return data.bp;
    }

    function getBPTiers() { return BP_TIERS; }

    function addBPXP(amount) {
        if (!data.bp) data.bp = { season: 1, xp: 0, tier: 0, claimed: [] };
        data.bp.xp += amount;

        // Auto-advance tiers
        while (data.bp.tier < 100) {
            const nextTier = BP_TIERS[data.bp.tier];
            if (!nextTier) break;
            if (data.bp.xp >= nextTier.xpNeeded) {
                data.bp.xp -= nextTier.xpNeeded;
                data.bp.tier++;
            } else {
                break;
            }
        }
        save();
        return data.bp;
    }

    function claimBPReward(tierNum) {
        if (!data.bp) return { success: false, reason: 'No BP data' };
        if (tierNum > data.bp.tier) return { success: false, reason: 'Tier not reached' };
        if (data.bp.claimed.includes(tierNum)) return { success: false, reason: 'Already claimed' };

        const tierData = BP_TIERS.find(t => t.tier === tierNum);
        if (!tierData) return { success: false, reason: 'Invalid tier' };

        const r = tierData.reward;
        if (r.type === 'coins') {
            data.coins += r.amount;
        } else if (r.type === 'xp') {
            data.xp += r.amount;
            data.level = levelFromXP(data.xp);
        } else if (r.type === 'emote') {
            if (!data.unlockedEmotes) data.unlockedEmotes = [];
            if (!data.unlockedEmotes.includes(r.id)) data.unlockedEmotes.push(r.id);
        } else if (r.type === 'theme') {
            if (!data.unlockedThemes.includes(r.id)) data.unlockedThemes.push(r.id);
        }

        data.bp.claimed.push(tierNum);
        save();
        return { success: true, reward: r };
    }

    // ── Weekly Missions ────────────────────────────────────
    function getWeekStart() {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(d.setDate(diff));
        return mon.toISOString().split('T')[0];
    }

    function ensureWeeklyMissions() {
        const weekStart = getWeekStart();
        if (data.weeklyMissionDate !== weekStart) {
            generateWeeklyMissions(weekStart);
        }
    }

    function generateWeeklyMissions(weekStart) {
        const seed = weekStart.split('-').reduce((a, b) => a + parseInt(b), 0);
        const shuffled = [...WEEKLY_MISSION_TEMPLATES].sort((a, b) => {
            return hashStr(a.type + weekStart) - hashStr(b.type + weekStart);
        });

        data.weeklyMissions = shuffled.slice(0, 3).map((template, i) => {
            const params = template.params(seed + i);
            let text = template.text;
            if (params.n) text = text.replace('{n}', params.n);

            return {
                id: `w-${weekStart}-${i}`,
                type: template.type,
                text,
                params,
                completed: false,
                bpXP: template.bpXP,
            };
        });

        data.weeklyMissionDate = weekStart;
        data.weeklyProgress = {};
        save();
    }

    function getWeeklyMissions() {
        ensureWeeklyMissions();
        return data.weeklyMissions || [];
    }

    function checkWeeklyMissions() {
        if (!data.weeklyMissions) return [];
        const completed = [];

        for (const mission of data.weeklyMissions) {
            if (mission.completed) continue;
            let done = false;
            const p = mission.params;

            switch (mission.type) {
                case 'weekly_solve_total':
                    done = (data.weeklyProgress.totalSolved || 0) >= p.n;
                    break;
                case 'weekly_hard_solves':
                    done = (data.weeklyProgress.hardSolves || 0) >= p.n;
                    break;
                case 'weekly_pvp_wins':
                    done = (data.weeklyProgress.pvpWins || 0) >= p.n;
                    break;
                case 'weekly_no_mistakes':
                    done = (data.weeklyProgress.noMistakeSolves || 0) >= p.n;
                    break;
                case 'weekly_under_time':
                    done = (data.weeklyProgress.fastSolves || 0) >= p.n;
                    break;
                case 'weekly_streak':
                    done = (data.streak || 0) >= p.n;
                    break;
            }

            if (done) {
                mission.completed = true;
                addBPXP(mission.bpXP);
                completed.push(mission);
            }
        }

        save();
        return completed;
    }

    function formatTime(sec) {
        if (!sec || sec === Infinity) return '--:--';
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    return {
        load,
        save,
        awardForCompletion,
        recordLoss,
        updateELO,
        buyTheme,
        equipTheme,
        isThemeUnlocked,
        getData,
        getXP,
        getCoins,
        getLevel,
        getStreak,
        getActiveTheme,
        getThemes,
        getQuests,
        getXPProgress,
        getStats,
        getELO,
        getLeague,
        getLeagues,
        getMatchHistory,
        getPvPRecord,
        formatTime,
        xpForLevel,

        // Battle Pass
        getBPData,
        getBPTiers,
        addBPXP,
        claimBPReward,
        getWeeklyMissions,
        ensureWeeklyMissions,
        checkWeeklyMissions,
    };

})();
