(function (bundledVersion) {
    'use strict';

    if (!window.Lampa || window.open4kPages || window.open4kPluginLoaded) return;

    var installation = document.currentScript;
    var baseUrl = installationBase(installation && installation.src);
    var version = bundledVersion;
    var pendingRuntime = null;
    var pendingCheck = null;
    var storage;
    var parseMirror;
    var mirrorKey;
    var publishedAt = 0;
    var readLanding;
    var checkInterval = 2 * 60 * 1000;
    var staleAfter = 2 * 60 * 60 * 1000;

    var host = window.open4kPages = {
        runtime: null,
        mirror: '',
        fresh: false,
        checking: false,
        publish: function (script, runtime) {
            if (!host.runtime && script === installation) {
                host.runtime = runtime;
                return true;
            }
            if (!pendingRuntime || script !== pendingRuntime.script) return false;

            host.runtime = runtime;
            version = pendingRuntime.version;
            return true;
        },
        start: function (pluginStorage, normalizeMirror, storageKey, fallbackCheck) {
            if (storage) return;
            storage = pluginStorage;
            parseMirror = normalizeMirror;
            mirrorKey = storageKey;
            readLanding = fallbackCheck;
            host.mirror = parseMirror(storage.get(mirrorKey, ''));
            publishedAt = Number(storage.get(mirrorKey + '_published_at', 0)) || 0;

            // Lampa can restore an inline copy from its plugin cache during a network outage.
            if (!baseUrl) {
                var installed = storage.get('plugins', []) || [];
                for (var i = 0; i < installed.length && !baseUrl; i++) {
                    var plugin = installed[i];
                    if (plugin && plugin.status !== 0 && plugin.status !== false) {
                        baseUrl = installationBase(typeof plugin === 'string' ? plugin : plugin.url);
                    }
                }
            }
            refresh();
            window.setInterval(refresh, checkInterval);
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) refresh();
            });
        },
        refresh: refresh
    };

    function installationBase(src) {
        if (typeof src !== 'string') return '';
        var match = /^(https:\/\/[^/?#]+\/(?:[^?#]*\/)?)(?:open-4k|p)\.js(?:[?#]|$)/i.exec(src);
        return match ? match[1] : '';
    }

    function loadRuntime(nextVersion) {
        if (nextVersion === version || pendingRuntime || typeof nextVersion !== 'string' ||
            !/^[a-f0-9]{64}$/.test(nextVersion)) return;

        var script = document.createElement('script');
        pendingRuntime = { script: script, version: nextVersion };

        function cleanup() {
            if (!pendingRuntime || pendingRuntime.script !== script) return;
            window.clearTimeout(timeout);
            if (script.parentNode) script.parentNode.removeChild(script);
            pendingRuntime = null;
        }

        var timeout = window.setTimeout(cleanup, 8000);
        script.onload = script.onerror = cleanup;
        script.src = baseUrl + 'runtime-' + nextVersion + '.js';
        document.head.appendChild(script);
    }

    function refresh(done) {
        if (pendingCheck) {
            if (typeof done === 'function') pendingCheck.push(done);
            return;
        }
        pendingCheck = typeof done === 'function' ? [done] : [];
        host.checking = true;

        function finish(origin, fresh) {
            host.checking = false;
            host.fresh = fresh;
            if (origin && origin !== host.mirror) {
                host.mirror = origin;
                try { storage.set(mirrorKey, origin); } catch (error) { /* Keep the session address. */ }
            }
            var callbacks = pendingCheck;
            pendingCheck = null;
            callbacks.forEach(function (callback) { callback(fresh ? origin : ''); });
        }

        function fallback(origin, rememberPublication) {
            readLanding(function (direct) {
                if (rememberPublication) rememberPublication();
                finish(direct || origin, Boolean(direct));
            });
        }

        if (!baseUrl) {
            fallback('');
            return;
        }

        var request = new XMLHttpRequest();
        try {
            request.open('GET', baseUrl + 'release.json?check=' + Date.now(), true);
            request.timeout = 5000;
            request.onload = function () {
                var release;
                try { if (request.status === 200) release = JSON.parse(request.responseText); } catch (error) {}
                if (!release || typeof release !== 'object') {
                    fallback('');
                    return;
                }

                loadRuntime(release.version);
                var origin = parseMirror(release.mirror);
                var checkedAt = Number(release.mirrorUpdatedAt) || 0;
                var isNew = origin && checkedAt > publishedAt;

                function rememberPublication() {
                    if (!isNew) return;
                    publishedAt = checkedAt;
                    try { storage.set(mirrorKey + '_published_at', publishedAt); } catch (error) {}
                }

                var verified = release.mirrorVerified === true && checkedAt > 0 && Date.now() - checkedAt < staleAfter;
                if (origin && verified && (isNew || (origin === host.mirror && checkedAt === publishedAt))) {
                    rememberPublication();
                    finish(origin, true);
                } else {
                    fallback(isNew ? origin : host.mirror || origin, rememberPublication);
                }
            };
            request.onerror = request.ontimeout = function () { fallback(''); };
            request.send();
        } catch (error) {
            fallback('');
        }
    }
}('6654425911f033eb829d68d007b27207601c039348ccf8d9121c0ab5e43540fc'));

(function () {
    'use strict';

    var mirrorPage = 'https://fanfilmzerkalo.fun/';

    function mirrorOrigin(value) {
        if (typeof value !== 'string') return '';
        var match = /^(?:https:)?\/\/((?:[a-z0-9-]+\.)*fanfilm4k\.(?:media|run))(?=[/?#]|$)/i.exec(value.trim());
        return match ? 'https://' + match[1].toLowerCase() : '';
    }

    function mirrorFromHtml(html) {
        var anchors = /<a(?=\s|>)((?:[^"'<>]|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a\s*>/gi;
        var markup = html.replace(/<!--[\s\S]*?-->|<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
        var candidates = [];
        var buttons = [];
        var anchor;

        while ((anchor = anchors.exec(markup))) {
            var attributes = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g;
            var attribute;
            while ((attribute = attributes.exec(anchor[1]))) {
                if (attribute[1].toLowerCase() !== 'href') continue;

                var origin = mirrorOrigin(attribute[2] || attribute[3] || attribute[4]);
                if (!origin) break;

                var label = anchor[2].replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;/gi, ' ').trim();
                if (candidates.indexOf(origin) === -1) candidates.push(origin);
                if (/^открыть\s+сайт$/i.test(label) && buttons.indexOf(origin) === -1) buttons.push(origin);
                break;
            }
        }

        var advertised = buttons.length ? buttons : candidates;
        return advertised.length === 1 ? advertised[0] : '';
    }

    // Share the same mirror parser with the local server while keeping the TV script standalone.
    if (typeof window === 'undefined' && typeof module === 'object') {
        module.exports = { mirrorPage: mirrorPage, mirrorOrigin: mirrorOrigin, mirrorFromHtml: mirrorFromHtml };
        return;
    }

    var lampa = window.Lampa;
    var pagesHost = window.open4kPages;
    if (!lampa || (window.open4kPluginLoaded && !pagesHost)) return;

    var scriptUrl = document.currentScript && document.currentScript.src;
    var resolverUrl = /^https?:\/\//i.test(scriptUrl || '') ?
        scriptUrl.split(/[?#]/)[0].replace(/[^/]+$/, 'fanfilm/mirror') : '';
    var mirrorStorageKey = 'open4k_fanfilm_origin';
    var fallbackMirror = 'https://v17.fanfilm4k.media';
    var fanfilmMirror = '';
    var mirrorCheck = null;
    var mirrorFresh = false;

    var menuTitle = 'Открытое 4K';
    var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>';
    var bunny = 'https://distribution.bbb3d.renderfarming.net/video/mp4/bbb_sunflower_';
    var commons = 'https://upload.wikimedia.org/wikipedia/commons/';

    var films = [
        {
            title: 'Big Buck Bunny',
            year: 2008,
            credit: 'Blender Foundation, версия Sunflower — Janus B. Kristensen · CC BY 3.0',
            streams: [
                { title: '4K · 3840×2160', subtitle: 'MP4 · H.264 · 30 кадров/с', url: bunny + '2160p_30fps_normal.mp4' },
                { title: 'Full HD', subtitle: 'MP4 · H.264 · 30 кадров/с', url: bunny + '1080p_30fps_normal.mp4' }
            ]
        },
        commonsFilm('Tears of Steel', 2012, 'Blender Institute', '3.0', '3840×1714', 'VP8 / Vorbis',
            '1/10/', 'Tears_of_Steel_in_4k_-_Official_Blender_Foundation_release.webm', 'OHOpb2fS-cM'),
        commonsFilm('Charge', 2022, 'Blender Studio', '4.0', '3840×1608', 'VP9 / Opus',
            '7/7a/', 'Charge_-_Blender_Open_Movie-full_movie.webm', 'UXqq0ZvbOnk'),
        commonsFilm('Glass Half', 2015, 'Blender Foundation', '4.0', '3840×2160', 'VP9 / Opus',
            '0/02/', 'Glass_Half_-_Blender_Open_Movie-full_movie.webm', 'lqiN98z6Dak'),
        commonsFilm('SINGULARITY', 2026, 'Blender Studio', '4.0', '3840×1608', 'AV1 / Opus',
            'f/f2/', 'SINGULARITY_-_Blender_Open_Movie-full_movie.webm', 'l5OZu-IrXpw')
    ];

    var mosfilm = [
        studioFilm('Забытая мелодия для флейты', 1987, 'z7HDwZG9OFw'),
        studioFilm('Служили два товарища', 1968, 'e7P3QbcI91U'),
        studioFilm('Коммунист', 1957, 'es8MdRnBdJQ')
    ];

    function commonsFilm(title, year, author, license, resolution, codecs, folder, filename, youtubeId) {
        var path = folder + filename;
        return {
            title: title,
            year: year,
            credit: author + ' · CC BY ' + license + ' · Wikimedia Commons',
            streams: [
                { title: '4K · ' + resolution, subtitle: 'WebM · ' + codecs, url: commons + path },
                {
                    title: 'Full HD',
                    subtitle: 'WebM · VP9',
                    url: commons + 'transcoded/' + path + '/' + filename + '.1080p.vp9.webm'
                },
                youtubeStream(youtubeId)
            ]
        };
    }

    function studioFilm(title, year, id) {
        return {
            title: title,
            year: year,
            credit: 'Мосфильм · YouTube',
            streams: [youtubeStream(id)]
        };
    }

    function youtubeStream(id) {
        return {
            title: 'Смотреть на YouTube',
            subtitle: 'Качество выбирает YouTube',
            url: 'https://www.youtube.com/watch?v=' + id
        };
    }

    function play(title, url) {
        lampa.Player.play({ title: title, url: url });
    }

    function requestMirror(url, timeout, read, done) {
        var request = new XMLHttpRequest();
        try {
            request.open('GET', url, true);
            request.timeout = timeout;
            request.onload = function () {
                var origin = '';
                try {
                    if (request.status >= 200 && request.status < 300) origin = read(request);
                } catch (error) {
                    // A broken response must never replace the saved origin.
                }
                done(origin);
            };
            request.onerror = request.ontimeout = function () { done(''); };
            request.send();
        } catch (error) {
            done('');
        }
    }

    function readLanding(done) {
        requestMirror(mirrorPage + '?check=' + Date.now(), 3500, function (request) {
            return mirrorOrigin(request.responseURL) || mirrorFromHtml(request.responseText);
        }, done);
    }

    function refreshFanfilm(onComplete) {
        if (pagesHost) {
            pagesHost.refresh(onComplete);
            return;
        }
        if (mirrorCheck) {
            if (onComplete) mirrorCheck.push(onComplete);
            return;
        }
        mirrorCheck = onComplete ? [onComplete] : [];

        function finish(origin) {
            mirrorFresh = Boolean(origin);
            if (origin && origin !== fanfilmMirror) {
                fanfilmMirror = origin;
                try {
                    lampa.Storage.set(mirrorStorageKey, origin);
                } catch (error) {
                    // The new address still works in this session if storage is unavailable.
                }
            }
            var listeners = mirrorCheck;
            mirrorCheck = null;
            listeners.forEach(function (callback) { callback(origin); });
        }

        if (!resolverUrl) {
            readLanding(finish);
            return;
        }

        requestMirror(resolverUrl + '?check=' + Date.now(), 5500, function (request) {
            return mirrorOrigin(JSON.parse(request.responseText).url);
        }, function (origin) {
            if (origin) finish(origin);
            else readLanding(finish);
        });
    }

    function openFanfilmPage(url) {
        if (lampa.Android && typeof lampa.Android.openBrowser === 'function' &&
            window.AndroidJS && typeof window.AndroidJS.openBrowser === 'function') {
            lampa.Android.openBrowser(url);
            return;
        }
        window.location.assign(url);
    }

    function activeMirror() {
        return (pagesHost ? pagesHost.mirror : fanfilmMirror) || fallbackMirror;
    }

    function showFanfilm(controller) {
        var saved = pagesHost ? pagesHost.mirror : fanfilmMirror;
        var checking = pagesHost ? pagesHost.checking : mirrorCheck;
        var fresh = pagesHost ? pagesHost.fresh : mirrorFresh;
        var status = 'Адрес из предыдущей проверки';
        if (checking) status = 'Проверяем зеркало';
        else if (fresh) status = 'Адрес получен со страницы зеркал';
        else if (!saved) status = 'Последний известный адрес';

        showPicker('FanFilm4K', [
            {
                title: 'Открыть каталог',
                subtitle: status + ' · ' + activeMirror(),
                action: function () { openFanfilmPage(activeMirror() + '/'); }
            },
            {
                title: 'Фильмы 4K UHD',
                subtitle: 'Откроется сайт FanFilm4K',
                action: function () { openFanfilmPage(activeMirror() + '/4k-films/'); }
            },
            {
                title: 'Обновить зеркало',
                action: function () {
                    lampa.Noty.show('Проверяем адрес FanFilm4K…');
                    refreshFanfilm(function (origin) {
                        lampa.Noty.show(origin ? 'Зеркало FanFilm4K: ' + origin : 'Проверка не удалась. Попробуй последний адрес или страницу зеркал.');
                    });
                }
            },
            {
                title: 'Страница зеркал',
                action: function () { openFanfilmPage(mirrorPage); }
            }
        ], controller, function () { showCatalog(controller); });
    }

    function showPicker(title, items, controller, onBack) {
        var selected = false;
        lampa.Select.show({
            title: title,
            items: items,
            nohide: true,
            nomark: true,
            onSelect: function (item) {
                selected = true;
                lampa.Select.close();
                lampa.Controller.toggle(controller);
                item.action();
            },
            onBack: function () {
                if (selected) return;
                if (onBack) onBack();
                else lampa.Controller.toggle(controller);
            }
        });
    }

    function showFilm(film, controller, onBack) {
        showPicker(film.title, film.streams.map(function (stream) {
            return {
                title: stream.title,
                subtitle: stream.subtitle + ' · ' + film.credit,
                action: function () { play(film.title, stream.url); }
            };
        }), controller, onBack);
    }

    function parseStreamUrl(value) {
        var raw = (typeof value === 'string' ? value : '').trim();
        if (!/^https?:\/\//i.test(raw) || /[\s\\<>"']/.test(raw)) return '';

        // An anchor also works on older TV browsers that lack the URL constructor.
        var url = document.createElement('a');
        url.href = raw;
        if (!url.hostname || raw.split('/')[2].indexOf('@') !== -1) return '';
        if (!/\.(mp4|webm|mkv|m3u8|mpd)$/i.test(url.pathname)) return '';
        return url.href;
    }

    function openStream(controller) {
        var cancelled = false;
        var keyboard = lampa.Input.edit({
            title: 'Прямая ссылка на видео',
            value: '',
            free: true,
            nosave: true,
            nomic: true
        }, function (value) {
            // Lampa returns the typed value on Enter and Back. Wait for the keyboard event.
            setTimeout(function () {
                lampa.Controller.toggle(controller);
                if (cancelled || !value) return;

                var url = parseStreamUrl(value);
                if (url) play('Свой поток', url);
                else lampa.Noty.show('Введите HTTP(S)-ссылку на MP4, WebM, MKV, M3U8 или MPD.');
            }, 0);
        });
        if (keyboard && keyboard.listener) {
            keyboard.listener.follow('back', function () { cancelled = true; });
        }
    }

    function showCatalog(controller) {
        function filmRow(film) {
            return {
                title: film.title + ' (' + film.year + ')',
                subtitle: film.credit,
                action: function () {
                    showFilm(film, controller, function () { showCatalog(controller); });
                }
            };
        }

        var items = [
            {
                title: 'FanFilm4K',
                subtitle: 'Фильмы, сериалы и мультфильмы · плеер сайта',
                action: function () { showFanfilm(controller); }
            },
            { title: 'Открытые короткометражки', separator: true }
        ].concat(films.map(filmRow));
        items.push({ title: 'Полнометражное кино', separator: true });
        items = items.concat(mosfilm.map(filmRow));
        if (lampa.Input && typeof lampa.Input.edit === 'function') {
            items.push({
                title: 'Открыть свой поток',
                subtitle: 'MP4, WebM, MKV, HLS или DASH',
                action: function () { openStream(controller); }
            });
        }
        showPicker(menuTitle, items, controller);
    }

    function findFilm(movie) {
        if (movie.first_air_date || movie.media_type === 'tv') return;

        var year = Number(String(movie.release_date || '').slice(0, 4));
        var titles = [movie.title, movie.original_title].map(function (title) {
            return typeof title === 'string' ? title.trim().toLowerCase() : '';
        });
        return films.concat(mosfilm).filter(function (candidate) {
            return candidate.year === year && titles.indexOf(candidate.title.toLowerCase()) !== -1;
        })[0];
    }

    function openCard(movie) {
        var film = findFilm(movie);
        if (film) showFilm(film, 'content');
        else lampa.Noty.show('У этого фильма больше нет источника в Открытом 4K.');
    }

    function addCardButton(event) {
        if (event.type !== 'complite' || !event.body || !event.data || !event.data.movie) return;
        var movie = event.data.movie;
        if (!findFilm(movie) || event.body.find('.open4k-card-button').length) return;

        var buttons = event.body.find('.buttons--container').first();
        if (!buttons.length) buttons = event.body.find('.full-start__buttons').first();
        if (!buttons.length) return;

        window.$('<div class="full-start__button selector open4k-card-button">' + icon + '<span>' +
            menuTitle + '</span></div>')
            .on('hover:enter', function () { (pagesHost ? pagesHost.runtime.openCard : openCard)(movie); })
            .appendTo(buttons);
    }

    function init() {
        var open = function () {
            (pagesHost ? pagesHost.runtime.showCatalog : showCatalog)(lampa.Controller.enabled().name || 'content');
        };

        if (lampa.Menu && typeof lampa.Menu.addButton === 'function') {
            lampa.Menu.addButton(icon, menuTitle, open);
        } else {
            window.$('<li class="menu__item selector"><div class="menu__ico">' + icon +
                '</div><div class="menu__text">' + menuTitle + '</div></li>')
                .on('hover:enter', open).appendTo('.menu .menu__list:first');
        }
        lampa.Listener.follow('full', function (event) {
            (pagesHost ? pagesHost.runtime.addCardButton : addCardButton)(event);
        });
        // The extension installer looks for a direct reference to the Lampa API.
        var storage = window.Lampa.Storage;
        if (pagesHost) pagesHost.start(storage, mirrorOrigin, mirrorStorageKey, readLanding);
        else {
            fanfilmMirror = mirrorOrigin(storage.get(mirrorStorageKey, ''));
            refreshFanfilm();
        }
    }

    if (pagesHost && !pagesHost.publish(document.currentScript, {
        showCatalog: showCatalog,
        addCardButton: addCardButton,
        openCard: openCard
    })) return;
    if (window.open4kPluginLoaded) return;
    window.open4kPluginLoaded = true;

    if (window.appready) init();
    else lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready') init();
    });
}());
