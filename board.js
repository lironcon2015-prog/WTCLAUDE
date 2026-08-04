/**
 * board.js — רינדור מטרת הדארטס כ-SVG וזיהוי הפגיעות.
 *
 * קונבנציית זוויות: מעלות עם כיוון השעון החל מ-12. ציר ה-y ב-SVG מצביע למטה,
 * ולכן polar() משתמשת ב-(sin, -cos) ולא ב-(cos, sin) הרגילים.
 */
var Dartboard = (function () {
    'use strict';

    /* סדר המספרים על לוח תקני, עם כיוון השעון, כשה-20 למעלה */
    var ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

    /* רדיוסים בתקן WDF, במילימטרים — משמשים ישירות כיחידות משתמש ב-SVG */
    var R = {
        BULL: 6.35,
        OUTER_BULL: 15.9,
        TRIPLE_IN: 99,
        TRIPLE_OUT: 107,
        DOUBLE_IN: 162,
        DOUBLE_OUT: 170,
        LABEL: 185
    };

    /* רצועות פגיעה מורחבות ובלתי-נראות — הטריפל והדאבל מקבלים 18 מ"מ במקום 8 */
    var HIT = {
        BULL: 10,
        OUTER_BULL: 20,
        TRIPLE_IN: 93,
        TRIPLE_OUT: 111,
        DOUBLE_IN: 156,
        DOUBLE_OUT: 174
    };

    var VIEWBOX = 200;

    /**
     * @param {number} r רדיוס
     * @param {number} phi מעלות עם כיוון השעון מ-12
     * @returns {number[]} [x, y] במרחב המשתמש של ה-SVG
     */
    function polar(r, phi) {
        var t = phi * Math.PI / 180;
        return [r * Math.sin(t), -r * Math.cos(t)];
    }

    function f(p) {
        return p[0].toFixed(3) + ',' + p[1].toFixed(3);
    }

    /**
     * מקטע טבעתי בין שני רדיוסים ושתי זוויות.
     * large-arc תמיד 0 (18° ≪ 180°); sweep=1 בקשת החיצונית כי φ עולה הוא כיוון השעון
     * על המסך, ו-sweep=0 בפנימית כי היא נוסעת בכיוון ההפוך.
     */
    function annularSector(r1, r2, a1, a2) {
        var p1 = polar(r1, a1),
            p2 = polar(r2, a1),
            p3 = polar(r2, a2),
            p4 = polar(r1, a2);
        return 'M' + f(p1) +
               'L' + f(p2) +
               'A' + r2 + ' ' + r2 + ' 0 0 1 ' + f(p3) +
               'L' + f(p4) +
               'A' + r1 + ' ' + r1 + ' 0 0 0 ' + f(p1) +
               'Z';
    }

    var BANDS = [
        { key: 'is', vis: [R.OUTER_BULL, R.TRIPLE_IN], hit: [HIT.OUTER_BULL, HIT.TRIPLE_IN], mult: 1, bed: true },
        { key: 't', vis: [R.TRIPLE_IN, R.TRIPLE_OUT], hit: [HIT.TRIPLE_IN, HIT.TRIPLE_OUT], mult: 3, bed: false },
        { key: 'os', vis: [R.TRIPLE_OUT, R.DOUBLE_IN], hit: [HIT.TRIPLE_OUT, HIT.DOUBLE_IN], mult: 1, bed: true },
        { key: 'd', vis: [R.DOUBLE_IN, R.DOUBLE_OUT], hit: [HIT.DOUBLE_IN, HIT.DOUBLE_OUT], mult: 2, bed: false }
    ];

    function buildSvg() {
        var out = [];
        var i, b, a1, a2, light, id, p;

        out.push('<svg id="board-svg" viewBox="' + (-VIEWBOX) + ' ' + (-VIEWBOX) + ' ' +
                 (VIEWBOX * 2) + ' ' + (VIEWBOX * 2) + '" xmlns="http://www.w3.org/2000/svg" ' +
                 'role="img" aria-label="לוח דארטס">');

        /* רקע החטאה — מבטיח שלכל פיקסל יש יעד פגיעה תקף */
        out.push('<rect class="db-miss" x="' + (-VIEWBOX) + '" y="' + (-VIEWBOX) + '" width="' +
                 (VIEWBOX * 2) + '" height="' + (VIEWBOX * 2) + '" data-value="0" data-mult="0"></rect>');

        /* ---- שכבה נראית (לא מקבלת אירועים) ---- */
        out.push('<g class="db-visual" pointer-events="none">');
        out.push('<circle class="db-rim" cx="0" cy="0" r="' + R.DOUBLE_OUT + '"></circle>');

        for (i = 0; i < 20; i++) {
            a1 = i * 18 - 9;
            a2 = i * 18 + 9;
            light = i % 2 === 1;
            for (b = 0; b < BANDS.length; b++) {
                var band = BANDS[b];
                var cls = band.bed
                    ? (light ? 'db-bed-light' : 'db-bed-dark')
                    : (light ? 'db-ring-green' : 'db-ring-red');
                out.push('<path id="v' + i + band.key + '" class="' + cls + '" d="' +
                         annularSector(band.vis[0], band.vis[1], a1, a2) + '"></path>');
            }
        }

        out.push('<circle id="vob" class="db-ring-green" cx="0" cy="0" r="' + R.OUTER_BULL + '"></circle>');
        out.push('<circle id="vb" class="db-ring-red" cx="0" cy="0" r="' + R.BULL + '"></circle>');

        /* חוטים — קווי הפרדה בין הסקטורים ומעגלי הטבעות */
        out.push('<g class="db-wire">');
        for (i = 0; i < 20; i++) {
            var w1 = polar(R.OUTER_BULL, i * 18 - 9);
            var w2 = polar(R.DOUBLE_OUT, i * 18 - 9);
            out.push('<line x1="' + w1[0].toFixed(2) + '" y1="' + w1[1].toFixed(2) +
                     '" x2="' + w2[0].toFixed(2) + '" y2="' + w2[1].toFixed(2) + '"></line>');
        }
        [R.BULL, R.OUTER_BULL, R.TRIPLE_IN, R.TRIPLE_OUT, R.DOUBLE_IN, R.DOUBLE_OUT].forEach(function (r) {
            out.push('<circle cx="0" cy="0" r="' + r + '"></circle>');
        });
        out.push('</g>');

        /* תוויות המספרים */
        for (i = 0; i < 20; i++) {
            p = polar(R.LABEL, i * 18);
            out.push('<text class="db-label" x="' + p[0].toFixed(2) + '" y="' + p[1].toFixed(2) +
                     '">' + ORDER[i] + '</text>');
        }
        out.push('</g>');

        /* ---- שכבת פגיעה בלתי-נראית, אחרונה בסדר המסמך ---- */
        out.push('<g class="db-hit">');
        for (i = 0; i < 20; i++) {
            a1 = i * 18 - 9;
            a2 = i * 18 + 9;
            for (b = 0; b < BANDS.length; b++) {
                var hb = BANDS[b];
                id = 'v' + i + hb.key;
                out.push('<path d="' + annularSector(hb.hit[0], hb.hit[1], a1, a2) +
                         '" fill="none" pointer-events="all" data-value="' + ORDER[i] +
                         '" data-mult="' + hb.mult + '" data-vis="' + id + '"></path>');
            }
        }
        out.push('<circle cx="0" cy="0" r="' + HIT.OUTER_BULL +
                 '" fill="none" pointer-events="all" data-value="25" data-mult="1" data-vis="vob"></circle>');
        out.push('<circle cx="0" cy="0" r="' + HIT.BULL +
                 '" fill="none" pointer-events="all" data-value="25" data-mult="2" data-vis="vb"></circle>');
        out.push('</g>');

        out.push('</svg>');
        return out.join('');
    }

    var svgEl = null;
    var flashTimer = null;

    /** מזריק את ה-SVG לתוך מיכל. חייב להיות innerHTML של המיכל, לא של אלמנט svg קיים. */
    function render(container) {
        container.innerHTML = buildSvg();
        svgEl = container.querySelector('#board-svg');
        return svgEl;
    }

    /** הבהוב קצר על המקטע שנפגע, כמשוב מגע */
    function flash(visId) {
        var el = visId && document.getElementById(visId);
        if (!el) { return; }
        if (flashTimer) { clearTimeout(flashTimer); }
        var prev = svgEl.querySelector('.db-flash');
        if (prev) { prev.classList.remove('db-flash'); }
        el.classList.add('db-flash');
        flashTimer = setTimeout(function () {
            el.classList.remove('db-flash');
            flashTimer = null;
        }, 220);
    }

    /**
     * מאזין מואצל יחיד. משתמש ב-click ולא ב-pointerdown כדי שגרירת האצבע
     * מחוץ למקטע תבטל את ההקשה.
     */
    function bind(onHit) {
        if (!svgEl) { return; }
        svgEl.addEventListener('click', function (e) {
            var el = e.target;
            if (!el || !el.dataset || el.dataset.value === undefined) { return; }
            flash(el.dataset.vis);
            onHit({
                value: parseInt(el.dataset.value, 10),
                multiplier: parseInt(el.dataset.mult, 10)
            });
        });
    }

    /**
     * ניקוד לפי קואורדינטות — פונקציה טהורה, לא מחוברת לאף אירוע.
     * קיימת כדי ש-tests.js יוכיח ש-ORDER וקונבנציית הזוויות מסכימות עם מה שמצויר.
     */
    function scoreAt(x, y) {
        var r = Math.sqrt(x * x + y * y);
        if (r <= R.BULL) { return { value: 25, multiplier: 2 }; }
        if (r <= R.OUTER_BULL) { return { value: 25, multiplier: 1 }; }
        if (r > R.DOUBLE_OUT) { return { value: 0, multiplier: 0 }; }

        var phi = Math.atan2(x, -y) * 180 / Math.PI;
        if (phi < 0) { phi += 360; }
        var value = ORDER[Math.round(phi / 18) % 20];

        var mult = 1;
        if (r > R.TRIPLE_IN && r <= R.TRIPLE_OUT) { mult = 3; }
        else if (r > R.DOUBLE_IN) { mult = 2; }
        return { value: value, multiplier: mult };
    }

    return {
        ORDER: ORDER,
        R: R,
        HIT: HIT,
        polar: polar,
        annularSector: annularSector,
        render: render,
        bind: bind,
        scoreAt: scoreAt
    };
})();
