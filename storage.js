/**
 * storage.js — התמדה ב-localStorage למשחק הפעיל ולהעדפות ההגדרה.
 * כל גישה עטופה ב-try/catch: Safari במצב פרטי זורק בכתיבה.
 */
var DartsStore = (function () {
    'use strict';

    var KEY_GAME = 'darts_game_v1';
    var KEY_PREFS = 'darts_prefs_v1';
    var VERSION = 1;
    var MAX_HISTORY = 60;   /* 20 תורות אחורה — הרבה מעבר לכל צורך אמיתי */

    function save(core, history) {
        try {
            localStorage.setItem(KEY_GAME, JSON.stringify({
                version: VERSION,
                savedAt: Date.now(),
                core: core,
                history: history.slice(-MAX_HISTORY)
            }));
        } catch (e) { /* מכסה מלא או מצב פרטי — ההתמדה היא nice-to-have */ }
    }

    function load() {
        try {
            var raw = localStorage.getItem(KEY_GAME);
            if (!raw) { return null; }
            var data = JSON.parse(raw);
            if (!data || data.version !== VERSION) { return null; }
            var core = data.core;
            if (!core || !core.config || !Array.isArray(core.players) || !core.players.length) { return null; }
            if (typeof core.config.startScore !== 'number' || typeof core.currentPlayerIndex !== 'number') { return null; }
            if (!Array.isArray(core.dartsThisTurn)) { return null; }
            return {
                core: core,
                history: Array.isArray(data.history) ? data.history : []
            };
        } catch (e) {
            return null;
        }
    }

    function clear() {
        try { localStorage.removeItem(KEY_GAME); } catch (e) { /* אין מה לעשות */ }
    }

    function savePrefs(prefs) {
        try { localStorage.setItem(KEY_PREFS, JSON.stringify(prefs)); } catch (e) { /* אין מה לעשות */ }
    }

    function loadPrefs() {
        try {
            var raw = localStorage.getItem(KEY_PREFS);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    return {
        MAX_HISTORY: MAX_HISTORY,
        save: save,
        load: load,
        clear: clear,
        savePrefs: savePrefs,
        loadPrefs: loadPrefs
    };
})();
