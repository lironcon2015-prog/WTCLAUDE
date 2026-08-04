/**
 * app.js — הבקר: מחזיק את המצב וההיסטוריה, מחבר את הלוח למנוע, ומרנדר.
 * הקובץ היחיד שנוגע ב-DOM מלבד board.js.
 */
var App = (function () {
    'use strict';

    var core = null;
    var history = [];
    var els = {};
    var keypadMult = 1;
    var bustTimer = null;
    var pendingResume = null;

    var setup = { count: 2, names: ['', '', '', ''], score: 501, bestOf: 5 };

    /* ---------- PWA ---------- */

    var deferredInstallPrompt = null;

    /*
     * אמת רק כשהקובץ נטען כ-<script src>. בגרסת הקובץ היחיד הסקריפט מוטבע,
     * currentScript.src ריק, ואין sw.js לצידנו — ואז אסור אפילו לנסות לרשום:
     * כשל 404 ברישום מדפיס לקונסולה שגיאה ש-catch לא תופס.
     */
    var IS_EXTERNAL_SCRIPT = !!(document.currentScript && document.currentScript.src);

    function canRegisterSW() {
        /*
         * ב-file:// כרום מדווח isSecureContext === true וגם
         * 'serviceWorker' in navigator === true, אבל register() נדחה עם TypeError.
         * הבדיקה היחידה שמחזיקה בפועל היא הפרוטוקול.
         */
        return IS_EXTERNAL_SCRIPT &&
               (location.protocol === 'https:' || location.protocol === 'http:') &&
               !!navigator.serviceWorker;
    }

    function registerServiceWorker() {
        if (!canRegisterSW()) { return; }
        try {
            /* יחסי בכוונה: ב-/WTCLAUDE/ זה /WTCLAUDE/sw.js, וה-scope נגזר ממנו לבד.
               '/sw.js' היה מפנה לשורש הדומיין ומחזיר 404. */
            navigator.serviceWorker.register('sw.js').catch(function () {
                /* אופליין הוא תוספת, לא תנאי לשימוש */
            });
        } catch (e) { /* דפדפן ישן מאוד */ }
    }

    /* ---------- עזרי DOM ---------- */

    function $(id) { return document.getElementById(id); }

    function ltr(text) {
        return '<span class="ltr">' + text + '</span>';
    }

    function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    function setChip(container, attr, value) {
        var chips = container.querySelectorAll('.chip');
        for (var i = 0; i < chips.length; i++) {
            var on = String(chips[i].dataset[attr]) === String(value);
            chips[i].classList.toggle('is-on', on);
        }
    }

    /* ---------- מסך ההגדרה ---------- */

    function defaultName(i) { return 'שחקן ' + (i + 1); }

    function buildNameInputs() {
        var html = '';
        for (var i = 0; i < 4; i++) {
            html += '<input type="text" class="input name-input" data-idx="' + i +
                    '" maxlength="14" placeholder="' + defaultName(i) +
                    '" aria-label="' + defaultName(i) + '"' +
                    (i < setup.count ? '' : ' hidden') + '>';
        }
        els.nameInputs.innerHTML = html;
        var inputs = els.nameInputs.querySelectorAll('.name-input');
        for (var j = 0; j < inputs.length; j++) {
            inputs[j].value = setup.names[j] || '';
            inputs[j].addEventListener('input', function () {
                setup.names[parseInt(this.dataset.idx, 10)] = this.value;
            });
        }
    }

    function syncNameVisibility() {
        var inputs = els.nameInputs.querySelectorAll('.name-input');
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].hidden = i >= setup.count;
        }
    }

    function renderLegsHint() {
        var bestOf = parseInt(els.inputBestOf.value, 10);
        if (!bestOf || bestOf < 1) {
            els.legsHint.textContent = '';
            return;
        }
        /* במשחק של סבב יחיד אין "הטוב מ" — יש רק סבב אחד */
        els.legsHint.textContent = bestOf === 1
            ? 'סבב אחד מכריע'
            : 'הראשון ל-' + (Math.floor(bestOf / 2) + 1) + ' סבבים מנצח';
    }

    function readSetup() {
        var score = parseInt(els.inputScore.value, 10);
        var bestOf = parseInt(els.inputBestOf.value, 10);
        if (!isFinite(score) || score < 2 || score > 1001) {
            return { error: 'ניקוד הפתיחה חייב להיות מספר שלם בין 2 ל-1001.' };
        }
        if (!isFinite(bestOf) || bestOf < 1 || bestOf > 21) {
            return { error: 'אורך המשחק חייב להיות מספר שלם בין 1 ל-21.' };
        }
        var names = [];
        for (var i = 0; i < setup.count; i++) {
            var n = (setup.names[i] || '').trim();
            names.push(n || defaultName(i));
        }
        return { startScore: score, bestOf: bestOf, names: names };
    }

    function showSetupError(msg) {
        els.setupError.textContent = msg || '';
        els.setupError.hidden = !msg;
    }

    /* ---------- מעברי מצב ---------- */

    function pushHistory(state) {
        history.push(state);
        if (history.length > DartsStore.MAX_HISTORY) { history.shift(); }
    }

    function persist() {
        if (core) { DartsStore.save(core, history); }
    }

    function startGame() {
        var cfg = readSetup();
        if (cfg.error) { showSetupError(cfg.error); return; }
        showSetupError('');

        DartsStore.savePrefs({
            count: setup.count,
            names: setup.names,
            score: cfg.startScore,
            bestOf: cfg.bestOf
        });

        core = DartsEngine.createGame(cfg);
        history = [];
        hideBust();
        persist();
        showScreen('game');
        render();
    }

    function throwDart(dart) {
        if (!core || core.legOver || core.matchOver) { return; }
        var next = DartsEngine.applyDart(core, dart);
        if (next === core) { return; }
        pushHistory(core);
        core = next;
        if (core.lastTurn && core.lastTurn.bust) { flashBust(); } else { hideBust(); }
        persist();
        render();
    }

    function undo() {
        if (!history.length) { return; }
        core = history.pop();
        hideBust();
        persist();
        render();
    }

    function nextLeg() {
        if (!core || !core.legOver || core.matchOver) { return; }
        pushHistory(core);
        core = DartsEngine.startNewLeg(core);
        hideBust();
        persist();
        render();
    }

    function newMatch() {
        DartsStore.clear();
        core = null;
        history = [];
        hideBust();
        els.overlayLeg.hidden = true;
        els.overlayMatch.hidden = true;
        showScreen('setup');
        els.resumeBanner.hidden = true;
    }

    /* ---------- באנר השריפה ---------- */

    function flashBust() {
        var lt = core.lastTurn;
        var labels = lt.darts.map(DartsEngine.dartLabel).join(' ');
        els.bustBanner.innerHTML = '<strong>נשרף!</strong> ' + ltr(esc(labels)) +
                                   ' — חוזר ל-' + ltr(lt.revertedTo);
        els.bustBanner.hidden = false;
        if (bustTimer) { clearTimeout(bustTimer); }
        bustTimer = setTimeout(function () {
            els.bustBanner.hidden = true;
            bustTimer = null;
        }, 2200);
    }

    function hideBust() {
        if (bustTimer) { clearTimeout(bustTimer); bustTimer = null; }
        els.bustBanner.hidden = true;
    }

    /* ---------- רינדור ---------- */

    function showScreen(which) {
        els.screenSetup.classList.toggle('is-active', which === 'setup');
        els.screenGame.classList.toggle('is-active', which === 'game');
    }

    function renderPlayers() {
        var html = '';
        var dartsLeft = 3 - core.dartsThisTurn.length;

        for (var i = 0; i < core.players.length; i++) {
            var p = core.players[i];
            var active = i === core.currentPlayerIndex && !core.legOver && !core.matchOver;
            var scored = core.config.startScore - p.remaining;

            var checkout = '';
            if (active) {
                var route = Checkouts.suggest(p.remaining, dartsLeft);
                checkout = route
                    ? '<div class="pcheckout">סגירה: ' + ltr(Checkouts.format(route)) + '</div>'
                    : '<div class="pcheckout is-empty">&nbsp;</div>';
            } else {
                checkout = '<div class="pcheckout is-empty">&nbsp;</div>';
            }

            html += '<div class="pcard' + (active ? ' is-active' : '') +
                    (core.legWinnerIndex === i ? ' is-winner' : '') + '">' +
                    '<div class="pname">' + esc(p.name) + '</div>' +
                    '<div class="premain">' + ltr(p.remaining) + '</div>' +
                    '<div class="pmeta">צבר ' + ltr(scored) + ' · סבבים ' + ltr(p.legsWon) + '</div>' +
                    '<div class="plast">תור אחרון: ' +
                        ltr(p.lastTurnPoints === null ? '—' : p.lastTurnPoints) + '</div>' +
                    checkout +
                    '</div>';
        }
        els.players.innerHTML = html;
        els.players.className = 'players count-' + core.players.length;
    }

    function renderTurn() {
        var html = '';
        for (var i = 0; i < 3; i++) {
            var d = core.dartsThisTurn[i];
            if (d) {
                html += '<div class="dart' + (d.bust ? ' is-bust' : '') + '">' +
                        '<span class="dart-label ltr">' + DartsEngine.dartLabel(d) + '</span>' +
                        '<span class="dart-pts ltr">' + d.points + '</span></div>';
            } else {
                /* גם המשבצת הריקה חייבת שתי שורות, אחרת הגובה קופץ כשנכנס חץ
                   ודוחף את הלוח למטה */
                html += '<div class="dart is-empty"><span class="dart-label">—</span>' +
                        '<span class="dart-pts">&nbsp;</span></div>';
            }
        }
        els.turnDarts.innerHTML = html;
        els.turnTotal.textContent = DartsEngine.sumPoints(core.dartsThisTurn);
    }

    function renderOverlays() {
        var names = core.players.map(function (p) { return p.name; });

        if (core.matchOver) {
            var w = core.players[core.matchWinnerIndex];
            els.matchTitle.textContent = w.name + ' ניצח!';
            els.matchSub.innerHTML = 'תוצאת הסבבים: ' +
                ltr(core.players.map(function (p) { return p.legsWon; }).join(':'));
            els.overlayMatch.hidden = false;
            els.overlayLeg.hidden = true;
        } else if (core.legOver) {
            els.legTitle.textContent = core.players[core.legWinnerIndex].name + ' לקח את הסבב!';
            els.legSub.innerHTML = 'תוצאת הסבבים: ' +
                ltr(core.players.map(function (p) { return p.legsWon; }).join(':')) +
                ' · ' + esc(names.join(' / '));
            els.overlayLeg.hidden = false;
            els.overlayMatch.hidden = true;
        } else {
            els.overlayLeg.hidden = true;
            els.overlayMatch.hidden = true;
        }
    }

    function render() {
        if (!core) { return; }
        /* "הטוב מ-N" נופל כשיש רק סבב אחד, ואין צורך לתייג את 501 — הוא מובן מהקשר */
        els.legInfo.innerHTML = 'סבב ' + ltr(core.legIndex + 1) +
                                (core.config.bestOf > 1 ? ' · הטוב מ-' + ltr(core.config.bestOf) : '') +
                                ' · ' + ltr(core.config.startScore);
        els.btnUndo.disabled = history.length === 0;
        renderPlayers();
        renderTurn();
        renderOverlays();
    }

    /* ---------- מקלדת הגיבוי ---------- */

    function buildKeypad() {
        var html = '';
        for (var n = 1; n <= 20; n++) {
            html += '<button type="button" class="key" data-value="' + n + '">' + n + '</button>';
        }
        html += '<button type="button" class="key key-wide" data-value="25" data-fixed-mult="1">25</button>';
        html += '<button type="button" class="key key-wide" data-value="25" data-fixed-mult="2">בול</button>';
        html += '<button type="button" class="key key-wide key-miss" data-value="0" data-fixed-mult="0">החטאה</button>';
        els.keypadGrid.innerHTML = html;
    }

    /* ---------- אתחול ---------- */

    function wireSetup() {
        els.chipsCount.addEventListener('click', function (e) {
            var chip = e.target.closest('.chip');
            if (!chip) { return; }
            setup.count = parseInt(chip.dataset.count, 10);
            setChip(els.chipsCount, 'count', setup.count);
            syncNameVisibility();
        });

        els.chipsScore.addEventListener('click', function (e) {
            var chip = e.target.closest('.chip');
            if (!chip) { return; }
            els.inputScore.value = chip.dataset.score;
            setChip(els.chipsScore, 'score', chip.dataset.score);
        });

        els.chipsBestOf.addEventListener('click', function (e) {
            var chip = e.target.closest('.chip');
            if (!chip) { return; }
            els.inputBestOf.value = chip.dataset.bestof;
            setChip(els.chipsBestOf, 'bestof', chip.dataset.bestof);
            renderLegsHint();
        });

        els.inputScore.addEventListener('input', function () {
            setChip(els.chipsScore, 'score', els.inputScore.value);
        });

        els.inputBestOf.addEventListener('input', function () {
            setChip(els.chipsBestOf, 'bestof', els.inputBestOf.value);
            renderLegsHint();
        });

        els.btnStart.addEventListener('click', startGame);

        els.btnResume.addEventListener('click', function () {
            if (!pendingResume) { return; }
            core = pendingResume.core;
            history = pendingResume.history;
            pendingResume = null;
            els.resumeBanner.hidden = true;
            hideBust();
            showScreen('game');
            render();
        });

        els.btnDiscard.addEventListener('click', function () {
            pendingResume = null;
            DartsStore.clear();
            els.resumeBanner.hidden = true;
        });
    }

    function wireGame() {
        els.btnUndo.addEventListener('click', undo);
        els.btnNextLeg.addEventListener('click', nextLeg);
        els.btnNewMatch.addEventListener('click', newMatch);
        els.btnQuit.addEventListener('click', function () {
            if (window.confirm('לסיים את המשחק הנוכחי ולחזור להגדרות?')) { newMatch(); }
        });

        var undoButtons = document.querySelectorAll('.js-undo');
        for (var i = 0; i < undoButtons.length; i++) {
            undoButtons[i].addEventListener('click', undo);
        }

        els.btnKeypad.addEventListener('click', function () {
            var open = els.keypad.hidden;
            els.keypad.hidden = !open;
            els.btnKeypad.setAttribute('aria-expanded', String(open));
            /* מכווץ את הלוח כשהמקלדת פתוחה, כדי שכל המקשים יישארו בלי גלילה */
            els.screenGame.classList.toggle('keypad-open', open);
        });

        els.chipsMult.addEventListener('click', function (e) {
            var chip = e.target.closest('.chip');
            if (!chip) { return; }
            keypadMult = parseInt(chip.dataset.mult, 10);
            setChip(els.chipsMult, 'mult', keypadMult);
        });

        els.keypadGrid.addEventListener('click', function (e) {
            var key = e.target.closest('.key');
            if (!key) { return; }
            var value = parseInt(key.dataset.value, 10);
            var mult = key.dataset.fixedMult !== undefined
                ? parseInt(key.dataset.fixedMult, 10)
                : keypadMult;
            throwDart({ value: value, multiplier: mult });
        });
    }

    function applyPrefs() {
        var prefs = DartsStore.loadPrefs();
        if (!prefs) { return; }
        if (prefs.count >= 1 && prefs.count <= 4) { setup.count = prefs.count; }
        if (Array.isArray(prefs.names)) { setup.names = prefs.names.slice(0, 4); }
        if (prefs.score) { els.inputScore.value = prefs.score; }
        if (prefs.bestOf) { els.inputBestOf.value = prefs.bestOf; }
        setChip(els.chipsCount, 'count', setup.count);
        setChip(els.chipsScore, 'score', els.inputScore.value);
        setChip(els.chipsBestOf, 'bestof', els.inputBestOf.value);
    }

    function offerResume() {
        var saved = DartsStore.load();
        if (!saved || saved.core.matchOver) {
            if (saved) { DartsStore.clear(); }
            return;
        }
        pendingResume = saved;
        var c = saved.core;
        els.resumeText.innerHTML = 'נמצא משחק פתוח: ' + esc(c.config.names.join(' / ')) +
                                   ' · סבב ' + ltr(c.legIndex + 1) + ' · ' + ltr(c.config.startScore);
        els.resumeBanner.hidden = false;
    }

    function init() {
        els = {
            screenSetup: $('screen-setup'),
            screenGame: $('screen-game'),
            resumeBanner: $('resume-banner'),
            resumeText: $('resume-text'),
            btnResume: $('btn-resume'),
            btnDiscard: $('btn-discard'),
            chipsCount: $('chips-count'),
            chipsScore: $('chips-score'),
            chipsBestOf: $('chips-bestof'),
            chipsMult: $('chips-mult'),
            nameInputs: $('name-inputs'),
            inputScore: $('input-score'),
            inputBestOf: $('input-bestof'),
            legsHint: $('legs-hint'),
            setupError: $('setup-error'),
            btnStart: $('btn-start'),
            legInfo: $('leg-info'),
            btnUndo: $('btn-undo'),
            btnQuit: $('btn-quit'),
            players: $('players'),
            bustBanner: $('bust-banner'),
            turnDarts: $('turn-darts'),
            turnTotal: $('turn-total'),
            boardWrap: $('board-wrap'),
            btnKeypad: $('btn-keypad'),
            keypad: $('keypad'),
            keypadGrid: $('keypad-grid'),
            overlayLeg: $('overlay-leg'),
            legTitle: $('leg-title'),
            legSub: $('leg-sub'),
            btnNextLeg: $('btn-next-leg'),
            overlayMatch: $('overlay-match'),
            matchTitle: $('match-title'),
            matchSub: $('match-sub'),
            btnNewMatch: $('btn-new-match'),
            btnInstall: $('btn-install')
        };

        /* כשכבר רצים מותקן אין מה להציע — beforeinstallprompt גם לא ייורה */
        if (window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: standalone)').matches ||
            navigator.standalone === true) {
            els.btnInstall.remove();
            els.btnInstall = null;
        } else {
            els.btnInstall.addEventListener('click', function () {
                if (!deferredInstallPrompt) { return; }
                var prompt = deferredInstallPrompt;
                deferredInstallPrompt = null;   /* prompt() הוא חד-פעמי */
                els.btnInstall.hidden = true;
                prompt.prompt();
            });
            /* האירוע עשוי היה להיירות לפני ש-init רץ */
            if (deferredInstallPrompt) { els.btnInstall.hidden = false; }
        }

        applyPrefs();
        buildNameInputs();
        renderLegsHint();
        buildKeypad();
        wireSetup();
        wireGame();

        Dartboard.render(els.boardWrap);
        Dartboard.bind(throwDart);

        offerResume();
    }

    /*
     * מאזיני ההתקנה נרשמים כאן, ברמת ה-IIFE, ולא בתוך init(): init עשוי להידחות
     * ל-DOMContentLoaded, ו-beforeinstallprompt יכול להיירות לפני כן.
     */
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (els.btnInstall) { els.btnInstall.hidden = false; }
    });

    window.addEventListener('appinstalled', function () {
        deferredInstallPrompt = null;
        if (els.btnInstall) { els.btnInstall.hidden = true; }
    });

    /* עשוי לרוץ גם אחרי ש-DOMContentLoaded כבר נורה (למשל בגרסת קובץ יחיד) */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* רישום ה-service worker אחרי load, כדי שלא יתחרה עם הציור הראשון */
    if (document.readyState === 'complete') {
        registerServiceWorker();
    } else {
        window.addEventListener('load', registerServiceWorker);
    }

    return {
        throwDart: throwDart,
        undo: undo,
        nextLeg: nextLeg,
        getCore: function () { return core; },
        getHistory: function () { return history; }
    };
})();
