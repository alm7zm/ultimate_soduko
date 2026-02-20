/**
 * UI Renderer — Phase 3
 * Handles screens, battle flow, shop, profile, themes, and animations.
 */

const UI = (() => {

    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    let boardEl, timerEl, mistakesEl, hintsEl, difficultyEl;

    // Battle state
    let battleSelectedCell = null;
    let lastSeed = null;
    let lastDifficulty = null;

    // Settings
    const SETTINGS_KEY = 'sudoku_settings';
    let settings = {
        highlightSame: true,
        highlightRelated: true,
        autoNotes: true,
        showTimer: true,
        showMistakes: true,
        errorCheck: true,
    };

    function loadSettings() {
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) settings = { ...settings, ...JSON.parse(raw) };
        } catch (e) { /* ignore */ }
    }

    function saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    }

    function applySettingsToUI() {
        const map = {
            'setting-highlight-same': 'highlightSame',
            'setting-highlight-related': 'highlightRelated',
            'setting-auto-notes': 'autoNotes',
            'setting-show-timer': 'showTimer',
            'setting-show-mistakes': 'showMistakes',
            'setting-error-check': 'errorCheck',
        };
        for (const [id, key] of Object.entries(map)) {
            const el = $(`#${id}`);
            if (el) el.checked = settings[key];
        }
        // Sound toggle
        const soundEl = $('#setting-sound-effects');
        if (soundEl) soundEl.checked = !Sound.isMuted();
    }

    // ── Initialise ─────────────────────────────────────────
    function init() {
        boardEl = $('#board');
        timerEl = $('#timer');
        mistakesEl = $('#mistakes');
        hintsEl = $('#hints-count');
        difficultyEl = $('#current-difficulty');

        Player.load();
        loadSettings();
        Sound.init();
        Emote.init();
        buildBoard();
        buildBattleBoard();
        bindEvents();
        applyTheme(Player.getActiveTheme());
        applySettingsToUI();

        // Seamless video loop fix
        const video = document.querySelector('.main-screen-video-bg');
        if (video) {
            video.addEventListener('timeupdate', () => {
                if (video.duration - video.currentTime < 0.3) {
                    video.currentTime = 0;
                    video.play();
                }
            });
        }

        // Check for challenge URL
        const params = new URLSearchParams(window.location.search);
        const seed = params.get('seed');
        const diff = params.get('diff');
        if (seed && diff) {
            startNewGame(diff, parseInt(seed));
            return;
        }

        // Always show menu on startup
        showScreen('menu');
        updateMenuStats();

    }

    // ── Build 9×9 Board ───────────────────────────────────
    function buildBoard() {
        boardEl.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = createCell(r, c, false);
                cell.addEventListener('click', () => onCellClick(r, c));
                boardEl.appendChild(cell);
            }
        }
    }

    function buildBattleBoard() {
        const bb = $('#battle-board');
        if (!bb) return;
        bb.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = createCell(r, c, true);
                cell.addEventListener('click', () => onBattleCellClick(r, c));
                bb.appendChild(cell);
            }
        }
    }

    function createCell(r, c, isBattle) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.row = r;
        cell.dataset.col = c;
        if (isBattle) cell.dataset.battle = '1';

        if (c % 3 === 0 && c !== 0) cell.classList.add('box-left');
        if (r % 3 === 0 && r !== 0) cell.classList.add('box-top');

        const notesGrid = document.createElement('div');
        notesGrid.classList.add('notes-grid');
        for (let n = 1; n <= 9; n++) {
            const noteCell = document.createElement('span');
            noteCell.classList.add('note');
            noteCell.dataset.note = n;
            notesGrid.appendChild(noteCell);
        }
        cell.appendChild(notesGrid);

        const val = document.createElement('span');
        val.classList.add('cell-value');
        cell.appendChild(val);
        return cell;
    }

    // ── Render Board State ─────────────────────────────────
    function renderBoard(st) {
        if (!st) st = Game.getState();
        const selected = st.selectedCell;
        const selectedVal = selected ? st.puzzle[selected.row][selected.col] : null;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = boardEl.children[r * 9 + c];
                const val = st.puzzle[r][c];
                const isOrig = Game.isOriginalCell(r, c);
                const valEl = cell.querySelector('.cell-value');
                const notesEl = cell.querySelector('.notes-grid');

                cell.classList.remove('selected', 'highlighted', 'same-number', 'error', 'original', 'user-filled', 'hint-cell', 'related');
                if (isOrig) cell.classList.add('original');

                if (val !== 0) {
                    valEl.textContent = val;
                    notesEl.style.display = 'none';
                    valEl.style.display = '';
                    if (!isOrig) {
                        cell.classList.add('user-filled');
                        // Setting Error Check
                        if (settings.errorCheck && val !== st.solution[r][c]) {
                            cell.classList.add('error');
                        }
                    }
                } else {
                    valEl.textContent = '';
                    valEl.style.display = 'none';
                    const cellNotes = st.notes[r][c];
                    if (cellNotes && cellNotes.size > 0) {
                        notesEl.style.display = '';
                        for (let n = 1; n <= 9; n++) {
                            notesEl.querySelector(`[data-note="${n}"]`).textContent = cellNotes.has(n) ? n : '';
                        }
                    } else {
                        notesEl.style.display = 'none';
                    }
                }

                if (selected) {
                    if (r === selected.row && c === selected.col) cell.classList.add('selected');

                    // Setting Highlight Related
                    if (settings.highlightRelated &&
                        (r === selected.row || c === selected.col ||
                            (Math.floor(r / 3) === Math.floor(selected.row / 3) &&
                                Math.floor(c / 3) === Math.floor(selected.col / 3)))) {
                        cell.classList.add('related');
                    }

                    // Setting Highlight Same
                    if (settings.highlightSame && selectedVal && selectedVal !== 0 && val === selectedVal) {
                        cell.classList.add('same-number');
                    }
                }
            }
        }
        updateNumberPad();
    }

    // ── Render Battle Board ────────────────────────────────
    function renderBattleBoard() {
        const battle = PvP.getBattle();
        if (!battle) return;
        const bb = $('#battle-board');
        const board = battle.playerBoard;
        const solution = battle.solution;
        const original = battle.original;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const cell = bb.children[r * 9 + c];
                const val = board[r][c];
                const isOrig = original[r][c] !== 0;
                const valEl = cell.querySelector('.cell-value');
                const notesEl = cell.querySelector('.notes-grid');
                notesEl.style.display = 'none';

                cell.classList.remove('selected', 'related', 'same-number', 'error', 'original', 'user-filled');
                if (isOrig) cell.classList.add('original');

                if (val !== 0) {
                    valEl.textContent = val;
                    valEl.style.display = '';
                    if (!isOrig) {
                        cell.classList.add('user-filled');
                        // Setting Error Check
                        if (settings.errorCheck && val !== solution[r][c]) {
                            cell.classList.add('error');
                        }
                    }
                } else {
                    valEl.textContent = '';
                    valEl.style.display = 'none';
                }

                if (battleSelectedCell) {
                    const selectedVal = board[battleSelectedCell.row][battleSelectedCell.col];

                    if (r === battleSelectedCell.row && c === battleSelectedCell.col) {
                        cell.classList.add('selected');
                    }

                    // Setting Highlight Related
                    if (settings.highlightRelated &&
                        (r === battleSelectedCell.row || c === battleSelectedCell.col ||
                            (Math.floor(r / 3) === Math.floor(battleSelectedCell.row / 3) &&
                                Math.floor(c / 3) === Math.floor(battleSelectedCell.col / 3)))) {
                        cell.classList.add('related');
                    }

                    // Setting Highlight Same
                    if (settings.highlightSame && selectedVal && selectedVal !== 0 && val === selectedVal) {
                        cell.classList.add('same-number');
                    }
                }
            }
        }
    }

    // ── Info Bar ───────────────────────────────────────────
    function updateInfoBar(st) {
        if (!st) st = Game.getState();

        // Settings for mistakes and timer
        mistakesEl.parentElement.style.display = settings.showMistakes ? '' : 'none';
        mistakesEl.textContent = `${st.mistakes}/${Game.getMaxMistakes()}`;

        hintsEl.textContent = `${Game.getMaxHints() - st.hintsUsed}`;
        difficultyEl.textContent = capitalize(st.difficulty);

        timerEl.parentElement.style.display = settings.showTimer ? '' : 'none';
        updateTimer(st.timer);
    }

    function updateTimer(seconds) {
        if (timerEl) timerEl.textContent = Game.formatTime(seconds);
    }

    function updateNumberPad() {
        const counts = Game.getNumberCounts();
        for (let n = 1; n <= 9; n++) {
            const btn = $(`#numpad [data-num="${n}"]`);
            if (btn) btn.classList.toggle('completed', counts[n] >= 9);
        }
    }

    function updateBattleNumberPad() {
        const battle = PvP.getBattle();
        if (!battle) return;

        const counts = {};
        for (let n = 1; n <= 9; n++) counts[n] = 0;

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const v = battle.playerBoard[r][c];
                if (v >= 1 && v <= 9) counts[v]++;
            }
        }

        for (let n = 1; n <= 9; n++) {
            const btn = $(`#battle-numpad [data-bnum="${n}"]`);
            if (btn) btn.classList.toggle('completed', counts[n] >= 9);
        }
    }

    function updateMenuStats() {
        $('#menu-streak').textContent = Player.getStreak();
        $('#menu-coins').textContent = Player.getCoins();
        $('#menu-level').textContent = Player.getLevel();
        const league = Player.getLeague();
        const leagueIcon = $('#menu-league-icon');
        if (leagueIcon) leagueIcon.textContent = league.icon;
        // Hide bottom nav on menu
        const nav = $('#bottom-nav');
        if (nav) nav.style.display = 'none';
    }

    // ── Event Binding ──────────────────────────────────────
    function bindEvents() {
        // Difficulty buttons (works for both old and main-style)
        $$('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => startNewGame(btn.dataset.difficulty));
        });

        // OW Play toggle (expand/collapse difficulty submenu)
        $('#main-play-toggle')?.addEventListener('click', () => {
            Sound.uiClick();
            const sub = $('#main-difficulty-submenu');
            const arrow = $('#main-play-arrow');
            if (sub) sub.classList.toggle('open');
            if (arrow) arrow.classList.toggle('open');
        });

        // OW Nav buttons
        $('#main-nav-battle')?.addEventListener('click', () => {
            Sound.uiClick();
            showScreen('battle');
            renderBattleScreen();
            $('#bottom-nav').style.display = '';
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            $('#nav-battle')?.classList.add('active');
        });
        $('#main-nav-shop')?.addEventListener('click', () => {
            Sound.uiClick();
            showScreen('shop');
            renderShop();
            $('#bottom-nav').style.display = '';
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            $('#nav-shop')?.classList.add('active');
        });
        $('#main-nav-profile')?.addEventListener('click', () => {
            Sound.uiClick();
            showScreen('profile');
            renderProfile();
            $('#bottom-nav').style.display = '';
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            $('#nav-profile')?.classList.add('active');
        });
        $('#main-nav-quests')?.addEventListener('click', () => {
            showScreen('profile');
            renderProfile();
            $('#bottom-nav').style.display = '';
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            $('#nav-profile')?.classList.add('active');
        });
        $('#main-nav-bp')?.addEventListener('click', () => {
            Sound.uiClick();
            showScreen('battlepass');
            renderBattlePass();
            $('#bottom-nav').style.display = '';
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            $('#nav-bp')?.classList.add('active');
        });

        // Number pad
        $$('#numpad [data-num]').forEach(btn => {
            btn.addEventListener('click', () => onNumberInput(parseInt(btn.dataset.num)));
        });

        // Tool buttons
        $('#btn-undo')?.addEventListener('click', onUndo);
        $('#btn-redo')?.addEventListener('click', onRedo);
        $('#btn-erase')?.addEventListener('click', onErase);
        $('#btn-notes')?.addEventListener('click', onToggleNotes);
        $('#btn-hint')?.addEventListener('click', onHint);
        $('#btn-new-game')?.addEventListener('click', () => { exitGameMode(); showScreen('menu'); updateMenuStats(); });
        $('#btn-pause')?.addEventListener('click', onPause);

        // Overlay buttons
        $('#btn-play-again')?.addEventListener('click', () => { hideOverlay(); exitGameMode(); showScreen('menu'); updateMenuStats(); });
        $('#btn-play-again-lose')?.addEventListener('click', () => { hideOverlay(); exitGameMode(); showScreen('menu'); updateMenuStats(); });
        $('#btn-resume')?.addEventListener('click', () => { Game.togglePause(); hideOverlay(); });

        // Challenge button
        $('#btn-challenge')?.addEventListener('click', onChallengeClick);

        // Bottom nav
        $$('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const screen = btn.dataset.screen;
                exitGameMode();
                showScreen(screen);
                $$('.nav-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (screen === 'menu') {
                    updateMenuStats();
                } else {
                    $('#bottom-nav').style.display = '';
                }
                if (screen === 'shop') renderShop();
                if (screen === 'profile') renderProfile();
                if (screen === 'battle') renderBattleScreen();
            });
        });

        // Battle difficulty buttons
        $$('.battle-diff-btn').forEach(btn => {
            btn.addEventListener('click', () => onStartBattle(btn.dataset.diff));
        });

        // Battle numpad
        $$('[data-bnum]').forEach(btn => {
            btn.addEventListener('click', () => onBattleNumberInput(parseInt(btn.dataset.bnum)));
        });

        // Battle tools
        $('#btn-battle-hint')?.addEventListener('click', onBattleHint);
        $('#btn-battle-erase')?.addEventListener('click', onBattleErase);
        $('#btn-battle-quit')?.addEventListener('click', onBattleQuit);

        // Emote system
        $('#btn-battle-emote')?.addEventListener('click', () => {
            if (emotePickerOpen) closeEmotePicker();
            else openEmotePicker();
        });
        $('#emote-picker-close')?.addEventListener('click', closeEmotePicker);
        $('#btn-emote-mute')?.addEventListener('click', () => {
            Emote.setMuted(!Emote.isMuted());
            updateMuteButton();
            Sound.uiClick();
        });

        // Battle result done
        $('#btn-battle-done')?.addEventListener('click', () => {
            hideOverlay();
            exitGameMode();
            showScreen('battle');
            renderBattleScreen();
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            $('#nav-battle')?.classList.add('active');
        });

        // Keyboard
        document.addEventListener('keydown', onKeyDown);

        // Settings
        $('#btn-open-settings')?.addEventListener('click', () => {
            showScreen('settings');
            applySettingsToUI();
            document.body.classList.remove('in-game');
        });

        $('#btn-settings-back')?.addEventListener('click', () => {
            showScreen('menu');
            updateMenuStats();
            $$('.nav-btn').forEach(b => b.classList.remove('active'));
            $('#nav-play')?.classList.add('active');
        });

        // Setting toggle listeners
        const settingMap = {
            'setting-highlight-same': 'highlightSame',
            'setting-highlight-related': 'highlightRelated',
            'setting-auto-notes': 'autoNotes',
            'setting-show-timer': 'showTimer',
            'setting-show-mistakes': 'showMistakes',
            'setting-error-check': 'errorCheck',
            'setting-sound-effects': 'soundEffects', // Added sound effects setting
        };
        for (const [id, key] of Object.entries(settingMap)) {
            $(`#${id}`)?.addEventListener('change', (e) => {
                if (key === 'soundEffects') {
                    Sound.setMuted(!e.target.checked);
                } else {
                    settings[key] = e.target.checked;
                }
                saveSettings();
                renderBoard(); // Re-render to show/hide highlights/errors live
                updateInfoBar(); // Update timer/mistakes visibility
                // Game handles autoNotes internally based on checking the global `UI.getSettings()` if we exposed it, or we just pass it to `Game.placeNumber()`
            });
        }

        // Reset progress
        $('#btn-reset-progress')?.addEventListener('click', () => {
            showOverlay('reset-confirm');
        });
        $('#btn-confirm-reset')?.addEventListener('click', () => {
            localStorage.removeItem('sudoku_player');
            localStorage.removeItem('sudoku_save');
            localStorage.removeItem(SETTINGS_KEY);
            settings = { highlightSame: true, highlightRelated: true, autoNotes: true, showTimer: true, showMistakes: true, errorCheck: true };
            Player.load();
            Game.clearSave();
            hideOverlay();
            showScreen('settings');
            applySettingsToUI();
            showXPToast('Progress has been reset');
        });
        $('#btn-cancel-reset')?.addEventListener('click', () => {
            hideOverlay();
        });
    }

    // ── Game Mode ──────────────────────────────────────────
    function enterGameMode() { document.body.classList.add('in-game'); }
    function exitGameMode() { document.body.classList.remove('in-game'); }

    // ── Cell Click ─────────────────────────────────────────
    function onCellClick(row, col) {
        if (Game.isGameOver()) return;
        Sound.cellTap();
        Game.selectCell(row, col);
        renderBoard();
    }

    function onNumberInput(num) {
        const result = Game.placeNumber(num, settings.autoNotes);
        if (!result) return;

        if (result.note) {
            Sound.noteToggle();
        } else if (result.isCorrect) {
            Sound.numberCorrect();
        } else {
            Sound.numberWrong();
        }

        renderBoard();
        updateInfoBar();
        if (result.gameOver) {
            setTimeout(() => result.won ? showWinScreen() : showLoseScreen(), 400);
        } else if (settings.errorCheck && !result.isCorrect && !result.note) {
            const st = Game.getState();
            if (st.selectedCell) {
                const cell = boardEl.children[st.selectedCell.row * 9 + st.selectedCell.col];
                cell.classList.add('shake');
                setTimeout(() => cell.classList.remove('shake'), 500);
            }
        }
    }

    function onUndo() { Sound.undo(); if (Game.undo()) renderBoard(); }
    function onRedo() { Sound.undo(); if (Game.redo()) renderBoard(); }
    function onErase() { Sound.erase(); Game.eraseCell(); renderBoard(); }

    function onToggleNotes() {
        Sound.noteToggle();
        const isNotes = Game.toggleNotesMode();
        $('#btn-notes').classList.toggle('active', isNotes);
    }

    function onHint() {
        const result = Game.useHint();
        if (!result) {
            const btn = $('#btn-hint');
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 500);
            return;
        }
        Sound.hint();
        renderBoard();
        updateInfoBar();
        if (Game.isGameOver() && Game.hasWon()) setTimeout(showWinScreen, 400);
    }

    function onPause() {
        const paused = Game.togglePause();
        if (paused) { Sound.pause(); showOverlay('pause'); }
        else { Sound.resume(); hideOverlay(); }
    }

    function onKeyDown(e) {
        // Battle mode keyboard support
        if ($('#screen-battle-active')?.classList.contains('active')) {
            if (!battleSelectedCell) return;
            const battle = PvP.getBattle();
            if (!battle || battle.ended) return;

            if (e.key >= '1' && e.key <= '9') onBattleNumberInput(parseInt(e.key));
            else if (e.key === 'Backspace' || e.key === 'Delete') onBattleErase();
            else if (e.key === 'ArrowUp' && battleSelectedCell.row > 0) { battleSelectedCell.row--; renderBattleBoard(); }
            else if (e.key === 'ArrowDown' && battleSelectedCell.row < 8) { battleSelectedCell.row++; renderBattleBoard(); }
            else if (e.key === 'ArrowLeft' && battleSelectedCell.col > 0) { battleSelectedCell.col--; renderBattleBoard(); }
            else if (e.key === 'ArrowRight' && battleSelectedCell.col < 8) { battleSelectedCell.col++; renderBattleBoard(); }
            return;
        }

        // Regular game keyboard support
        if (!$('#screen-game')?.classList.contains('active')) return;
        const st = Game.getState();
        if (!st.selectedCell || st.gameOver) return;
        const { row, col } = st.selectedCell;

        if (e.key >= '1' && e.key <= '9') onNumberInput(parseInt(e.key));
        else if (e.key === 'Backspace' || e.key === 'Delete') onErase();
        else if (e.key === 'ArrowUp' && row > 0) { Game.selectCell(row - 1, col); renderBoard(); }
        else if (e.key === 'ArrowDown' && row < 8) { Game.selectCell(row + 1, col); renderBoard(); }
        else if (e.key === 'ArrowLeft' && col > 0) { Game.selectCell(row, col - 1); renderBoard(); }
        else if (e.key === 'ArrowRight' && col < 8) { Game.selectCell(row, col + 1); renderBoard(); }
        else if (e.key === 'z' && e.ctrlKey) onUndo();
        else if (e.key === 'y' && e.ctrlKey) onRedo();
        else if (e.key === 'n' || e.key === 'N') onToggleNotes();
    }

    // ── Screens & Overlays ─────────────────────────────────
    function showScreen(name) {
        $$('.screen').forEach(s => s.classList.remove('active'));
        $(`#screen-${name}`)?.classList.add('active');
    }

    function startNewGame(difficulty, seed = null) {
        Game.clearSave();
        const st = Game.newGame(difficulty, seed);
        lastSeed = st.seed || seed;
        lastDifficulty = difficulty;
        renderBoard(st);
        updateInfoBar(st);
        $('#btn-notes')?.classList.remove('active');
        showScreen('game');
        enterGameMode();
        const nav = $('#bottom-nav');
        if (nav) nav.style.display = '';
        boardEl.classList.add('board-enter');
        setTimeout(() => boardEl.classList.remove('board-enter'), 600);
    }

    function showOverlay(type) {
        const overlay = $('#overlay');
        overlay.classList.add('active');
        $$('.overlay-content').forEach(c => c.classList.remove('active'));
        $(`#overlay-${type}`)?.classList.add('active');
    }

    function hideOverlay() {
        $('#overlay').classList.remove('active');
    }

    // ── Win / Lose ─────────────────────────────────────────
    function showWinScreen() {
        Sound.win();
        const st = Game.getState();
        const notesUsed = st.history.some(h => h.note);
        const reward = Player.awardForCompletion(st.difficulty, st.timer, st.mistakes, st.hintsUsed, notesUsed);

        $('#win-time').textContent = Game.formatTime(st.timer);
        $('#win-mistakes').textContent = st.mistakes;
        $('#win-difficulty').textContent = capitalize(st.difficulty);
        $('#win-xp').textContent = `+${reward.xp} XP`;
        $('#win-coins').textContent = `+${reward.coins}`;

        const levelUpEl = $('#win-level-up');
        if (reward.leveledUp) { levelUpEl.style.display = ''; $('#win-new-level').textContent = `Level ${reward.newLevel}`; }
        else levelUpEl.style.display = 'none';

        const questsEl = $('#win-quests-completed');
        if (reward.completedQuests.length > 0) {
            questsEl.style.display = '';
            questsEl.innerHTML = reward.completedQuests.map(q => `<div class="quest-complete-item">✅ ${q.text} — +${q.xpReward} XP, +${q.coinReward} 🪙</div>`).join('');
        } else questsEl.style.display = 'none';

        showOverlay('win');
        createConfetti();
        showXPToast(`+${reward.xp} XP  •  +${reward.coins} 🪙`);
    }

    function showLoseScreen() {
        Sound.lose();
        Player.recordLoss();
        showOverlay('lose');
    }

    // ── Challenge ──────────────────────────────────────────
    function onChallengeClick() {
        const st = Game.getState();
        const seed = lastSeed || SudokuEngine.randomSeed();
        const diff = st.difficulty || lastDifficulty || 'medium';
        const url = `${window.location.origin}${window.location.pathname}?seed=${seed}&diff=${diff}`;

        navigator.clipboard.writeText(url).then(() => {
            const toast = $('#copied-toast');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 2500);
        }).catch(() => {
            prompt('Copy this challenge link:', url);
        });
    }

    // ── XP Toast & Confetti ────────────────────────────────
    function showXPToast(text) {
        const toast = $('#xp-toast');
        $('#xp-toast-text').textContent = text;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    function createConfetti() {
        const container = $('#confetti');
        container.innerHTML = '';
        const colors = ['#6c63ff', '#ff6584', '#43e97b', '#f8d800', '#00d2ff', '#ff9a9e'];
        for (let i = 0; i < 60; i++) {
            const piece = document.createElement('div');
            piece.classList.add('confetti-piece');
            piece.style.left = Math.random() * 100 + '%';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 2 + 's';
            piece.style.animationDuration = (2 + Math.random() * 2) + 's';
            container.appendChild(piece);
        }
        setTimeout(() => container.innerHTML = '', 5000);
    }

    // ── Theme ──────────────────────────────────────────────
    function applyTheme(themeId) {
        document.body.className = '';
        if (themeId && themeId !== 'default') document.body.classList.add(`theme-${themeId}`);
    }

    // ═══════════════════════════════════════════════════════
    // ── BATTLE FLOW ────────────────────────────────────────
    // ═══════════════════════════════════════════════════════

    function renderBattleScreen() {
        const league = Player.getLeague();
        const record = Player.getPvPRecord();

        $('#battle-league-icon').textContent = league.icon;
        $('#battle-league-name').textContent = league.name;
        $('#battle-elo').textContent = Player.getELO();
        $('#pvp-wins').textContent = record.wins;
        $('#pvp-losses').textContent = record.losses;
        $('#pvp-draws').textContent = record.draws;

        renderMatchHistory();
    }

    function renderMatchHistory() {
        const history = Player.getMatchHistory();
        const list = $('#match-history-list');
        if (!list) return;

        if (history.length === 0) {
            list.innerHTML = '<p class="empty-state">No matches yet. Start a battle!</p>';
            return;
        }

        list.innerHTML = history.map(m => {
            const resultClass = m.result;
            const resultText = m.result === 'win' ? 'Victory' : m.result === 'lose' ? 'Defeat' : 'Draw';
            const eloSign = m.eloDelta > 0 ? '+' : '';
            return `
        <div class="match-card ${resultClass}">
          <div class="match-left">
            <span class="match-opponent">vs ${m.opponent}</span>
            <span class="match-detail">${capitalize(m.difficulty)} • You ${m.playerProgress}% / AI ${m.aiProgress}%</span>
          </div>
          <div class="match-right">
            <span class="match-result ${resultClass}">${resultText}</span>
            <span class="match-elo-change">${eloSign}${m.eloDelta} ELO → ${m.elo}</span>
          </div>
        </div>
      `;
        }).join('');
    }

    function onStartBattle(difficulty) {
        // Show matchmaking overlay
        const overlay = $('#overlay-matchmaking');
        if (overlay) {
            overlay.querySelector('.overlay-title').textContent = 'Finding Opponent...';
            overlay.querySelector('#matchmaking-text').textContent = `Rank: ${Player.getLeague().name}`;
            overlay.querySelector('.matchmaking-spinner').style.display = 'block';
        }
        showOverlay('matchmaking');
        enterGameMode();

        // Simulate matchmaking delay (2 to 5 seconds)
        const queueTime = 2000 + Math.random() * 3000;

        setTimeout(() => {
            if (overlay) {
                overlay.querySelector('.overlay-title').textContent = 'Match Found!';
                overlay.querySelector('#matchmaking-text').textContent = 'Preparing board...';
                overlay.querySelector('.matchmaking-spinner').style.display = 'none';
            }
            Sound.notification();

            setTimeout(() => {
                hideOverlay();

                // Init battle
                const battle = PvP.startBattle(difficulty);
                battleSelectedCell = null;

                // Update UI
                $('#ai-avatar').textContent = battle.aiAvatar;
                $('#ai-name').textContent = battle.aiName;
                $('#battle-timer').textContent = PvP.formatTime(battle.timeRemaining);
                $('#battle-mistakes').textContent = '0/3';
                $('#player-progress').style.width = '0%';
                $('#ai-progress').style.width = '0%';

                $('#ai-hints-badge').style.display = 'none';
                $('#ai-hints-count').textContent = '0';
                $('#player-hints-badge').style.display = 'none';
                $('#player-hints-badge-count').textContent = '0';
                $('#battle-hints-count').textContent = battle.playerHints;

                showScreen('battle-active');
                renderBattleBoard();
                updateBattleNumberPad();

                // Start battle
                PvP.beginBattle(
                    // AI progress callback
                    (filled, total) => {
                        const pct = Math.round((filled / total) * 100);
                        $('#ai-progress').style.width = pct + '%';

                        // AI taunts when on a streak
                        const b = PvP.getBattle();
                        if (b && b.aiConsecutiveSolves >= 4 && b.aiConsecutiveSolves % 4 === 0) {
                            triggerAIEmote('onAISolveStreak');
                        }
                        // AI reacts to player being ahead
                        const playerProg = b ? b.playerCellsFilled / b.aiTotalCells : 0;
                        const aiProg = filled / total;
                        if (playerProg > aiProg + 0.2 && Math.random() < 0.15) {
                            triggerAIEmote('onPlayerAhead');
                        }
                    },
                    // AI grants player hint callback
                    () => {
                        Sound.notification();
                        triggerAIEmote('onAIMistake');
                        const hints = PvP.getBattle().playerHints;
                        $('#battle-hints-count').textContent = hints;
                        $('#player-hints-badge').style.display = 'inline-block';
                        $('#player-hints-badge-count').textContent = hints;

                        const toast = $('#hint-toast');
                        if (toast) {
                            $('#hint-toast-text').innerText = '💡 You gained a hint from opponent\'s mistake!';
                            toast.classList.add('show');
                            setTimeout(() => toast.classList.remove('show'), 3500);
                        }
                    },
                    // Timer tick callback
                    (remaining) => {
                        $('#battle-timer').textContent = PvP.formatTime(remaining);
                        if (remaining <= 60) {
                            $('#battle-timer').style.color = 'var(--danger)';
                        }

                        // Periodic UI update: update AI hints if AI used a hint
                        if (battle.aiHints > 0) {
                            $('#ai-hints-badge').style.display = 'inline-block';
                            $('#ai-hints-count').textContent = battle.aiHints;
                        } else {
                            $('#ai-hints-badge').style.display = 'none';
                        }
                    },
                    // Battle end callback
                    (battle) => {
                        showBattleResult(battle);
                    }
                );

                Sound.battleStart();
                triggerAIEmote('onBattleStart');
                updateMuteButton();

            }, 1000); // 1s wait after match found
        }, queueTime); // wait for queue
    }
    function onBattleCellClick(row, col) {
        const battle = PvP.getBattle();
        if (!battle || battle.ended) return;
        if (battle.original[row][col] !== 0) return;

        battleSelectedCell = { row, col };
        renderBattleBoard();
    }

    function onBattleNumberInput(num) {
        if (!battleSelectedCell) return;
        const { row, col } = battleSelectedCell;

        const battle = PvP.getBattle();
        const prevMistakes = battle ? battle.playerMistakes : 0;

        const result = PvP.playerPlace(row, col, num);
        if (!result) return;

        // Update mistakes counter UI
        const mistakesEl = $('#battle-mistakes');
        if (mistakesEl) {
            mistakesEl.textContent = `${battle.playerMistakes % 3}/3`;
        }

        if (battle.playerMistakes > prevMistakes && battle.playerMistakes % 3 === 0) {
            // Show hint toast
            const toast = $('#hint-toast');
            if (toast) {
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3500);
            }
            $('#ai-hints-badge').style.display = 'inline-block';
            $('#ai-hints-count').textContent = battle.aiHints;
        }

        // AI reacts to player mistakes
        if (battle.playerMistakes > prevMistakes) {
            triggerAIEmote('onPlayerMistake');
        }

        if (result.isCorrect) {
            Sound.numberCorrect();
            const pct = Math.round((battle.playerCellsFilled / battle.aiTotalCells) * 100);
            $('#player-progress').style.width = pct + '%';
            updateBattleNumberPad();

            if (result.finished) {
                PvP.playerFinish((bt) => showBattleResult(bt));
            }
        } else {
            Sound.numberWrong();
            // Shake cell
            if (settings.errorCheck) {
                const bb = $('#battle-board');
                const cell = bb.children[row * 9 + col];
                cell.classList.add('shake');
                setTimeout(() => cell.classList.remove('shake'), 500);
            }

            // Show time penalty visual
            Sound.penalty();
            const timerEl = $('#battle-timer');
            if (timerEl) {
                timerEl.classList.add('penalty-shake');
                timerEl.style.color = 'var(--text-error)';
                setTimeout(() => {
                    timerEl.classList.remove('penalty-shake');
                    timerEl.style.color = ''; // revert to default or whatever it was
                }, 500);
            }
        }

        renderBattleBoard();
    }

    function onBattleHint() {
        if (!battleSelectedCell) return;
        const battle = PvP.getBattle();
        if (!battle || battle.playerHints <= 0) return;

        const { row, col } = battleSelectedCell;
        const result = PvP.playerUseHint(row, col);

        if (result && result.used) {
            Sound.hint();
            $('#battle-hints-count').textContent = battle.playerHints;
            if (battle.playerHints > 0) {
                $('#player-hints-badge-count').textContent = battle.playerHints;
            } else {
                $('#player-hints-badge').style.display = 'none';
            }

            const pct = Math.round((battle.playerCellsFilled / battle.aiTotalCells) * 100);
            $('#player-progress').style.width = pct + '%';
            updateBattleNumberPad();

            if (result.finished) {
                PvP.playerFinish((bt) => showBattleResult(bt));
            }
            renderBattleBoard();
        } else {
            const btn = $('#btn-battle-hint');
            btn.classList.add('shake');
            setTimeout(() => btn.classList.remove('shake'), 500);
        }
    }

    function onBattleErase() {
        if (!battleSelectedCell) return;
        PvP.playerErase(battleSelectedCell.row, battleSelectedCell.col);
        renderBattleBoard();
    }

    function onBattleQuit() {
        PvP.quitBattle((bt) => showBattleResult(bt));
    }

    function showBattleResult(battle) {
        const emoji = battle.result === 'win' ? '🏆' : battle.result === 'lose' ? '😤' : '🤝';
        const title = battle.result === 'win' ? 'Victory!' : battle.result === 'lose' ? 'Defeat' : 'Draw';
        const subtitle = battle.result === 'win'
            ? `You beat ${battle.aiName}! +15 🪙 +75 XP`
            : battle.result === 'lose'
                ? `${battle.aiName} solved it first. Keep practicing!`
                : 'Time ran out. Both sides fought well!';

        const league = Player.getLeague();

        $('#battle-result-emoji').textContent = emoji;
        $('#battle-result-title').textContent = title;
        $('#battle-result-subtitle').textContent = subtitle;
        $('#battle-result-elo-change').textContent = (battle.eloDelta > 0 ? '+' : '') + battle.eloDelta;
        $('#battle-result-new-elo').textContent = Player.getELO();
        $('#battle-result-league').textContent = league.icon + ' ' + league.name;

        showOverlay('battle-result');

        if (battle.result === 'win') {
            Sound.battleWin();
            createConfetti();
            showXPToast(`+75 XP  •  +15 🪙  •  ${(battle.eloDelta > 0 ? '+' : '') + battle.eloDelta} ELO`);
            triggerAIEmote('onBattleLose');
        } else if (battle.result === 'lose') {
            Sound.battleLose();
            triggerAIEmote('onBattleWin');
        }
    }

    // ═══════════════════════════════════════════════════════
    // ── EMOTE SYSTEM ──────────────────────────────────────
    // ═══════════════════════════════════════════════════════

    let emotePickerOpen = false;
    let emoteCooldownTimer = null;

    function renderEmotePicker() {
        const grid = $('#emote-picker-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const allEmotes = Emote.getAllEmotes();
        const onCooldown = Emote.getCooldownRemaining() > 0;

        allEmotes.forEach(emote => {
            const item = document.createElement('button');
            item.classList.add('emote-picker-item');
            if (emote.type === 'text') item.classList.add('text-emote');

            const unlocked = Emote.isEmoteUnlocked(emote.id);
            if (!unlocked) item.classList.add('locked');
            if (onCooldown && unlocked) item.classList.add('on-cooldown');

            item.textContent = emote.display;
            item.title = unlocked ? emote.label : `🔒 Buy in Shop (${emote.price} coins)`;

            if (unlocked) {
                item.addEventListener('click', () => {
                    const sent = Emote.playerSend(emote.id);
                    if (sent) {
                        showEmoteBubble(sent, 'player');
                        closeEmotePicker();
                        startCooldownBar();
                    }
                });
            }

            grid.appendChild(item);
        });
    }

    function openEmotePicker() {
        renderEmotePicker();
        $('#emote-picker')?.classList.add('open');
        emotePickerOpen = true;
        Sound.uiClick();
    }

    function closeEmotePicker() {
        $('#emote-picker')?.classList.remove('open');
        emotePickerOpen = false;
    }

    function showEmoteBubble(emote, sender) {
        const container = $('#emote-display');
        if (!container) return;

        const bubble = document.createElement('div');
        bubble.classList.add('emote-bubble');
        bubble.classList.add(sender === 'player' ? 'player-bubble' : 'ai-bubble');
        if (emote.type === 'text') bubble.classList.add('text-bubble');
        bubble.textContent = emote.display;

        container.appendChild(bubble);

        // Remove after animation (2.5s)
        setTimeout(() => {
            bubble.remove();
        }, 2600);
    }

    function startCooldownBar() {
        const bar = $('#emote-cooldown-bar');
        if (!bar) return;

        bar.style.width = '100%';
        const startTime = Date.now();
        const duration = Emote.COOLDOWN_MS;

        if (emoteCooldownTimer) clearInterval(emoteCooldownTimer);
        emoteCooldownTimer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const pct = Math.max(0, 1 - elapsed / duration) * 100;
            bar.style.width = pct + '%';
            if (pct <= 0) {
                clearInterval(emoteCooldownTimer);
                emoteCooldownTimer = null;
            }
        }, 50);
    }

    function triggerAIEmote(context) {
        // Delay AI emote by 1-4 seconds to feel natural
        const delay = 1000 + Math.random() * 3000;
        setTimeout(() => {
            const emote = Emote.aiSend(context);
            if (emote) {
                showEmoteBubble(emote, 'ai');
            }
        }, delay);
    }

    function updateMuteButton() {
        const btn = $('#btn-emote-mute');
        if (!btn) return;
        if (Emote.isMuted()) {
            btn.textContent = '🔕';
            btn.classList.add('muted');
            btn.title = 'Unmute opponent emotes';
        } else {
            btn.textContent = '🔔';
            btn.classList.remove('muted');
            btn.title = 'Mute opponent emotes';
        }
    }

    // ═══════════════════════════════════════════════════════
    // ── SHOP ───────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════

    function renderShop() {
        $('#shop-coins').textContent = Player.getCoins();
        const grid = $('#theme-grid');
        grid.innerHTML = '';
        const themes = Player.getThemes().filter(t => !t.isBP);
        const activeTheme = Player.getActiveTheme();

        themes.forEach(theme => {
            const owned = Player.isThemeUnlocked(theme.id);
            const equipped = theme.id === activeTheme;

            const card = document.createElement('div');
            card.classList.add('theme-card');
            if (equipped) card.classList.add('equipped');

            card.innerHTML = `
        <div class="theme-preview" style="background: ${theme.preview[0]}">
          ${theme.preview.map(c => `<div class="preview-swatch" style="background: ${c}"></div>`).join('')}
        </div>
        <div class="theme-info">
          <div class="theme-name">${theme.name}</div>
          <div class="theme-desc">${theme.description}</div>
          <button class="theme-action-btn ${equipped ? 'equipped' : owned ? 'equip' : Player.getCoins() >= theme.price ? 'buy' : 'locked'}">
            ${equipped ? '✓ Equipped' : owned ? 'Equip' : Player.getCoins() >= theme.price ? `🪙 ${theme.price} — Buy` : `🔒 ${theme.price} Coins`}
          </button>
        </div>
      `;

            const btn = card.querySelector('.theme-action-btn');
            if (!equipped && owned) {
                btn.addEventListener('click', (e) => { e.stopPropagation(); Player.equipTheme(theme.id); applyTheme(theme.id); renderShop(); });
            } else if (!owned && Player.getCoins() >= theme.price) {
                btn.addEventListener('click', (e) => { e.stopPropagation(); const r = Player.buyTheme(theme.id); if (r.success) { Player.equipTheme(theme.id); applyTheme(theme.id); } renderShop(); });
            }

            grid.appendChild(card);
        });

        // ── Emotes & Texts section ──
        let emoteSection = $('#shop-emote-section');
        if (emoteSection) emoteSection.remove();

        emoteSection = document.createElement('div');
        emoteSection.id = 'shop-emote-section';
        emoteSection.style.cssText = 'margin-top: 20px;';
        emoteSection.innerHTML = `<h3 style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">Emotes & Quick Chat</h3>`;
        const emoteGrid = document.createElement('div');
        emoteGrid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;';

        Emote.getAllEmotes().filter(e => e.price > 0 && !e.isBP).forEach(emote => {
            const owned = Emote.isEmoteUnlocked(emote.id);
            const canBuy = !owned && Player.getCoins() >= emote.price;

            const card = document.createElement('div');
            card.style.cssText = `
                display: flex; flex-direction: column; align-items: center; gap: 4px;
                padding: 8px 4px; border-radius: 8px;
                background: ${owned ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)'};
                border: 1px solid ${owned ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255,255,255,0.08)'};
                cursor: ${canBuy ? 'pointer' : 'default'};
                transition: all 0.15s;
                position: relative;
                z-index: 10;
            `;
            card.innerHTML = `
                <span style="font-size: ${emote.type === 'text' ? '0.65rem' : '1.4rem'};${emote.type === 'text' ? 'font-weight:700;color:var(--accent-light);' : ''}">${emote.display}</span>
                <span style="font-size: 0.6rem; color: ${owned ? 'var(--success)' : canBuy ? '#fff' : 'var(--text-muted)'}; font-weight: 600;">
                    ${owned ? '✓ Owned' : `🪙 ${emote.price}`}
                </span>
            `;

            if (canBuy) {
                card.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const r = Emote.buyEmote(emote.id);
                    if (r.success) {
                        Sound.numberCorrect();
                        renderShop(); // now safely re-renders without duplicating
                    }
                });
                card.addEventListener('mouseenter', () => { card.style.transform = 'scale(1.05)'; });
                card.addEventListener('mouseleave', () => { card.style.transform = 'scale(1)'; });
            }

            emoteGrid.appendChild(card);
        });

        emoteSection.appendChild(emoteGrid);
        grid.parentElement.appendChild(emoteSection);
    }

    // ═══════════════════════════════════════════════════════
    // ── BATTLE PASS ───────────────────────────────────────
    // ═══════════════════════════════════════════════════════

    function renderBattlePass() {
        const bp = Player.getBPData();
        const tiers = Player.getBPTiers();

        // Progress header
        $('#bp-season').textContent = bp.season;
        $('#bp-tier').textContent = bp.tier;

        const nextTier = bp.tier < 100 ? tiers[bp.tier] : null;
        const xpNeeded = nextTier ? nextTier.xpNeeded : 0;
        const pct = xpNeeded > 0 ? Math.min(100, (bp.xp / xpNeeded) * 100) : 100;
        $('#bp-xp-fill').style.width = pct + '%';
        $('#bp-xp-text').textContent = bp.tier >= 100
            ? 'MAX TIER REACHED!'
            : `${bp.xp} / ${xpNeeded} XP`;

        // Daily Missions
        const dailyList = $('#bp-daily-missions');
        dailyList.innerHTML = '';
        const quests = Player.getQuests();
        quests.forEach(q => {
            const item = document.createElement('div');
            item.classList.add('bp-mission-item');
            if (q.completed) item.classList.add('completed');
            item.innerHTML = `
                <span class="bp-mission-text">${q.completed ? '✅' : '⬜'} ${q.text}</span>
                <span class="bp-mission-xp">+${q.xpReward + 50} BP</span>
            `;
            dailyList.appendChild(item);
        });

        // Weekly Missions
        const weeklyList = $('#bp-weekly-missions');
        weeklyList.innerHTML = '';
        const weekly = Player.getWeeklyMissions();
        weekly.forEach(m => {
            const item = document.createElement('div');
            item.classList.add('bp-mission-item');
            if (m.completed) item.classList.add('completed');
            item.innerHTML = `
                <span class="bp-mission-text">${m.completed ? '✅' : '⬜'} ${m.text}</span>
                <span class="bp-mission-xp">+${m.bpXP} BP</span>
            `;
            weeklyList.appendChild(item);
        });

        // Tier Reward Grid
        const grid = $('#bp-tier-grid');
        grid.innerHTML = '';
        tiers.forEach(t => {
            const reached = bp.tier >= t.tier;
            const claimed = bp.claimed.includes(t.tier);
            const claimable = reached && !claimed;
            const isMilestone = t.tier % 10 === 0;

            const card = document.createElement('div');
            card.classList.add('bp-tier-card');
            if (isMilestone) card.classList.add('milestone');
            if (reached) card.classList.add('reached');
            if (claimed) card.classList.add('claimed');
            if (claimable) card.classList.add('claimable');

            let statusHTML;
            if (claimed) {
                statusHTML = '<span class="bp-tier-status claimed-text">Claimed</span>';
            } else if (claimable) {
                statusHTML = '<span class="bp-tier-status claim">CLAIM</span>';
            } else {
                statusHTML = `<span class="bp-tier-status locked">🔒</span>`;
            }

            card.innerHTML = `
                <span class="bp-tier-num">${t.tier}</span>
                <span class="bp-tier-reward">${t.reward.label}</span>
                ${statusHTML}
            `;

            if (claimable) {
                card.addEventListener('click', () => {
                    const result = Player.claimBPReward(t.tier);
                    if (result.success) {
                        Sound.numberCorrect();
                        showXPToast(`Claimed: ${t.reward.label}`);
                        renderBattlePass(); // Re-render
                    }
                });
            }

            grid.appendChild(card);
        });
    }

    // ═══════════════════════════════════════════════════════
    // ── PROFILE ────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════

    function renderProfile() {
        const stats = Player.getStats();
        const xpProgress = Player.getXPProgress();
        const league = Player.getLeague();
        const record = Player.getPvPRecord();

        // Level
        $('#profile-level-badge').textContent = stats.level;
        $('#profile-level').textContent = stats.level;
        $('#profile-xp-bar').style.width = xpProgress.percent + '%';
        $('#profile-xp-text').textContent = `${xpProgress.progress} / ${xpProgress.needed} XP`;

        // League
        $('#profile-league-icon').textContent = league.icon;
        $('#profile-league-name').textContent = league.name;
        $('#profile-elo').textContent = Player.getELO();
        $('#profile-pvp-wins').textContent = record.wins;
        $('#profile-pvp-losses').textContent = record.losses;
        $('#profile-pvp-draws').textContent = record.draws;

        // Streak
        $('#profile-streak-count').textContent = stats.streak;

        // Stats
        $('#stat-games-played').textContent = stats.totalGamesPlayed;
        $('#stat-games-won').textContent = stats.totalGamesWon;
        $('#stat-win-rate').textContent = stats.winRate + '%';
        $('#stat-coins').textContent = Player.getCoins();

        renderBestTimes(stats.bestTimes);
    }

    function renderBestTimes(bestTimes) {
        const grid = $('#best-times-grid');
        grid.innerHTML = '';
        ['easy', 'medium', 'hard', 'expert', 'evil'].forEach(diff => {
            const item = document.createElement('div');
            item.classList.add('best-time-item');
            item.innerHTML = `<span class="best-time-diff">${capitalize(diff)}</span><span class="best-time-value">${Player.formatTime(bestTimes[diff])}</span>`;
            grid.appendChild(item);
        });
    }

    function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

    return { init, updateTimer, renderBoard };

})();

document.addEventListener('DOMContentLoaded', UI.init);
