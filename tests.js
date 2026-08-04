/**
 * tests.js — בדיקות עצמיות. רצות רק כשמוסיפים ?test=1 ל-URL, או כשטוענים
 * את המודולים ב-node. מכסות את כל מטריצת החוקים בטעינת דף אחת.
 */
(function () {
    'use strict';

    var isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (isBrowser && window.location.search.indexOf('test') < 0) { return; }

    var passed = 0;
    var failures = [];

    function ok(cond, label) {
        if (cond) { passed++; } else { failures.push(label); }
    }

    function eq(actual, expected, label) {
        ok(actual === expected, label + ' — התקבל ' + JSON.stringify(actual) +
                                ', צפוי ' + JSON.stringify(expected));
    }

    function deepEq(a, b, label) {
        ok(JSON.stringify(a) === JSON.stringify(b), label);
    }

    /* ---------- טבעת המספרים ---------- */

    var ORDER = Dartboard.ORDER;
    eq(ORDER.length, 20, 'ORDER באורך 20');
    eq(ORDER[0], 20, 'ORDER[0] הוא 20 (למעלה)');
    eq(ORDER[10], 3, 'ORDER[10] הוא 3 (למטה)');
    eq(ORDER[15], 11, 'ORDER[15] הוא 11 (שעה 9)');
    eq(ORDER[5], 6, 'ORDER[5] הוא 6 (שעה 3)');
    var seen = ORDER.slice().sort(function (a, b) { return a - b; });
    var all20 = true;
    for (var n = 1; n <= 20; n++) { if (seen[n - 1] !== n) { all20 = false; } }
    ok(all20, 'ORDER מכיל את 1..20 בדיוק פעם אחת כל אחד');

    /* ---------- scoreAt מסכים עם הגאומטריה המצוירת ---------- */

    var R = Dartboard.R;
    var bands = [
        { r: (R.OUTER_BULL + R.TRIPLE_IN) / 2, mult: 1, name: 'סינגל פנימי' },
        { r: (R.TRIPLE_IN + R.TRIPLE_OUT) / 2, mult: 3, name: 'טריפל' },
        { r: (R.TRIPLE_OUT + R.DOUBLE_IN) / 2, mult: 1, name: 'סינגל חיצוני' },
        { r: (R.DOUBLE_IN + R.DOUBLE_OUT) / 2, mult: 2, name: 'דאבל' }
    ];
    var roundTripOk = true;
    for (var i = 0; i < 20; i++) {
        for (var b = 0; b < bands.length; b++) {
            var p = Dartboard.polar(bands[b].r, i * 18);
            var hit = Dartboard.scoreAt(p[0], p[1]);
            if (hit.value !== ORDER[i] || hit.multiplier !== bands[b].mult) {
                roundTripOk = false;
                failures.push('scoreAt סקטור ' + i + ' רצועת ' + bands[b].name +
                              ' → ' + JSON.stringify(hit));
            }
        }
    }
    ok(roundTripOk, 'scoreAt round-trip על כל 80 המקטעים');
    if (roundTripOk) { passed += 79; }

    /* גבולות סקטור: 8.9° עדיין 20, ‏9.1° כבר 1 */
    eq(Dartboard.scoreAt.apply(null, Dartboard.polar(60, 8.9)).value, 20, 'גבול 8.9° הוא עדיין 20');
    eq(Dartboard.scoreAt.apply(null, Dartboard.polar(60, 9.1)).value, 1, 'גבול 9.1° הוא כבר 1');
    eq(Dartboard.scoreAt.apply(null, Dartboard.polar(60, 351)).value, 20, 'זווית 351° חוזרת ל-20');

    var bull = Dartboard.scoreAt(0, 0);
    eq(bull.value, 25, 'מרכז הלוח הוא 25');
    eq(bull.multiplier, 2, 'מרכז הלוח הוא כפולה 2 (בול = דאבל)');
    eq(Dartboard.scoreAt(0, -12).multiplier, 1, 'בול חיצוני הוא כפולה 1');
    eq(Dartboard.scoreAt(0, -190).multiplier, 0, 'מחוץ ללוח הוא החטאה');

    /* ---------- isBust ---------- */

    eq(DartsEngine.isBust(-5, false), true, 'חריגה = אאוט');
    eq(DartsEngine.isBust(-5, true), true, 'חריגה בדאבל = אאוט');
    eq(DartsEngine.isBust(-1, true), true, 'חריגה ב-1 = אאוט');
    eq(DartsEngine.isBust(1, false), true, 'נותר 1 = אאוט');
    eq(DartsEngine.isBust(1, true), true, 'נותר 1 גם בדאבל = אאוט');
    eq(DartsEngine.isBust(0, false), true, 'אפס בלי דאבל = אאוט');
    eq(DartsEngine.isBust(0, true), false, 'אפס עם דאבל = ניצחון');
    eq(DartsEngine.isBust(2, false), false, 'נותר 2 = תקין');
    eq(DartsEngine.isBust(2, true), false, 'נותר 2 בדאבל = תקין');

    /* ---------- סגירות ---------- */

    var IMPOSSIBLE = [1, 159, 162, 163, 165, 166, 168, 169];
    var impossibleFound = [];
    for (var t = 1; t <= 170; t++) {
        if (!Checkouts.suggest(t, 3)) { impossibleFound.push(t); }
    }
    deepEq(impossibleFound, IMPOSSIBLE, 'קבוצת הסגירות הבלתי-אפשריות בטווח 1..170');

    var routesValid = true;
    var VALUES = { BULL: 50, '25': 25 };
    function routePoints(route) {
        var total = 0;
        for (var k = 0; k < route.length; k++) {
            var label = route[k];
            if (VALUES[label] !== undefined) { total += VALUES[label]; continue; }
            var mult = { S: 1, D: 2, T: 3 }[label.charAt(0)];
            total += mult * parseInt(label.slice(1), 10);
        }
        return total;
    }
    for (t = 2; t <= 170; t++) {
        var route = Checkouts.suggest(t, 3);
        if (!route) { continue; }
        var last = route[route.length - 1];
        var endsDouble = last === 'BULL' || last.charAt(0) === 'D';
        if (routePoints(route) !== t || !endsDouble || route.length > 3) {
            routesValid = false;
            failures.push('מסלול פגום עבור ' + t + ': ' + route.join(' '));
        }
    }
    ok(routesValid, 'כל מסלול מסתכם ליעד, מסתיים בדאבל, ובן ≤3 חצים');

    eq(Checkouts.format(Checkouts.suggest(40, 1)), 'D20', 'סגירת חץ אחד: 40 → D20');
    eq(Checkouts.suggest(60, 1), null, 'אין סגירת חץ אחד ל-60');
    eq(Checkouts.format(Checkouts.suggest(50, 1)), 'BULL', 'סגירת חץ אחד: 50 → BULL');
    eq(Checkouts.format(Checkouts.suggest(100, 2)), 'T20 D20', 'סגירת שני חצים: 100');
    eq(Checkouts.suggest(170, 2), null, 'אין סגירת שני חצים ל-170');
    eq(Checkouts.format(Checkouts.suggest(170, 3)), 'T20 T20 BULL', 'סגירת שלושה חצים: 170');
    eq(Checkouts.suggest(171, 3), null, 'אין סגירה מעל 170');
    eq(Checkouts.format(Checkouts.suggest(2, 1)), 'D1', 'סגירת חץ אחד: 2 → D1');

    /* ---------- המנוע ---------- */

    function game(names, startScore, bestOf) {
        return DartsEngine.createGame({
            names: names,
            startScore: startScore || 501,
            bestOf: bestOf || 1
        });
    }
    var T20 = { value: 20, multiplier: 3 };
    var S20 = { value: 20, multiplier: 1 };
    var D20 = { value: 20, multiplier: 2 };
    var D10 = { value: 10, multiplier: 2 };
    var BULL = { value: 25, multiplier: 2 };
    var MISS = { value: 0, multiplier: 0 };

    /* legsToWin נגזר נכון */
    eq(game(['a', 'b'], 501, 5).config.legsToWin, 3, 'מיטב מתוך 5 → 3 ליגים');
    eq(game(['a', 'b'], 501, 1).config.legsToWin, 1, 'מיטב מתוך 1 → ליג אחד');
    eq(game(['a', 'b'], 501, 7).config.legsToWin, 4, 'מיטב מתוך 7 → 4 ליגים');

    /* סיבוב תור אחרי שלושה חצים */
    var g = game(['a', 'b']);
    g = DartsEngine.applyDart(g, T20);
    g = DartsEngine.applyDart(g, T20);
    eq(g.currentPlayerIndex, 0, 'אחרי שני חצים עדיין אותו שחקן');
    eq(g.players[0].remaining, 381, 'שני טריפל 20 מורידים 120');
    g = DartsEngine.applyDart(g, T20);
    eq(g.currentPlayerIndex, 1, 'אחרי שלושה חצים התור עובר');
    eq(g.players[0].remaining, 321, '180 מלא');
    eq(g.players[0].lastTurnPoints, 180, 'סיבוב אחרון נרשם');
    eq(g.dartsThisTurn.length, 0, 'סרגל התור מתאפס');
    eq(g.players[1].turnStartRemaining, 501, 'עוגן ה-bust של השחקן הבא מתעדכן');

    /* אאוט: חריגה */
    var bustA = game(['a', 'b']);
    bustA.players[0].remaining = 40;
    bustA.players[0].turnStartRemaining = 40;
    var afterBustA = DartsEngine.applyDart(bustA, T20);
    eq(afterBustA.players[0].remaining, 40, 'חריגה: הניקוד חוזר לתחילת התור');
    eq(afterBustA.currentPlayerIndex, 1, 'חריגה: התור נגמר מיד');
    eq(afterBustA.lastTurn.bust, true, 'חריגה: מסומן כאאוט');
    eq(afterBustA.dartsThisTurn.length, 0, 'חריגה: סרגל התור מתאפס');
    var afterBustNext = DartsEngine.applyDart(afterBustA, T20);
    eq(afterBustNext.players[1].remaining, 441, 'אחרי אאוט החצים הבאים נזקפים לשחקן הבא');
    eq(afterBustNext.players[0].remaining, 40, 'והשחקן שביצע את האאוט לא מושפע');

    /* אאוט: נשאר 1 */
    var bustB = game(['a', 'b']);
    bustB.players[0].remaining = 21;
    bustB.players[0].turnStartRemaining = 21;
    var afterBustB = DartsEngine.applyDart(bustB, S20);
    eq(afterBustB.players[0].remaining, 21, 'נשאר 1: הניקוד חוזר');
    eq(afterBustB.lastTurn.bust, true, 'נשאר 1: מסומן כאאוט');

    /* אאוט: אפס בלי דאבל */
    var bustC = game(['a', 'b']);
    bustC.players[0].remaining = 20;
    bustC.players[0].turnStartRemaining = 20;
    var afterBustC = DartsEngine.applyDart(bustC, S20);
    eq(afterBustC.players[0].remaining, 20, 'אפס בסינגל: הניקוד חוזר');
    eq(afterBustC.legOver, false, 'אפס בסינגל אינו ניצחון');

    /* ניצחון בדאבל */
    var winA = game(['a', 'b'], 501, 1);
    winA.players[0].remaining = 20;
    winA.players[0].turnStartRemaining = 20;
    var afterWinA = DartsEngine.applyDart(winA, D10);
    eq(afterWinA.players[0].remaining, 0, 'D10 מ-20 מסיים');
    eq(afterWinA.legOver, true, 'הליג נגמר');
    eq(afterWinA.legWinnerIndex, 0, 'המנצח נרשם');
    eq(afterWinA.players[0].legsWon, 1, 'הליג נזקף');
    eq(afterWinA.matchOver, true, 'מיטב מתוך 1 → המשחק נגמר');

    /* ניצחון בבול */
    var winB = game(['a', 'b'], 501, 1);
    winB.players[0].remaining = 50;
    winB.players[0].turnStartRemaining = 50;
    var afterWinB = DartsEngine.applyDart(winB, BULL);
    eq(afterWinB.players[0].remaining, 0, 'בול מ-50 מסיים');
    eq(afterWinB.legOver, true, 'הבול נחשב דאבל');

    /* חצים אחרי סיום ליג לא נספרים */
    eq(DartsEngine.applyDart(afterWinA, T20), afterWinA, 'חץ אחרי סיום ליג לא משנה כלום');

    /* החטאה */
    var missG = game(['a', 'b']);
    var afterMiss = DartsEngine.applyDart(missG, MISS);
    eq(afterMiss.players[0].remaining, 501, 'החטאה לא משנה ניקוד');
    eq(afterMiss.dartsThisTurn.length, 1, 'החטאה צורכת חץ');

    /* שחקן יחיד: העוגן מתעגן מחדש כל סיבוב */
    var solo = game(['a']);
    solo = DartsEngine.applyDart(solo, T20);
    solo = DartsEngine.applyDart(solo, T20);
    solo = DartsEngine.applyDart(solo, T20);
    eq(solo.currentPlayerIndex, 0, 'שחקן יחיד ממשיך בעצמו');
    eq(solo.players[0].turnStartRemaining, 321, 'העוגן זז ל-321, לא נשאר 501');
    var soloBust = DartsEngine.applyDart(solo, { value: 20, multiplier: 3 });
    soloBust.players[0].remaining = 10;
    soloBust.players[0].turnStartRemaining = 10;
    eq(DartsEngine.applyDart(soloBust, T20).players[0].remaining, 10,
       'שחקן יחיד: אאוט חוזר לעוגן הנוכחי');

    /* סיבוב שחקן פותח בין ליגים */
    var rot = game(['a', 'b', 'c'], 501, 5);
    eq(rot.legStarterIndex, 0, 'ליג 1 פותח שחקן 1');
    rot = DartsEngine.startNewLeg(rot);
    eq(rot.legStarterIndex, 1, 'ליג 2 פותח שחקן 2');
    eq(rot.currentPlayerIndex, 1, 'השחקן הנוכחי הוא הפותח');
    eq(rot.players[0].remaining, 501, 'הניקוד מתאפס בליג חדש');
    rot = DartsEngine.startNewLeg(rot);
    eq(rot.legStarterIndex, 2, 'ליג 3 פותח שחקן 3');
    rot = DartsEngine.startNewLeg(rot);
    eq(rot.legStarterIndex, 0, 'ליג 4 חוזר לשחקן 1');

    /* ---------- Undo: מחסנית snapshots ---------- */

    var start = game(['a', 'b'], 501, 3);
    start.players[0].remaining = 100;
    start.players[0].turnStartRemaining = 100;
    var initial = DartsEngine.clone(start);

    var stack = [];
    var cur = start;
    var script = [T20, S20, T20, T20, T20, MISS, D20, T20, S20, T20, T20, T20];
    for (var s = 0; s < script.length; s++) {
        var nxt = DartsEngine.applyDart(cur, script[s]);
        if (nxt === cur) { continue; }
        stack.push(cur);
        cur = nxt;
    }
    eq(stack.length, script.length, 'כל 12 החצים נכנסו להיסטוריה');
    while (stack.length) { cur = stack.pop(); }
    deepEq(cur, initial, 'ביטול מלא מחזיר בדיוק למצב ההתחלתי');

    /* ביטול מעל אאוט */
    var ub = game(['a', 'b']);
    ub.players[0].remaining = 40;
    ub.players[0].turnStartRemaining = 40;
    var beforeBust = DartsEngine.applyDart(ub, MISS);   /* חץ 1: החטאה */
    var busted = DartsEngine.applyDart(beforeBust, T20); /* חץ 2: אאוט */
    eq(busted.currentPlayerIndex, 1, 'אחרי אאוט התור עבר');
    deepEq(DartsEngine.clone(beforeBust), beforeBust, 'שכפול יציב');
    eq(beforeBust.currentPlayerIndex, 0, 'ביטול מעל אאוט מחזיר את השחקן שביצע');
    eq(beforeBust.dartsThisTurn.length, 1, 'ביטול מעל אאוט משאיר את החץ הקודם');
    eq(beforeBust.players[0].remaining, 40, 'הניקוד לפני האאוט');

    /* ביטול מעל גבול תור */
    var ut = game(['a', 'b']);
    var d1 = DartsEngine.applyDart(ut, T20);
    var d2 = DartsEngine.applyDart(d1, T20);
    var d3 = DartsEngine.applyDart(d2, T20);
    eq(d3.currentPlayerIndex, 1, 'התור עבר');
    eq(d2.currentPlayerIndex, 0, 'ביטול מחזיר את השחקן הקודם');
    eq(d2.dartsThisTurn.length, 2, 'עם שני חצים מוצגים');
    eq(d2.players[0].remaining, 381, 'והניקוד שלפני החץ השלישי');

    /* ---------- דיווח ---------- */

    var total = passed + failures.length;
    var summary = failures.length === 0
        ? '✅ כל ' + total + ' הבדיקות עברו'
        : '❌ ' + failures.length + ' מתוך ' + total + ' נכשלו';

    if (failures.length) {
        console.error(summary);
        failures.forEach(function (m) { console.error('  · ' + m); });
    } else {
        console.log(summary);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { passed: passed, failures: failures };
    }
    if (typeof process !== 'undefined' && process.exit && failures.length) {
        process.exitCode = 1;
    }
}());
