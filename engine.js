/**
 * engine.js — מעברי המצב של משחק X01. פונקציות טהורות בלבד: אפס DOM, אפס storage.
 *
 * העיקרון המרכזי: חץ הוא יחידת האטומיות היחידה. applyDart היא נקודת המוטציה
 * היחידה, וסיבוב תור / שחזור bust / ניצחון ליג / ניצחון משחק כולם תוצאות
 * שמחושבות בתוכה. לכן "חץ אחד" שווה בדיוק ל"מעבר מצב אחד", ומחסנית snapshots
 * היא undo נאמן בלי שום ניהול נוסף.
 */
var DartsEngine = (function () {
    'use strict';

    function clone(o) {
        return JSON.parse(JSON.stringify(o));
    }

    function sumPoints(darts) {
        var total = 0;
        for (var i = 0; i < darts.length; i++) { total += darts[i].points; }
        return total;
    }

    /** תווית קצרה לחץ, תמיד קריאה משמאל לימין */
    function dartLabel(dart) {
        if (!dart || !dart.multiplier || !dart.value) { return 'MISS'; }
        if (dart.value === 25) { return dart.multiplier === 2 ? 'BULL' : '25'; }
        return ['', 'S', 'D', 'T'][dart.multiplier] + dart.value;
    }

    function createGame(config) {
        var names = config.names;
        var players = names.map(function (name) {
            return {
                name: name,
                remaining: config.startScore,
                turnStartRemaining: config.startScore,
                legsWon: 0,
                lastTurnPoints: null
            };
        });
        return {
            config: {
                startScore: config.startScore,
                bestOf: config.bestOf,
                legsToWin: Math.floor(config.bestOf / 2) + 1,
                names: names.slice()
            },
            players: players,
            legIndex: 0,
            legStarterIndex: 0,
            currentPlayerIndex: 0,
            dartsThisTurn: [],
            lastTurn: null,
            legOver: false,
            legWinnerIndex: null,
            matchOver: false,
            matchWinnerIndex: null
        };
    }

    /** שלושת מקרי ה-bust. after = remaining - points, כבר מחושב. */
    function isBust(after, isDouble) {
        return after < 0                      /* חריגה מעבר לאפס */
            || after === 1                    /* לא ניתן לסיים על 1 — אין D0.5 */
            || (after === 0 && !isDouble);    /* הגיע לאפס בלי דאבל */
    }

    function captureTurn(core, wasBust) {
        core.lastTurn = {
            playerIndex: core.currentPlayerIndex,
            darts: clone(core.dartsThisTurn),
            points: wasBust ? 0 : sumPoints(core.dartsThisTurn),
            bust: !!wasBust,
            revertedTo: wasBust ? core.players[core.currentPlayerIndex].turnStartRemaining : null
        };
    }

    /**
     * מסיים את התור ומעביר לשחקן הבא.
     * turnStartRemaining מעוגן מחדש רק כאן וב-startNewLeg — האינווריאנט היחיד
     * שהופך את שחזור ה-bust לנכון.
     */
    function endTurn(core, wasBust) {
        captureTurn(core, wasBust);
        core.players[core.currentPlayerIndex].lastTurnPoints =
            wasBust ? 0 : sumPoints(core.dartsThisTurn);
        /* בשחקן יחיד (0+1)%1===0 — אותו שחקן נבחר מחדש, בלי שום ענף מיוחד */
        core.currentPlayerIndex = (core.currentPlayerIndex + 1) % core.players.length;
        core.dartsThisTurn = [];
        var next = core.players[core.currentPlayerIndex];
        next.turnStartRemaining = next.remaining;
    }

    function applyDart(core, dart) {
        if (core.legOver || core.matchOver) { return core; }
        if (core.dartsThisTurn.length >= 3) { return core; }

        var next = clone(core);
        var p = next.players[next.currentPlayerIndex];
        var points = dart.value * dart.multiplier;   /* החטאה = 0 × 0 = 0 */
        var isDouble = dart.multiplier === 2;        /* true גם לבול, שממודל כ-25×2 */
        var rec = { value: dart.value, multiplier: dart.multiplier, points: points };
        next.dartsThisTurn.push(rec);

        var after = p.remaining - points;

        if (isBust(after, isDouble)) {
            rec.bust = true;
            p.remaining = p.turnStartRemaining;
            endTurn(next, true);
        } else if (after === 0) {
            /* isDouble מובטח כאן, אחרת isBust היה תופס */
            p.remaining = 0;
            p.legsWon += 1;
            p.lastTurnPoints = sumPoints(next.dartsThisTurn);
            next.legOver = true;
            next.legWinnerIndex = next.currentPlayerIndex;
            if (p.legsWon >= next.config.legsToWin) {
                next.matchOver = true;
                next.matchWinnerIndex = next.currentPlayerIndex;
            }
            captureTurn(next, false);   /* מתעד, אך אינו מסובב */
        } else {
            p.remaining = after;
            if (next.dartsThisTurn.length === 3) { endTurn(next, false); }
        }
        return next;
    }

    function startNewLeg(core) {
        var next = clone(core);
        next.legIndex += 1;
        /* סיבוב הפותח הוא פונקציה טהורה של מספר הליג ולכן לא יכול לצאת מסנכרון */
        next.legStarterIndex = next.legIndex % next.players.length;
        next.currentPlayerIndex = next.legStarterIndex;
        next.players.forEach(function (p) {
            p.remaining = next.config.startScore;
            p.turnStartRemaining = next.config.startScore;
            p.lastTurnPoints = null;
        });
        next.dartsThisTurn = [];
        next.lastTurn = null;
        next.legOver = false;
        next.legWinnerIndex = null;
        return next;
    }

    return {
        clone: clone,
        sumPoints: sumPoints,
        dartLabel: dartLabel,
        createGame: createGame,
        isBust: isBust,
        applyDart: applyDart,
        startNewLeg: startNewLeg
    };
})();
