# Sudoku App Modifications (2026-02-22)

This document outlines the updates to the Sudoku application up to February 22rd, 2026. It is designed to be fully comprehensible for non-technical stakeholders (Product Managers, Designers, Users) while also providing the foundational details necessary for Developers.

---

## 1. Upgraded AI Opponents (PvP)
### Stakeholder View
Our AI opponents were acting too robotic and occasionally freezing at the start of matches. We've completely overhauled their behavior to feel significantly more human and competitive:
- **Agility:** Bots now solve puzzles much faster across all difficulties.
- **Human "Bursts":** Just like real players get on a hot streak, the AI now occasionally enters "Burst Mode," solving numbers up to twice as fast as their normal speed to suddenly apply intense pressure.
- **Instant Hints:** Instead of waiting to "think," if a Bot uses a hint, it immediately slaps the number onto the board, just as a human player would tap the hint button.

### Developer View
- **Fix:** Corrected a lexical scoping bug inside `js/pvp.js -> scheduleNextAICell()` where an undefined `speed` variable hung the `setTimeout` loop. Re-wired it to global `battle.aiSpeed`.
- **Logic Tuning:** Reduced absolute floor delays inside the `AI_SPEED` dictionary and increased the multiplier for burst conditions.
- **Hint Engine:** Built a bypass flow in `scheduleNextAICell`—if `battle.aiHints > 0`, it overrides standard difficulty delays with a hardcoded `100` - `300ms` instantaneous execution.

---

## 2. Advanced PvP Win Conditions
### Stakeholder View
Previously, if a multiplayer match ran out of time, the game would arbitrarily pick a winner, sometimes resulting in frustrating draws. We've rebuilt the endgame so that the winner is always explicitly clear and fair. You will now see exactly *why* you won or lost.

If time runs out, the game decides the winner in this exact order:
1. Whoever completed the highest percentage of the board wins.
2. If the completion is exactly tied, whoever made fewer mistakes wins.
3. If mistakes are tied, whoever used fewer hints wins.
4. Only if all three are identical does the match end in a true Draw.

**New Results Table:** We scrapped the boring text screen and replaced it with a sleek, 3-column Data Table comparing your stats against your opponent side-by-side, proudly displaying the specific reason you won at the top (e.g., "Fewer Hints Used").

### Developer View
- **Engine Refactoring:** Replaced the legacy win logic in `js/pvp.js -> endBattle()` with a strict 4-tier boolean cascade.
- **New Metrics Tracked:** Initialized new listeners to track `battle.playerHintsUsed`, `battle.aiHintsUsed`, and total mistakes (which previously only cost the player time, but are now tracked as a permanent penalty metric).
- **UI:** Designed a new responsive CSS Grid payload inside `#overlay-battle-result` in `index.html`. It dynamically reads the final `battle` payload (e.g. injects exactly `85%` vs `100%`) and calculates `battle.endReasonText`.

---

## 3. Targeted Hints & Smart Numpad Banning
### Stakeholder View
- **Targeted Hints:** In PvP, clicking the "Hint" bulb used to solve a randomly selected tile across the board. Now, clicking it will solve the specific square you are currently staring at.
- **Numpad Mistake Memory:** If you guess a wrong number (like putting a `5` where it doesn't belong), the board flashes red, but it's easy to forget and do it again. Now, the game remembers this! If you click that same square later, the number `5` will be permanently greyed out and disabled on your Number Pad to prevent you from repeating identical mistakes.

### Developer View
- **Targeted Hints:** Re-wired `playerUseHint(row, col)` to accept coordinates mathematically linked to the active UI `st.selectedCell` pointer.
- **State Architecture (Banning):** Created a new `wrongNumbers` data property (a 9x9 grid of Javascript `Set` objects) on the global Game state and local `battle` PvP state. Re-wrote Local Storage serializations to convert these ES6 Sets into parseable JSON Arrays.
- **UI Implementation:** In `js/ui.js -> updateNumberPad()`, we actively check the Set. If an integer exists in the Set for the current cell, we inject a `.disabled` CSS class onto that specific DOM button.

---

## 4. "Ghost Matches" & Forfeiting (Async Battles)
### Stakeholder View
Forfeiting a match used to abruptly rip the game away from both players and ruin the continuity. We've completely redesigned this into a modern asynchronous flow:

If you rage-quit a match in the middle of a battle:
- You are immediately freed to return to the Main Menu. You can browse the Shop, change settings, or start a new puzzle!
- Instead of showing you a Victory/Defeat screen right then, your stats are locked in and replaced by Hourglasses (⏳). 
- **The match continues playing out in the background for your opponent!** They are allowed to fight against your ghostly frozen percentage until they organically finish or run out of time. 

### Developer View
- **State Flow Bypass:** The `quitBattle` and `playerFinish` triggers *no longer* command `endBattle()`. They toggle `battle.playerQuit = true` and silently back away.
- **Interval Continuation:** The `battle.timerIntervalId` persists in the background. It cleanly assesses the Victory/Defeat states only when `timeRemaining <= 0` or both actors are simultaneously toggled out.
- **DOM Freedom:** Designed `#btn-battle-leave-early`, unbinding the player from the modal trap and cleanly firing `hideOverlay()` while leaving the game engine spinning safely out-of-bounds.

---

## 5. Interactive Match History 
### Stakeholder View
We wanted a place for players to check back in on matches they walked away from:
- **Ongoing History:** If you forfeit a match, it drops straight into your Match History list marked as "Ongoing."
- **Live Timers:** You can watch the opponent's timer physically tick down (e.g., `vs AI Bot 09:42`) from within your History menu to estimate when the game will end.
- **Clickable Cards:** You can click on *any* card in your Match History to pop open the full Results Table. Clicking an Ongoing match opens the live Hourglass screen!
- **Silent Resolution:** When the opponent finally finishes the ghost match in the background, we don't bombard you with an annoying popup window while you are shopping. The game silently finalizes its place in your match history list so it's ready for you next time you look.

### Developer View
- **UI Synthesizing:** Rewrote `renderMatchHistory()` to clone the local storage history payload. If the active `PvP.getBattle()` singleton confirms an ongoing background match, the UI artificially `unshift()`s a "fake" memory card DOM element to the top of the list so it mirrors standard history cards perfectly.
- **Event Listeners:** Upgraded `#match-history-list` from string templating to `document.createElement()`, allowing proper `click` listener bindings for every individual card to trigger overlays natively.
- **DOM Injection & Guard Clauses:** Updated the core tick interval to physically write strings (e.g. `${timeStr}`) directly into the active specific Forfeit Match DOM element headers. Built intelligent guard clauses like `!(PvP.getBattle() && PvP.getBattle().playerQuit)` to aggressively suppress old alert Toasts if the user is in menu space.

---

## 6. Friend Challenge Fixes
### Stakeholder View
- **Clearer Branding:** Multiplayer challenge links now explicitly say `Friend: 14:22` or `Rival: 10:45` in the header bar instead of vague labels.
- **Time Difference:** When you beat a friend's link, the Victory Screen now clearly tells you exactly how much faster you were (e.g., `-00:15 (Faster!)`) or slower you were (`+00:20 (Slower)`).

### Developer View
- **URL Parameter Repair:** Fixed `onChallengeClick` attempting to read an `undefined` variable to generate links. Correctly pointed it to the actively generated `st.seed`.
- **Race Condition Fix:** Repaired the loading logic pipeline. The browser was painting the initial UI cycle physically faster than the engine could read the URL parameters to populate `st.challengeTime`. Swapped initialization orders and forced a repainting call `updateInfoBar()` to ensure the Challenge Timer label visually exists the millisecond the screen renders.

