/**
 * checkout.js — הצעות סגירה (checkout) עבור double-out.
 *
 * חיפוש מוגבל-עומק שרץ פעם אחת בטעינה לתוך שלוש טבלאות (1/2/3 חצים).
 * נכון בהגדרה: כל מסלול שנפלט מסתכם ליעד ומסתיים בדאבל. הטבלאות ל-1 ול-2
 * חצים יוצאות מאותו חיפוש בחינם — מה שטבלה מוקלדת ביד לא הייתה נותנת.
 */
var Checkouts = (function () {
    'use strict';

    var MAX = 170;

    /*
     * מועמדים לחצים שאינם האחרון, בסדר העדפה. הבול והטבעת החיצונית שלו מודחים
     * לסוף בכוונה: הם ניקוד לגיטימי אבל כמעט אף שחקן לא מכין איתם סגירה.
     */
    var THROW_ORDER = (function () {
        var list = [];
        var n;
        for (n = 20; n >= 1; n--) { list.push({ points: n * 3, label: 'T' + n }); }
        for (n = 20; n >= 1; n--) { list.push({ points: n, label: 'S' + n }); }
        list.push({ points: 50, label: 'BULL' });
        list.push({ points: 25, label: '25' });
        for (n = 20; n >= 1; n--) { list.push({ points: n * 2, label: 'D' + n }); }
        return list;
    })();

    /* סדר עץ החציה הסטנדרטי — הדאבל שנוח להתחלק אליו קודם */
    var DOUBLE_ORDER = [20, 16, 18, 12, 10, 8, 14, 6, 4, 2, 25, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1];

    /* points → {label, rank} עבור כל סיום חוקי */
    var FINISH = (function () {
        var map = {};
        for (var i = 0; i < DOUBLE_ORDER.length; i++) {
            var n = DOUBLE_ORDER[i];
            map[n * 2] = { label: n === 25 ? 'BULL' : 'D' + n, rank: i };
        }
        return map;
    })();

    /*
     * משקל הדאבל גדול פי 10 ממשקל חצי ההכנה: מה שבאמת קובע אם סגירה "נכונה"
     * הוא איזה דאבל היא משאירה. בלי זה החיפוש מחזיר מסלולים תקפים אך מוזרים
     * (60 → T18 D3 במקום S20 D20).
     */
    var DOUBLE_WEIGHT = 10;

    function searchRoute(target, maxDarts) {
        if (target < 2 || target > MAX) { return null; }

        /* חץ אחד */
        var one = FINISH[target];
        if (one) { return [one.label]; }
        if (maxDarts < 2) { return null; }

        var i, j, a, b, fin, score;
        var best = null;
        var bestScore = Infinity;

        /* שני חצים — קצר תמיד עדיף על ארוך, ולכן נבדק לפני שלושה */
        for (i = 0; i < THROW_ORDER.length; i++) {
            a = THROW_ORDER[i];
            fin = FINISH[target - a.points];
            if (!fin) { continue; }
            score = fin.rank * DOUBLE_WEIGHT + i;
            if (score < bestScore) { bestScore = score; best = [a.label, fin.label]; }
        }
        if (best) { return best; }
        if (maxDarts < 3) { return null; }

        /* שלושה חצים */
        for (i = 0; i < THROW_ORDER.length; i++) {
            a = THROW_ORDER[i];
            if (target - a.points < 2) { continue; }
            for (j = 0; j < THROW_ORDER.length; j++) {
                b = THROW_ORDER[j];
                fin = FINISH[target - a.points - b.points];
                if (!fin) { continue; }
                score = fin.rank * DOUBLE_WEIGHT + i + j;
                if (score < bestScore) { bestScore = score; best = [a.label, b.label, fin.label]; }
            }
        }
        return best;
    }

    /* TABLE[dartsLeft][target] — מחושב פעם אחת בטעינה */
    var TABLE = [null, {}, {}, {}];
    (function precompute() {
        for (var darts = 1; darts <= 3; darts++) {
            for (var t = 2; t <= MAX; t++) {
                TABLE[darts][t] = searchRoute(t, darts);
            }
        }
    })();

    /**
     * @param {number} remaining הניקוד שנותר לשחקן
     * @param {number} dartsLeft כמה חצים נותרו בתור (1..3)
     * @returns {string[]|null} מסלול סגירה, או null אם אין
     */
    function suggest(remaining, dartsLeft) {
        if (dartsLeft < 1 || dartsLeft > 3) { return null; }
        if (remaining < 2 || remaining > MAX) { return null; }
        return TABLE[dartsLeft][remaining] || null;
    }

    function format(route) {
        return route ? route.join(' ') : '';
    }

    return {
        MAX: MAX,
        suggest: suggest,
        format: format,
        searchRoute: searchRoute
    };
})();
