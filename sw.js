/**
 * sw.js — Service worker: precache של קליפת האפליקציה, לעבודה מלאה בלי רשת.
 *
 * הוא אינו נדרש להתקנה — כרום ויתר על דרישת ה-service worker בגרסה 108 בנייד
 * ו-112 בדסקטופ. הוא כאן בשביל אופליין: משחקים בפאב עם ויי-פיי גרוע.
 */
'use strict';

/* מעלים בכל שחרור שמשנה קובץ ברשימה. אם משנים גם ?v= ב-index.html — לעדכן שם. */
var CACHE_VERSION = 'darts-v2';

/*
 * הנתיבים יחסיים ל-sw.js עצמו: ב-GitHub Pages './' הוא /WTCLAUDE/, בשורש דומיין
 * הוא '/', ובפורק הוא נתיב הפורק. אפס נתיבים מקודדים.
 *
 * מחרוזות ה-?v= חייבות להיות זהות בדיוק לאלה שב-index.html — מחרוזת השאילתה
 * היא חלק ממפתח המטמון, ולכן precache של 'style.css' מול בקשה ל-'style.css?v=2'
 * הוא פספוס ודאי.
 */
var ASSETS = [
    './',
    './index.html',
    './style.css?v=2',
    './board.js?v=2',
    './checkout.js?v=2',
    './engine.js?v=2',
    './storage.js?v=2',
    './app.js?v=2',
    './tests.js?v=2',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon-180.png'
];

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(function (cache) {
            /* cache:'reload' עוקף את מטמון ה-HTTP. GitHub Pages מגיש max-age=600,
               ובלעדיו ה-service worker עלול להנציח בייטים ישנים לכל אורך חיי המטמון. */
            return cache.addAll(ASSETS.map(function (url) {
                return new Request(url, { cache: 'reload' });
            }));
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (k) {
                return k === CACHE_VERSION ? null : caches.delete(k);
            }));
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') { return; }
    if (new URL(req.url).origin !== self.location.origin) { return; }

    /* ניווט — תמיד ה-index מהמטמון, כך ש-index.html?test=1 עובד גם אופליין */
    if (req.mode === 'navigate') {
        event.respondWith(
            caches.open(CACHE_VERSION).then(function (cache) {
                return cache.match('./index.html');
            }).then(function (hit) {
                return hit || fetch(req);
            })
        );
        return;
    }

    event.respondWith(
        caches.open(CACHE_VERSION).then(function (cache) {
            return cache.match(req).then(function (hit) {
                if (hit) { return hit; }
                /* רשת ביטחון: אם ?v= ב-HTML זז ו-ASSETS לא, עדיין מגישים משהו
                   ישן במקום להישבר לגמרי במצב אופליין */
                return cache.match(req, { ignoreSearch: true }).then(function (loose) {
                    return loose || fetch(req);
                });
            });
        })
    );
});
