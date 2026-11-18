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
        if (pagesHost) pagesHost.start(lampa.Storage, mirrorOrigin, mirrorStorageKey, readLanding);
        else {
            fanfilmMirror = mirrorOrigin(lampa.Storage.get(mirrorStorageKey, ''));
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
