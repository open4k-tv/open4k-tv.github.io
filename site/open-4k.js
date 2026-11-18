(function (bundledVersion) {
    'use strict';

    if (!window.Lampa || window.open4kPages || window.open4kPluginLoaded) return;

    var installation = document.currentScript;
    var baseUrl = installationBase(installation && installation.src) || 'https://open4k-tv.github.io/';
    var version = bundledVersion;
    var pendingRuntime = null;
    var checking = false;
    var started = false;

    var host = window.open4kPages = {
        runtime: null,
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
        start: function () {
            if (started) return;
            started = true;

            refresh();
            window.setInterval(refresh, 2 * 60 * 1000);
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) refresh();
            });
        }
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

    function refresh() {
        if (checking) return;
        checking = true;

        function finish() { checking = false; }

        try {
            var request = new XMLHttpRequest();
            request.open('GET', baseUrl + 'release.json?check=' + Date.now(), true);
            request.timeout = 5000;
            request.onload = function () {
                finish();
                var release;
                try { if (request.status === 200) release = JSON.parse(request.responseText); } catch (error) {}
                if (release && typeof release === 'object') loadRuntime(release.version);
            };
            request.onerror = request.ontimeout = request.onabort = finish;
            request.send();
        } catch (error) {
            finish();
        }
    }
}('82ad10917825d1c93372b01b4587b1a8eceddf1eb1748519184c40e5c83214a5'));
(function () {
    'use strict';

    var lampa = window.Lampa;
    var pagesHost = window.open4kPages;
    if (!lampa || (window.open4kPluginLoaded && !pagesHost)) return;

    var aniLibertyApi = 'https://api.anilibria.app/api/v1';
    var archive = 'https://archive.org';
    var collapsMirrors = ['https://api.nextembed.ws/embed/', 'https://api.kinogram.best/embed/'];
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
                { title: 'Akamai · до 3840×2160', subtitle: 'DASH · H.264', url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd' },
                { title: 'Full HD', subtitle: 'MP4 · H.264 · 30 кадров/с', url: bunny + '1080p_30fps_normal.mp4' }
            ]
        },
        {
            title: 'Sintel',
            year: 2010,
            credit: 'Blender Foundation · Shaka',
            streams: [{ title: 'Shaka · до 3840×1636', subtitle: 'DASH · H.264', url: 'https://storage.googleapis.com/shaka-demo-assets/sintel/dash.mpd' }]
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
            title: 'Воспроизвести',
            subtitle: 'Качество выбирает YouTube',
            url: 'https://www.youtube.com/watch?v=' + id
        };
    }

    function play(title, url) {
        lampa.Player.play({ title: title, url: url, launch_player: 'lampa' });
    }

    function readResponse(url, timeout, read, done) {
        var request = new XMLHttpRequest();
        try {
            request.open('GET', url, true);
            request.timeout = timeout;
            request.onload = function () {
                var result = '';
                try {
                    if (request.status >= 200 && request.status < 300) result = read(request);
                } catch (error) {
                    // Invalid provider responses count as an unavailable source.
                }
                done(result);
            };
            request.onerror = request.ontimeout = request.onabort = function () { done(''); };
            request.send();
        } catch (error) {
            done('');
        }
    }

    function showPicker(title, items, controller, onBack) {
        if (controller === 'content' && lampa.Component && lampa.Activity && window.Navigator) {
            if (!window.Lampa.Component.get('open4k_sources')) {
                lampa.Component.add('open4k_sources', function (options) {
                    var root = window.$('<div class="scroll open4k-sources"></div>').css({
                        display: 'block', height: '100%', overflowY: 'auto', padding: '1.5em', boxSizing: 'border-box'
                    });
                    var last;
                    this.create = function () {
                        (options.rows || []).forEach(function (row) {
                            var button = window.$('<div class="selector settings-param"></div>').css({
                                width: '100%', maxWidth: '42em', marginBottom: '0.45em', boxSizing: 'border-box'
                            }).appendTo(root);
                            window.$('<div class="settings-param__name"></div>').text(row.title).appendTo(button);
                            if (row.subtitle) window.$('<div class="settings-param__descr"></div>').text(row.subtitle).appendTo(button);
                            button.on('hover:focus', function () { last = this; this.scrollIntoView({block: 'nearest'}); });
                            button.on('hover:enter', function () { if (row.action) row.action(); });
                        });
                        this.activity.loader(false);
                        this.activity.toggle();
                        return root;
                    };
                    this.start = function () {
                        lampa.Controller.add('content', {
                            toggle: function () {
                                lampa.Controller.collectionSet(root);
                                lampa.Controller.collectionFocus(last || false, root);
                            },
                            up: function () { window.Navigator.move('up'); },
                            down: function () { window.Navigator.move('down'); },
                            back: function () { lampa.Activity.backward(); }
                        });
                        lampa.Controller.toggle('content');
                    };
                    this.render = function () { return root; };
                    this.pause = this.stop = function () {};
                    this.destroy = function () { root.remove(); };
                });
            }
            lampa.Activity.push({ component: 'open4k_sources', title: title, rows: items });
            return;
        }
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

        var items = [{ title: 'Открытые короткометражки', separator: true }].concat(films.map(filmRow));
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

    function collapsIds(movie) {
        var imdb = movie.imdb_id || (movie.external_ids && movie.external_ids.imdb_id);
        var kp = movie.kinopoisk_id || movie.kp_id;
        var ids = [];
        if (/^tt[0-9]{7,12}$/.test(imdb)) ids.push('imdb/' + imdb);
        if (/^[1-9][0-9]{0,9}$/.test(kp)) ids.push('kp/' + kp);
        return ids;
    }

    function collapsHls(value) {
        if (typeof value === 'string' &&
            /^https:\/\/(?:[a-z0-9-]+\.)*interkh\.com\/[a-z0-9_./%-]+\.m3u8(?:\?[^\s<>"'#\\]*)?$/i.test(value)) {
            return value;
        }
        return '';
    }

    function collapsPlayback(title, media, url) {
        var video = { title: title, url: url, launch_player: 'lampa' };
        if (media.audio && Array.isArray(media.audio.names)) {
            video.translate = { tracks: media.audio.names.map(function (name) {
                return { language: typeof name === 'string' ? name.replace(/[<>]/g, '').slice(0, 120) : '' };
            }) };
        }
        lampa.Player.play(video);
    }

    function choosePlayback(title, media, hls) {
        var dash = media.dasha || media.dash;
        var validDash = typeof dash === 'string' &&
            /^https:\/\/(?:[a-z0-9-]+\.)*interkh\.com\/[a-z0-9_./%-]+\.mpd(?:\?[^\s<>"'#\\]*)?$/i.test(dash);
        var names = media.audio && media.audio.names;
        function launch(url) {
            if (!Array.isArray(names) || !names.length || !lampa.PlayerVideo || !lampa.Player.listener) {
                collapsPlayback(title, media, url);
                return;
            }
            var events = lampa.PlayerVideo.listener;
            var voices = names.map(function (name, index) {
                return { title: String(name).replace(/[<>]/g, ''), action: function () {
                    function clear() {
                        events.remove('tracks', select);
                        lampa.Player.listener.remove('destroy', clear);
                    }
                    function select(event) {
                        if (!event.tracks || !event.tracks[index]) return;
                        clear();
                        event.tracks[index].enabled = true;
                        event.tracks[index].selected = true;
                    }
                    events.follow('tracks', select);
                    lampa.Player.listener.follow('destroy', clear);
                    collapsPlayback(title, media, url);
                } };
            });
            showPicker('Озвучка · ' + title, voices, 'content');
        }
        if (!validDash) { launch(hls); return; }
        readResponse(dash, 4000, function (req) {
            var best = 0, label = '';
            (req.responseText.match(/<Representation\b[^>]*>/gi) || []).forEach(function (tag) {
                var w = /\bwidth="(\d+)"/.exec(tag), h = /\bheight="(\d+)"/.exec(tag);
                if (w && h && Number(w[1]) > best) {
                    best = Number(w[1]);
                    label = w[1] + '×' + h[1];
                }
            });
            return label;
        }, function (resolution) {
            if (!resolution) { launch(hls); return; }
            showPicker('Качество · ' + title, [
                { title: 'DASH · до ' + resolution, action: function () { launch(dash); } },
                { title: 'HLS' + (media.resolution ? ' · до ' + media.resolution : ''), action: function () { launch(hls); } }
            ], 'content');
        });
    }

    function collapsResult(html, movie) {
        // Read the published player configuration as data. The surrounding code belongs to the provider.
        var start = /\bmakePlayer\(\s*\{/.exec(html);
        if (!start) return null;
        var config = html.slice(start.index + start[0].length).split('</script>')[0];
        if (/^\s*blocked:\s*true\b/m.test(config)) return null;

        if (!isSeries(movie)) {
            var source = /^\s*source:\s*\{([\s\S]*?)^\s*\},?\s*$/m.exec(config);
            if (!source) return null;
            var hls = /^\s*hls:\s*"([^"\r\n]+)"/m.exec(source[1]);
            var url = hls && collapsHls(hls[1]);
            if (!url) return null;
            var audio = /^\s*audio:\s*(\{[^\r\n]+\}),?\s*$/m.exec(source[1]);
            var dash = /^\s*dasha:\s*"([^"\r\n]+)"/m.exec(source[1]);
            return { url: url, dash: dash && dash[1], audio: audio && JSON.parse(audio[1]) };
        }

        var seasons = /^\s*seasons:\s*(\[[^\r\n]*\])\s*[,}]?\s*$/m.exec(config);
        if (!seasons) return null;
        var rows = JSON.parse(seasons[1]).map(function (season) {
            if (!season || season.blocked || !Array.isArray(season.episodes) ||
                !/^[0-9]{1,3}$/.test(season.season)) return null;
            var episodes = season.episodes.filter(function (episode) {
                return episode && !episode.blocked && /^[1-9][0-9]{0,3}$/.test(episode.episode) && collapsHls(episode.hls);
            });
            if (!episodes.length) return null;
            return { number: Number(season.season), episodes: episodes };
        }).filter(Boolean).sort(function (a, b) { return a.number - b.number; });
        return rows.length ? { seasons: rows } : null;
    }

    function collapsRows(movie, result, back) {
        var title = cardTitle(movie);
        if (result.url) {
            return [{
                title: 'Воспроизвести',
                subtitle: result.dash ? 'Выбрать качество и озвучку' : result.resolution || 'HLS',
                action: function () { choosePlayback(title, result, result.url); }
            }];
        }
        return result.seasons.map(function (season) {
            var name = 'Сезон ' + season.number;
            return {
                title: name,
                subtitle: 'Серий: ' + season.episodes.length,
                action: function () {
                    var episodes = season.episodes.map(function (episode) {
                        var label = 'Серия ' + Number(episode.episode);
                        return {
                            title: label,
                            action: function () {
                                choosePlayback(title + ' · ' + name + ' · ' + label, episode, episode.hls);
                            }
                        };
                    });
                    showPicker(name + ' · ' + title, episodes, 'content', back);
                }
            };
        });
    }

    function collapsSource(movie, ids, done) {
        var urls = [];
        ids.forEach(function (id) {
            collapsMirrors.forEach(function (mirror) { urls.push(mirror + id); });
        });
        function next() {
            if (!urls.length) {
                done(null);
                return;
            }
            readResponse(urls.shift(), 4000, function (request) {
                return collapsResult(request.responseText, movie);
            }, function (result) {
                if (!result) next();
                else if (result.url) {
                    readResponse(result.url, 4000, function (request) {
                        var manifest = request.responseText;
                        return /^\s*#EXTM3U\b/.test(manifest) ? manifest : '';
                    }, function (manifest) {
                        if (!manifest) next();
                        else {
                            var widest = 0;
                            manifest.replace(/\bRESOLUTION=(\d+)x(\d+)/g, function (match, width, height) {
                                if (Number(width) > widest) {
                                    widest = Number(width);
                                    result.resolution = width + '×' + height;
                                }
                                return match;
                            });
                            ready(result);
                        }
                    });
                } else ready(result);
            });
        }
        function ready(result) {
            done({
                title: 'Collaps',
                subtitle: result.resolution || 'Онлайн-видео',
                action: function (back, otherSources) {
                    var title = cardTitle(movie) + ' · Collaps';
                    function show() { showPicker(title, rows, 'content', back); }
                    var rows = collapsRows(movie, result, show);
                    if (otherSources) rows.push({ title: 'Другие источники', action: otherSources });
                    show();
                }
            });
        }
        next();
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
                                quality: streams,
                                launch_player: 'lampa'
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
        var avPlay = lampa.Platform && lampa.Platform.is('tizen') &&
            lampa.Storage.field && lampa.Storage.field('player') === 'tizen';
        if (avPlay || !lampa.Modal || typeof lampa.Modal.open !== 'function') {
            play(title, url);
            return;
        }

        // Archive downloads may redirect to a media server without CORS.
        var video = document.createElement('video');
        video.title = title;
        video.controls = true;
        video.autoplay = true;
        video.setAttribute('playsinline', '');
        video.style.cssText = 'display:block;width:100%;height:62vh;background:#000';
        video.addEventListener('error', function () {
            if (video.hasAttribute('src')) lampa.Noty.show('Не удалось открыть этот файл Internet Archive');
        });
        video.src = url;

        function close() {
            video.pause();
            video.removeAttribute('src');
            video.load();
            lampa.Modal.close();
            lampa.Controller.toggle('content');
        }

        lampa.Modal.open({
            title: 'Internet Archive',
            html: window.$(video),
            size: 'large',
            buttons_position: 'outside',
            buttons: [{ name: 'Закрыть', onSelect: close }],
            onBack: close
        });
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
        if (!sources.length) {
            lampa.Noty.show('Для этой карточки нет доступных источников');
            return;
        }
        function show() { showPicker(cardTitle(movie), rows, 'content'); }
        var rows = sources.map(function (source) {
            return {
                title: source.title,
                subtitle: source.subtitle,
                action: function () { source.action(show); }
            };
        });
        show();
    }

    function alternativeSources(movie, done) {
        var year = Number(String(movie.release_date || '').slice(0, 4));
        var lookups = [];
        if (isAnimation(movie)) lookups.push(function (next) { aniLibertySource(movie, next); });
        if (!isSeries(movie) && year > 0) lookups.push(function (next) { archiveSource(movie, year, next); });
        var results = [];
        if (!lookups.length) {
            done(results);
            return;
        }
        var first = results.length;
        var pending = lookups.length;
        lampa.Noty.show('Ищем доступные источники…');
        lookups.forEach(function (lookup, index) {
            lookup(function (result) {
                results[first + index] = result;
                if (--pending === 0) done(results.filter(Boolean));
            });
        });
    }

    function openCard(movie) {
        var request = ++cardRequest;
        var film = findFilm(movie);
        if (film) {
            showFilm(film, "content");
            return;
        }

        var activity = lampa.Activity && typeof lampa.Activity.active === 'function' ? lampa.Activity : null;
        var current = activity && activity.active();
        var cachedAlternatives;
        function isCurrent() {
            return request === cardRequest && (!activity || activity.active() === current || (activity.active() || {}).component === "open4k_sources");
        }
        function getAlternatives(done) {
            if (cachedAlternatives) done(cachedAlternatives);
            else alternativeSources(movie, function (sources) {
                cachedAlternatives = sources;
                done(sources);
            });
        }
        function preferred(source) {
            var canSearchAlternatives = isAnimation(movie) || (!isSeries(movie) && movie.release_date);
            source.action(null, canSearchAlternatives ? function () { alternatives(source); } : null);
        }
        function alternatives(primary) {
            getAlternatives(function (sources) {
                if (!isCurrent()) return;
                if (primary && !sources.length) {
                    preferred(primary);
                    lampa.Noty.show('Для этой карточки нет других источников');
                } else showCardSources(movie, primary ? sources.concat(primary) : sources);
            });
        }
        function findOnline(ids) {
            if (!isCurrent()) return;
            if (ids.length) lampa.Noty.show('Ищем доступные источники…');
            collapsSource(movie, ids, function (source) {
                if (!isCurrent()) return;
                if (source) {
                    preferred(source);
                } else {
                    alternatives(null);
                }
            });
        }

        if (isAnimation(movie)) {
            getAlternatives(function (sources) {
                if (!isCurrent()) return;
                if (sources.some(function (source) { return source.title === 'AniLiberty'; })) {
                    collapsSource(movie, collapsIds(movie), function (online) {
                        if (isCurrent()) showCardSources(movie, online ? sources.concat(online) : sources);
                    });
                } else findOnline(collapsIds(movie));
            });
            return;
        }
        var ids = collapsIds(movie);
        var tmdb = lampa.Api && lampa.Api.sources && lampa.Api.sources.tmdb;
        if (!ids.length && movie.source === 'tmdb' && /^[1-9][0-9]*$/.test(movie.id) &&
            tmdb && typeof tmdb.external_ids === 'function') {
            tmdb.external_ids({ type: isSeries(movie) ? 'tv' : 'movie', id: movie.id }, function (external) {
                findOnline(collapsIds(external || {}));
            }, function () { findOnline([]); });
        } else findOnline(ids);
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
        if (pagesHost) pagesHost.start();
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
