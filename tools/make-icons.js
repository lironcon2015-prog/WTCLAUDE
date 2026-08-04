#!/usr/bin/env node
/**
 * tools/make-icons.js — מייצר את קבצי האייקון של ה-PWA.
 * כלי פיתוח בלבד: אינו נטען בזמן ריצה ואינו חלק מהאפליקציה.
 *
 * הרצה:  node tools/make-icons.js
 *
 * הגאומטריה נלקחת מ-board.js כדי שלא יהיה מקור אמת שני — אותו polar()
 * ואותו annularSector() שמציירים את המטרה באפליקציה.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var chromium;
try {
    chromium = require('playwright').chromium;
} catch (e) {
    chromium = require('/opt/node22/lib/node_modules/playwright').chromium;
}

var ROOT = path.join(__dirname, '..');
var OUT = path.join(ROOT, 'icons');

/* board.js נוגע ב-document רק בתוך פונקציות, ולכן טעינה ב-vm בלי DOM עוברת בשלום */
var sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'board.js'), 'utf8'), sandbox);
var Dartboard = sandbox.Dartboard;

/* צבעים — זהים לטוקנים ב-:root שב-style.css */
var C = {
    bg: '#0f1115',
    rim: '#2a2f39',
    black: '#16181c',
    cream: '#e8dcc0',
    red: '#c8352b',
    green: '#2f8a4c'
};

/*
 * לוח מפושט: 8 סקטורים במקום 20, בלי מספרים ובלי חוטים, וטבעות דאבל/טריפל
 * מורחבות פי ~4. ב-48dp סקטור מתוך 20 יוצא ~7px ומיטשטש לאפור; מתוך 8 הוא ~17px.
 * annularSector מקבע large-arc-flag=0, שתקף כל עוד הסקטור קטן מ-180° — 45° בטוח.
 */
var SECTORS = 8;
var STEP = 360 / SECTORS;
var RO = Dartboard.R.DOUBLE_OUT;          /* 170 — נשאר על הסקאלה של הלוח האמיתי */
var RING = { DOUBLE_IN: 140, TRIPLE_OUT: 110, TRIPLE_IN: 80, OUTER_BULL: 40, BULL: 20 };

/**
 * @param {number} frac רדיוס הלוח כשבר מחצי רוחב הקנבס.
 *   0.92 = אייקון רגיל; 0.80 = maskable, בדיוק אזור הבטוח של אנדרואיד
 *   (מעגל מרכזי בקוטר 80% מהרוחב — כל מה שמחוצה לו עלול להיחתך).
 */
function buildSvg(frac) {
    var half = RO / frac;
    var out = [];
    var i;

    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
             (-half) + ' ' + (-half) + ' ' + (half * 2) + ' ' + (half * 2) + '">');
    /* רקע אטום: iOS מרנדר שקיפות כשחור, ומשגרי אנדרואיד מניחים אייקון לא-ממוסך על רקע לבן */
    out.push('<rect x="' + (-half) + '" y="' + (-half) + '" width="' + (half * 2) +
             '" height="' + (half * 2) + '" fill="' + C.bg + '"/>');
    out.push('<circle cx="0" cy="0" r="' + RO + '" fill="' + C.rim + '"/>');

    for (i = 0; i < SECTORS; i++) {
        var a1 = i * STEP - STEP / 2;
        var a2 = i * STEP + STEP / 2;
        var light = i % 2 === 1;                      /* אותה קונבנציה כמו ב-board.js */
        var bed = light ? C.cream : C.black;
        var ring = light ? C.green : C.red;
        out.push('<path fill="' + bed + '" d="' + Dartboard.annularSector(RING.OUTER_BULL, RING.TRIPLE_IN, a1, a2) + '"/>');
        out.push('<path fill="' + ring + '" d="' + Dartboard.annularSector(RING.TRIPLE_IN, RING.TRIPLE_OUT, a1, a2) + '"/>');
        out.push('<path fill="' + bed + '" d="' + Dartboard.annularSector(RING.TRIPLE_OUT, RING.DOUBLE_IN, a1, a2) + '"/>');
        out.push('<path fill="' + ring + '" d="' + Dartboard.annularSector(RING.DOUBLE_IN, RO, a1, a2) + '"/>');
    }

    out.push('<circle cx="0" cy="0" r="' + RING.OUTER_BULL + '" fill="' + C.green + '"/>');
    out.push('<circle cx="0" cy="0" r="' + RING.BULL + '" fill="' + C.red + '"/>');
    out.push('</svg>');
    return out.join('');
}

var TARGETS = [
    { file: 'icon-192.png', size: 192, frac: 0.92 },
    { file: 'icon-512.png', size: 512, frac: 0.92 },
    { file: 'icon-maskable-192.png', size: 192, frac: 0.80 },
    { file: 'icon-maskable-512.png', size: 512, frac: 0.80 },
    { file: 'apple-touch-icon-180.png', size: 180, frac: 0.92 }
];

(async function () {
    fs.mkdirSync(OUT, { recursive: true });
    var browser = await chromium.launch();
    for (var i = 0; i < TARGETS.length; i++) {
        var t = TARGETS[i];
        var page = await browser.newPage({
            viewport: { width: t.size, height: t.size },
            deviceScaleFactor: 1
        });
        await page.setContent(
            '<style>html,body{margin:0;padding:0;background:' + C.bg + '}' +
            'svg{display:block;width:' + t.size + 'px;height:' + t.size + 'px}</style>' +
            buildSvg(t.frac)
        );
        await page.screenshot({ path: path.join(OUT, t.file) });
        await page.close();
        console.log('wrote icons/' + t.file + '  (' + t.size + 'px, לוח = ' +
                    Math.round(t.frac * 100) + '% מהרוחב)');
    }
    await browser.close();
}());
