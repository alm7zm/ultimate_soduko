/**
 * PvP Battle System
 * Simulates 1v1 battles against an AI opponent.
 */

const PvP = (() => {

    const BATTLE_TIME = 600; // 10 minutes

    // Realistic gamer-style usernames (no emojis)
    const AI_NAMES = [
        'xDarkSolver', 'Nxght_', 'iqR4pid', 'VoidMind', 'ZeroCool99',
        'TtvWraith', 'ShadowCalc', 'kr0n1x', 'BlazeLogic', 'FrostByte_',
        'N0va_X', 'CipherKing', 'Lynx420', 'Spectr_', 'AceVentura7',
        'ClutchCell', 'PhantomGrid', '2fast4math', 'ViperSolves', 'RektU_',
        'iSolveStuff', 'xX_Br41n_Xx', 'QuickMaffs', 'NotABot_', 'EZclap69',
        'SilentCalc', 'GhostNum', 'yolo_solver', 'BigBrainTim', 'ColdLogic',
        'SweatLord22', 'PogSolver', 'JustVibing_', 'Calc_Master', 'RNG_God',
        'touch_grass', 'GridWalker', 'Numba1Fan', 'DontBlink_', 'ez_dubs',
    ];

    // Text-based avatars (no emojis)
    const AI_AVATARS = ['AI'];

    // Base AI speed per difficulty (ms) — these are BASE values, modified by behavior patterns
    const AI_SPEED = {
        easy: { base: 3500, variance: 1500 },
        medium: { base: 5000, variance: 2000 },
        hard: { base: 7500, variance: 2500 },
        expert: { base: 10000, variance: 3500 },
        evil: { base: 15000, variance: 5000 },
    };

    let battle = null;

    /**
     * Start a new PvP battle.
     */
    function startBattle(difficulty = 'medium') {
        const seed = SudokuEngine.randomSeed();
        const data = SudokuEngine.generate(difficulty, seed);

        // Determine which cells the AI needs to fill
        const emptyCells = [];
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (data.puzzle[r][c] === 0) {
                    emptyCells.push({ row: r, col: c, val: data.solution[r][c] });
                }
            }
        }

        // Shuffle AI solving order
        shuffleArray(emptyCells);

        // Pick opponent
        let aiName, aiAvatar;
        let isBronze = false;
        try { if (Player.getLeague().id === 'bronze') isBronze = true; } catch (e) { }

        // If in Bronze, 50% chance to face explicit bot
        if (isBronze && Math.random() < 0.5) {
            aiName = 'AI Bot';
            aiAvatar = '🤖';
        } else {
            aiName = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
            const pfps = ['👻', '🦊', '🦁', '🐯', '🐼', '🐨', '🐒', '🐧', '🦉', '🦖', '🐉', '🐙', '👾', '🤠', '😎'];
            aiAvatar = pfps[Math.floor(Math.random() * pfps.length)];
        }

        const speed = AI_SPEED[difficulty] || AI_SPEED.medium;

        battle = {
            seed,
            difficulty,
            puzzle: data.puzzle,
            solution: data.solution,
            original: SudokuEngine.cloneGrid(data.puzzle),

            // Player state
            playerBoard: SudokuEngine.cloneGrid(data.puzzle),
            playerCellsFilled: 0,
            playerMistakes: 0,
            playerHints: 0,
            playerFinished: false,

            // AI state
            aiName,
            aiAvatar,
            aiCellsFilled: 0,
            aiTotalCells: emptyCells.length,
            aiCellsQueue: emptyCells,
            aiFinished: false,
            aiIntervalId: null,
            aiSpeed: speed,
            aiHints: 0,
            aiMistakes: 0,

            // AI behavior state for human-like patterns
            aiBurstRemaining: 0,       // cells left in current burst
            aiLastMistakeAt: 0,        // timestamp of last mistake
            aiConsecutiveSolves: 0,    // streak counter
            aiPhase: 'warmup',         // 'warmup', 'normal', 'focused', 'fatigue'

            // Timer
            timeRemaining: BATTLE_TIME,
            timerIntervalId: null,
            started: false,
            ended: false,

            // Result
            result: null, // 'win', 'lose', 'draw'
            eloDelta: 0,
        };

        return battle;
    }

    /**
     * Begin the battle (start timer and AI).
     */
    function beginBattle(onAIProgress, onAIGainsHint, onTimerTick, onBattleEnd) {
        if (!battle || battle.started) return;
        battle.started = true;

        // Start countdown timer
        battle.timerIntervalId = setInterval(() => {
            if (battle.ended) return;
            battle.timeRemaining--;
            if (onTimerTick) onTimerTick(battle.timeRemaining);

            if (battle.timeRemaining <= 0) {
                endBattle('timeout', onBattleEnd);
            }
        }, 1000);

        // Start AI solving
        scheduleNextAICell(onAIProgress, onAIGainsHint, onBattleEnd);
    }

    function scheduleNextAICell(onAIProgress, onAIGainsHint, onBattleEnd) {
        if (battle.ended || battle.aiFinished) return;

        const speed = battle.aiSpeed;
        const progress = battle.aiCellsFilled / battle.aiTotalCells;
        const timeSinceMistake = Date.now() - battle.aiLastMistakeAt;
        let delay;

        // ── HINT USAGE (instant-ish) ──
        if (battle.aiHints > 0 && Math.random() > 0.5) {
            battle.aiHints--;
            delay = 200 + Math.random() * 400; // 200-600ms, fast but not instant
            scheduleAIAction(delay, onAIProgress, onAIGainsHint, onBattleEnd);
            return;
        }

        // ── PHASE DETERMINATION ──
        if (progress < 0.12) {
            battle.aiPhase = 'warmup';
        } else if (progress > 0.85) {
            battle.aiPhase = 'focused'; // End sprint
        } else if (battle.aiConsecutiveSolves > 8) {
            battle.aiPhase = 'fatigue';
        } else {
            battle.aiPhase = 'normal';
        }

        // ── BASE DELAY CALCULATION ──
        let baseDelay = speed.base + (Math.random() * 2 - 1) * speed.variance;

        // ── PHASE MODIFIERS ──
        switch (battle.aiPhase) {
            case 'warmup':
                // Slower at start — studying the board
                baseDelay *= 1.4 + Math.random() * 0.6; // 1.4x - 2.0x slower
                break;
            case 'focused':
                // Faster near end — fewer cells, easier logic
                baseDelay *= 0.5 + Math.random() * 0.3; // 0.5x - 0.8x
                break;
            case 'fatigue':
                // Slowdown after long streak
                baseDelay *= 1.2 + Math.random() * 0.5;
                battle.aiConsecutiveSolves = 0; // Reset after fatigue
                break;
            default: // normal
                break;
        }

        // ── MOMENTUM: slight speedup as board fills ──
        const momentumMultiplier = 1 - (progress * 0.25); // up to 25% faster by end
        baseDelay *= momentumMultiplier;

        // ── POST-MISTAKE SLOWDOWN ──
        if (timeSinceMistake < 8000) {
            baseDelay *= 1.3 + Math.random() * 0.4; // ~1.3x-1.7x slower for 8s after mistake
        }

        // ── REACTION TO PLAYER LEAD ──
        const playerProgress = battle.playerCellsFilled / battle.aiTotalCells;
        if (playerProgress > progress + 0.15) {
            // Player is significantly ahead — AI "feels pressure", sometimes speeds up
            if (Math.random() < 0.4) {
                baseDelay *= 0.6 + Math.random() * 0.2; // rush
            }
        }

        // ── BURST SOLVING (2-4 cells quickly in a row) ──
        if (battle.aiBurstRemaining > 0) {
            baseDelay *= 0.25 + Math.random() * 0.15; // Very fast during burst
            battle.aiBurstRemaining--;
        } else if (battle.aiPhase === 'normal' && Math.random() < 0.12) {
            // 12% chance to start a burst of 2-4 cells
            battle.aiBurstRemaining = 2 + Math.floor(Math.random() * 3);
            baseDelay *= 0.3;
        }

        // ── RANDOM THINKING PAUSE ("stuck on a cell") ──
        if (battle.aiPhase === 'normal' && battle.aiBurstRemaining === 0 && Math.random() < 0.08) {
            // 8% chance of a long thinking pause (5-15 seconds)
            baseDelay = 5000 + Math.random() * 10000;
        }

        // ── MICRO-HESITATIONS (small random jitter) ──
        baseDelay += (Math.random() - 0.5) * 800;

        // Clamp to reasonable range
        delay = Math.max(400, Math.min(baseDelay, 25000));

        scheduleAIAction(delay, onAIProgress, onAIGainsHint, onBattleEnd);
    }

    function scheduleAIAction(delay, onAIProgress, onAIGainsHint, onBattleEnd) {
        battle.aiIntervalId = setTimeout(() => {
            if (battle.ended) return;

            // AI mistake chance (difficulty-dependent)
            let mistakeChance = 0.10;
            if (battle.difficulty === 'easy') mistakeChance = 0.15;
            if (battle.difficulty === 'evil') mistakeChance = 0.05;

            if (Math.random() < mistakeChance) {
                battle.aiMistakes++;
                battle.aiLastMistakeAt = Date.now();
                battle.aiConsecutiveSolves = 0;
                battle.aiBurstRemaining = 0; // Break burst on mistake
                if (battle.aiMistakes % 3 === 0) {
                    battle.playerHints++;
                    if (onAIGainsHint) onAIGainsHint();
                }
                scheduleNextAICell(onAIProgress, onAIGainsHint, onBattleEnd);
                return;
            }

            // Successful solve
            battle.aiCellsFilled++;
            battle.aiConsecutiveSolves++;
            if (onAIProgress) {
                onAIProgress(battle.aiCellsFilled, battle.aiTotalCells);
            }

            if (battle.aiCellsFilled >= battle.aiTotalCells) {
                battle.aiFinished = true;
                if (!battle.playerFinished) {
                    endBattle('ai_finished', onBattleEnd);
                }
            } else {
                scheduleNextAICell(onAIProgress, onAIGainsHint, onBattleEnd);
            }
        }, delay);
    }

    /**
     * Player places a number during battle.
     */
    function playerPlace(row, col, num) {
        if (!battle || battle.ended || battle.playerFinished) return null;
        if (battle.original[row][col] !== 0) return null;

        const correct = battle.solution[row][col];
        const isCorrect = num === correct;

        battle.playerBoard[row][col] = num;

        if (isCorrect) {
            battle.playerCellsFilled++;

            // Check if player has solved all cells
            let allFilled = true;
            for (let r = 0; r < 9; r++) {
                for (let c = 0; c < 9; c++) {
                    if (battle.playerBoard[r][c] !== battle.solution[r][c]) {
                        allFilled = false;
                        break;
                    }
                }
                if (!allFilled) break;
            }

            if (allFilled) {
                battle.playerFinished = true;
                return { isCorrect: true, finished: true };
            }
        } else {
            battle.playerMistakes++;
            // Penalty for spamming: subtract 5 seconds from the timer
            battle.timeRemaining = Math.max(0, battle.timeRemaining - 5);

            // Grant AI a hint every 3 mistakes
            if (battle.playerMistakes % 3 === 0) {
                battle.aiHints++;
            }
        }

        return { isCorrect, finished: false };
    }

    /**
     * Player uses a hint during battle.
     */
    function playerUseHint(row, col) {
        if (!battle || battle.ended || battle.playerFinished) return null;
        if (battle.playerHints <= 0) return null;
        if (battle.original[row][col] !== 0) return null;
        if (battle.playerBoard[row][col] === battle.solution[row][col]) return null;

        battle.playerHints--;
        battle.playerBoard[row][col] = battle.solution[row][col];
        battle.playerCellsFilled++;

        // Check if player has solved all cells
        let allFilled = true;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (battle.playerBoard[r][c] !== battle.solution[r][c]) {
                    allFilled = false;
                    break;
                }
            }
            if (!allFilled) break;
        }

        if (allFilled) {
            battle.playerFinished = true;
            return { used: true, finished: true };
        }

        return { used: true, finished: false };
    }

    /**
     * Player erases a cell during battle.
     */
    function playerErase(row, col) {
        if (!battle || battle.ended) return;
        if (battle.original[row][col] !== 0) return;
        if (battle.playerBoard[row][col] !== 0 &&
            battle.playerBoard[row][col] === battle.solution[row][col]) {
            battle.playerCellsFilled--;
        }
        battle.playerBoard[row][col] = 0;
    }

    /**
     * End the battle with a reason.
     */
    function endBattle(reason, callback) {
        if (battle.ended) return;
        battle.ended = true;

        clearInterval(battle.timerIntervalId);
        clearTimeout(battle.aiIntervalId);

        // Determine result
        if (reason === 'player_finished' || battle.playerFinished) {
            battle.result = 'win';
            battle.eloDelta = 25;
        } else if (reason === 'ai_finished') {
            battle.result = 'lose';
            battle.eloDelta = -25;
        } else if (reason === 'timeout') {
            // Compare progress
            const playerPct = battle.playerCellsFilled / battle.aiTotalCells;
            const aiPct = battle.aiCellsFilled / battle.aiTotalCells;
            if (playerPct > aiPct) {
                battle.result = 'win';
                battle.eloDelta = 15;
            } else if (aiPct > playerPct) {
                battle.result = 'lose';
                battle.eloDelta = -15;
            } else {
                battle.result = 'draw';
                battle.eloDelta = 0;
            }
        } else if (reason === 'quit') {
            battle.result = 'lose';
            battle.eloDelta = -25;
        }

        // Update player ELO
        Player.updateELO(battle.eloDelta, {
            result: battle.result,
            opponent: battle.aiName,
            difficulty: battle.difficulty,
            playerProgress: Math.round((battle.playerCellsFilled / battle.aiTotalCells) * 100),
            aiProgress: Math.round((battle.aiCellsFilled / battle.aiTotalCells) * 100),
            timeUsed: BATTLE_TIME - battle.timeRemaining,
        });

        if (callback) callback(battle);
    }

    /**
     * Player finishes the puzzle.
     */
    function playerFinish(callback) {
        if (!battle || battle.ended) return;
        battle.playerFinished = true;
        endBattle('player_finished', callback);
    }

    /**
     * Quit a battle.
     */
    function quitBattle(callback) {
        if (!battle || battle.ended) return;
        endBattle('quit', callback);
    }

    function getBattle() { return battle; }
    function isActive() { return battle && battle.started && !battle.ended; }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    return {
        startBattle,
        beginBattle,
        playerPlace,
        playerUseHint,
        playerErase,
        playerFinish,
        quitBattle,
        getBattle,
        isActive,
        formatTime,
        BATTLE_TIME,
    };

})();
