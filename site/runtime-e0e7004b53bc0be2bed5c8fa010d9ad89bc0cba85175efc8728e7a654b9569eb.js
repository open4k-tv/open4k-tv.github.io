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
    var aniLibertyApi = 'https://api.anilibria.app/api/v1';
    var archive = 'https://archive.org';
    var fanfilmMirror = '';
    var mirrorCheck = null;
    var mirrorFresh = false;
    var cardRequest = 0;

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

    function readResponse(url, timeout, read, done) {
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
        readResponse(mirrorPage + '?check=' + Date.now(), 3500, function (request) {
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

        readResponse(resolverUrl + '?check=' + Date.now(), 5500, function (request) {
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
        if (isSeries(movie)) return;

        var year = Number(String(movie.release_date || '').slice(0, 4));
        var titles = [movie.title, movie.original_title].map(function (title) {
            return typeof title === 'string' ? title.trim().toLowerCase() : '';
        });
        return films.concat(mosfilm).filter(function (candidate) {
            return candidate.year === year && titles.indexOf(candidate.title.toLowerCase()) !== -1;
        })[0];
    }

    function cardTitle(movie) {
        if (movie.media_type === 'person') return '';
        var titles = [movie.title, movie.name, movie.original_title, movie.original_name];
        for (var i = 0; i < titles.length; i++) {
            if (typeof titles[i] === 'string' && titles[i].trim()) return titles[i].trim();
        }
        return '';
    }

    function isSeries(movie) {
        return movie.media_type === 'tv' || !!(movie.first_air_date || movie.number_of_seasons);
    }

    function isAnimation(movie) {
        var genres = movie.genre_ids || movie.genres;
        return Array.isArray(genres) && genres.some(function (genre) {
            return Number(genre && typeof genre === 'object' ? genre.id : genre) === 16;
        });
    }

    function normalizeTitle(title) {
        if (typeof title !== 'string') return '';
        return title.toLowerCase().replace(/ё/g, 'е').replace(/[\s:;,.!?()\[\]"«»'’\-–—]+/g, ' ').trim();
    }

    function readJson(url, done) {
        readResponse(url, 4500, function (request) {
            return JSON.parse(request.responseText);
        }, done);
    }

    function animeRelease(movie, done) {
        var primary = cardTitle(movie);
        var original = movie.original_title || movie.original_name;
        var normalized = [normalizeTitle(primary), normalizeTitle(original)];
        var year = Number(String(movie.first_air_date || movie.release_date || '').slice(0, 4));
        function words(title) { return title.split(' ').sort().join(' '); }
        var unordered = year ? normalized.map(words) : [];
        var queries = [primary];
        if (normalized[1] && normalized[0] !== normalized[1]) queries.push(original.trim());

        function search() {
            if (!queries.length) {
                done(null);
                return;
            }
            readJson(aniLibertyApi + '/app/search/releases?query=' + encodeURIComponent(queries.shift()), function (results) {
                var matches = Array.isArray(results) ? results.filter(function (release) {
                    if (!release || !/^[1-9][0-9]{0,9}$/.test(release.id) || !release.name ||
                        release.is_blocked_by_geo || release.is_blocked_by_copyrights ||
                        (year && Number(release.year) !== year)) return false;
                    if (release.type && (release.type.value === 'MOVIE') === isSeries(movie)) return false;
                    return [release.name.main, release.name.english, release.name.alternative].some(function (name) {
                        var match = normalizeTitle(name);
                        return match && (normalized.indexOf(match) !== -1 || unordered.indexOf(words(match)) !== -1);
                    });
                }) : [];
                if (matches.length === 1) readJson(aniLibertyApi + '/anime/releases/' + matches[0].id, done);
                else search();
            });
        }
        search();
    }

    function animeStreams(episode) {
        return [1080, 720, 480].reduce(function (streams, quality) {
            var url = episode['hls_' + quality];
            if (typeof url === 'string' &&
                /^https:\/\/[a-z0-9-]+\.libria\.fun\/[a-z0-9_./%-]+\.m3u8(?:\?[^\s<>"#]*)?$/i.test(url)) {
                streams[String(quality) + 'p'] = url;
            }
            return streams;
        }, {});
    }

    function aniLibertySource(movie, done) {
        animeRelease(movie, function (release) {
            var rows = [];
            if (release && !release.is_blocked_by_geo && !release.is_blocked_by_copyrights && Array.isArray(release.episodes)) {
                release.episodes.forEach(function (episode) {
                    if (!episode || !isFinite(episode.ordinal) || Number(episode.ordinal) < 1) return;
                    var streams = animeStreams(episode);
                    var qualities = Object.keys(streams);
                    if (!qualities.length) return;
                    var title = 'Серия ' + Number(episode.ordinal);
                    rows.push({
                        title: title,
                        subtitle: qualities.join(' · '),
                        action: function () {
                            lampa.Player.play({
                                title: cardTitle(movie) + ' · ' + title,
                                url: streams['1080p'] || streams['720p'] || streams['480p'],
                                quality: streams
                            });
                        }
                    });
                });
            }
            done(rows.length ? {
                title: 'AniLiberty',
                subtitle: 'Русская озвучка · серий: ' + rows.length,
                action: function (back) { showPicker(cardTitle(movie), rows, 'content', back); }
            } : null);
        });
    }

    function archiveLicense(value) {
        return typeof value === 'string' &&
            /^https?:\/\/(?:www\.)?creativecommons\.org\/(?:publicdomain\/(?:mark|zero)\/1\.0|licenses\/by(?:-nc)?(?:-sa|-nd)?\/[0-9.]+)\/?$/i.test(value);
    }

    function playArchive(title, url) {
        var listener = lampa.Player.listener;
        var videoPlayer = lampa.PlayerVideo;
        if (listener && videoPlayer && typeof videoPlayer.video === 'function') {
            var timer = window.setTimeout(detach, 20000);
            listener.follow('start', prepare);
        }
        play(title, url);

        function detach() {
            window.clearTimeout(timer);
            listener.remove('start', prepare);
        }

        function prepare(item) {
            if (!item || item.url !== url) return;
            detach();
            var video = videoPlayer.video();
            if (!video || video.tagName !== 'VIDEO' || !video.hasAttribute('crossorigin')) return;

            // Archive downloads can redirect to servers that support ordinary video playback without CORS.
            var previous = video.getAttribute('crossorigin');
            video.removeAttribute('crossorigin');
            listener.follow('destroy', restore);

            function restore() {
                listener.remove('destroy', restore);
                video.setAttribute('crossorigin', previous);
            }
        }
    }

    function archiveFiles(item, id, runtime) {
        if (!item || !item.metadata || !archiveLicense(item.metadata.licenseurl) || !Array.isArray(item.files)) return [];
        return item.files.filter(function (file) {
            var duration = Number(file && file.length);
            return file && file.private !== true && file.private !== 'true' && file.private !== '1' &&
                typeof file.name === 'string' && /^[^/\\\x00-\x1f]+\.mp4$/i.test(file.name) &&
                (runtime ? Math.abs(duration - runtime) <= Math.min(600, runtime * 0.12) : duration >= 3000);
        }).map(function (file) {
            return {
                url: archive + '/download/' + id + '/' + encodeURIComponent(file.name),
                width: Number(file.width) || 0,
                height: Number(file.height) || 0
            };
        });
    }

    function archiveSource(movie, year, done) {
        var original = normalizeTitle(movie.original_title) || normalizeTitle(cardTitle(movie));
        var local = normalizeTitle(cardTitle(movie));
        var titles = original === local ? [local] : [original, local];
        var phrase = titles.map(function (title) { return 'title:"' + title.replace(/["\\]/g, ' ') + '"'; }).join(' OR ');
        var query = 'mediatype:movies AND (' + phrase + ') AND year:' + year + ' AND licenseurl:*';
        var url = archive + '/advancedsearch.php?q=' + encodeURIComponent(query) +
            '&output=json&rows=12&sort[]=downloads%20desc&fl[]=title&fl[]=year&fl[]=licenseurl&fl[]=identifier';
        readJson(url, function (result) {
            var docs = result && result.response && result.response.docs;
            var matching = Array.isArray(docs) ? docs.filter(function (doc) {
                var title = normalizeTitle(doc && doc.title);
                return doc && Number(doc.year) === year && /^\w[\w.-]{0,99}$/.test(doc.identifier) &&
                    archiveLicense(doc.licenseurl) && titles.some(function (candidate) {
                        return title === candidate || title === candidate + ' ' + year;
                    });
            }).slice(0, 3) : [];
            var pending = matching.length;
            if (!pending) {
                done(null);
                return;
            }

            var files = [];
            matching.forEach(function (doc) {
                readJson(archive + '/metadata/' + doc.identifier, function (item) {
                    files = files.concat(archiveFiles(item, doc.identifier, Number(movie.runtime) * 60));
                    if (--pending > 0) return;
                    files.sort(function (a, b) { return b.width * b.height - a.width * a.height; });
                    var seen = {};
                    var rows = files.filter(function (file) {
                        var resolution = file.width + '×' + file.height;
                        if (seen[resolution]) return false;
                        seen[resolution] = true;
                        return true;
                    }).slice(0, 5).map(function (file) {
                        var resolution = file.width && file.height ? file.width + '×' + file.height : '';
                        return {
                            title: resolution ? 'MP4 · ' + resolution : 'MP4',
                            subtitle: 'Internet Archive',
                            action: function () { playArchive(cardTitle(movie), file.url); }
                        };
                    });
                    done(rows.length ? {
                        title: 'Internet Archive',
                        subtitle: 'Полный фильм · ' + rows[0].title,
                        action: function (back) { showPicker(cardTitle(movie), rows, 'content', back); }
                    } : null);
                });
            });
        });
    }

    function showCardSources(movie, sources) {
        function show() { showPicker(cardTitle(movie), rows, 'content'); }
        var rows = sources.filter(Boolean).map(function (source) {
            return {
                title: source.title,
                subtitle: source.subtitle,
                action: function () { source.action(show); }
            };
        });
        rows.push({
            title: 'Открыть каталог FanFilm4K',
            subtitle: 'Найди фильм или сериал по названию на сайте',
            action: function () { openFanfilmPage(activeMirror() + '/'); }
        });
        show();
    }

    function openCard(movie) {
        var request = ++cardRequest;
        var film = findFilm(movie);
        if (film) {
            showFilm(film, 'content');
            return;
        }

        var year = Number(String(movie.release_date || '').slice(0, 4));
        var lookups = [];
        if (isAnimation(movie)) lookups.push(function (done) { aniLibertySource(movie, done); });
        if (!isSeries(movie) && year > 0) lookups.push(function (done) { archiveSource(movie, year, done); });
        if (!lookups.length) {
            showCardSources(movie, []);
            return;
        }

        var active = lampa.Activity && typeof lampa.Activity.active === 'function' ? lampa.Activity.active : null;
        var current = active && active();
        var results = [];
        var pending = lookups.length;
        lampa.Noty.show('Ищем доступные источники…');
        lookups.forEach(function (lookup, index) {
            lookup(function (result) {
                results[index] = result;
                if (--pending === 0 && request === cardRequest && (!active || active() === current)) {
                    showCardSources(movie, results);
                }
            });
        });
    }

    function addCardButton(event) {
        if (event.type !== 'complite' || !event.body || !event.data || !event.data.movie) return;
        var movie = event.data.movie;
        if (!cardTitle(movie) || event.body.find('.open4k-card-button').length) return;

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
