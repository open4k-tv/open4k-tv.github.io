(function (bundledVersion) {
    'use strict';

    if (!window.Lampa || window.open4kPages || window.open4kPluginLoaded) return;

    var installation = document.currentScript;
    var baseUrl = installationBase(installation && installation.src) || 'https://open4k-tv.github.io/';
    var version = bundledVersion;
    var pendingRuntime = null;
    var checking = false;
    var started = false;
    var afterRefresh = null;

    var host = window.open4kPages = {
        runtime: null,
        openCard: function (movie) {
            var activity = window.Lampa.Activity;
            var previous = activity && activity.active();
            afterRefresh = function () {
                if (!activity || activity.active() === previous) host.runtime.openCard(movie);
            };
            if (!pendingRuntime) refresh();
        },
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

    function openWhenReady() {
        if (checking || pendingRuntime || !afterRefresh) return;
        var callback = afterRefresh;
        afterRefresh = null;
        callback();
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
            openWhenReady();
        }

        var timeout = window.setTimeout(cleanup, 8000);
        script.onload = script.onerror = cleanup;
        script.src = baseUrl + 'runtime-' + nextVersion + '.js';
        document.head.appendChild(script);
    }

    function refresh() {
        if (checking) return;
        checking = true;

        function finish() { checking = false; openWhenReady(); }

        try {
            var request = new XMLHttpRequest();
            request.open('GET', baseUrl + 'release.json?check=' + Date.now(), true);
            request.timeout = 5000;
            request.onload = function () {
                var release;
                try { if (request.status === 200) release = JSON.parse(request.responseText); } catch (error) {}
                if (release && typeof release === 'object') loadRuntime(release.version);
                finish();
            };
            request.onerror = request.ontimeout = request.onabort = finish;
            request.send();
        } catch (error) {
            finish();
        }
    }
}('ff6e9a4ed26d1496ee8ff46998c62c76e85fa69badf8d4e92445f4531c7b8ce4'));

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
            '1/10/', 'Tears_of_Steel_in_4k_-_Official_Blender_Foundation_release.webm'),
        commonsFilm('Charge', 2022, 'Blender Studio', '4.0', '3840×1608', 'VP9 / Opus',
            '7/7a/', 'Charge_-_Blender_Open_Movie-full_movie.webm'),
        commonsFilm('Glass Half', 2015, 'Blender Foundation', '4.0', '3840×2160', 'VP9 / Opus',
            '0/02/', 'Glass_Half_-_Blender_Open_Movie-full_movie.webm'),
        commonsFilm('SINGULARITY', 2026, 'Blender Studio', '4.0', '3840×1608', 'AV1 / Opus',
            'f/f2/', 'SINGULARITY_-_Blender_Open_Movie-full_movie.webm')
    ];

    var classics = [
        archiveFeature('Шарада', 'Charade', 1963, 'charade-1963-4k', 'Charade (1963) 4K.mp4', '3840×2160'),
        archiveFeature('Ночь живых мертвецов', 'Night of the Living Dead', 1968, 'notld-4-k', 'NOTLD 4K.mp4', '2960×2160'),
        archiveFeature('Генерал', 'The General', 1926, 'the-general-1926-remux-2160p-dts-hd-ma-51-hevc',
            'The General (1926) - [REMUX-2160P][DTS-HD MA 5.1][HEVC].mkv', '3840×2160')
    ];

    function archiveFeature(title, original, year, id, file, resolution) {
        return { title: title, original: original, year: year, credit: 'Internet Archive',
            streams: [{ title: resolution, subtitle: file.split('.').pop().toUpperCase(),
                url: archive + '/download/' + id + '/' + encodeURIComponent(file) }] };
    }

    var vixCatalog, vixLoadedAt = 0, vixWaiting = [];

    function vixIndex(done) {
        if (vixCatalog && Date.now() - vixLoadedAt < 3600000) { done(vixCatalog); return; }
        vixWaiting.push(done);
        if (vixWaiting.length > 1) return;
        readResponse('https://open4k-tv.github.io/vix-catalog.json', 10000, function (response) {
            return JSON.parse(response.responseText);
        }, function (data) {
            if (data && Array.isArray(data.movie) && Array.isArray(data.tv)) {
                vixCatalog = data;
                vixLoadedAt = Date.now();
            }
            var waiting = vixWaiting;
            vixWaiting = [];
            waiting.forEach(function (callback) { callback(vixCatalog); });
        });
    }

    function indexedIds(movie, done) {
        var tmdb = Number(movie.tmdb_id || ((!movie.source || movie.source === 'tmdb') && movie.id));
        if (!tmdb) { done([]); return; }
        vixIndex(function (catalog) {
            var entries = catalog && catalog[isSeries(movie) ? 'tv' : 'movie'];
            for (var i = 0; entries && i < entries.length; i++) {
                if (entries[i][0] !== tmdb || !entries[i][1]) continue;
                var digits = String(entries[i][1]);
                while (digits.length < 7) digits = '0' + digits;
                done(collapsIds({imdb_id:'tt' + digits})); return;
            }
            done([]);
        });
    }

    function broadcasterSource(movie, done) {
        var original = movie.original_title || movie.original_name;
        var queries = [original, cardTitle(movie)].filter(function (value, index, all) {
            return value && all.indexOf(value) === index;
        });
        var series = isSeries(movie);
        function search() {
            if (!queries.length) { done(null); return; }
            var query = queries.shift(), name = normalizeTitle(query);
            var payload = { queries: [{ fields: ['title', 'topic'], query: query }], size: 50 };
            readResponse('https://mediathekviewweb.de/api/query', 5500, function (request) {
                return JSON.parse(request.responseText);
            }, function (body) {
                var results = body && body.result && body.result.results;
                var seen = {}, rows = [];
                (Array.isArray(results) ? results : []).forEach(function (item) {
                    var label = normalizeTitle(item.title), topic = normalizeTitle(item.topic);
                    if (label !== name && !(series && (topic === name || label.indexOf(name + ' ') === 0))) return;
                    if (item.duration < (series ? 300 : movie.runtime ? movie.runtime * 48 : 2400)) return;
                    if (!series && movie.runtime && item.duration > movie.runtime * 75) return;
                    var url = item.url_video_hd || item.url_video;
                    if (typeof url !== 'string' || !/^https:\/\/[a-z0-9.-]+\/(?:[^\s<>"]+)(?:\.mp4|\.m3u8)(?:\?[^\s<>"]*)?$/i.test(url) || seen[url]) return;
                    seen[url] = true;
                    rows.push({ title: String(item.title), subtitle: item.channel + ' · ' +
                        Math.round(item.duration / 60) + ' мин · Медиатека вещателя',
                        action: function () { play(item.title, url); } });
                });
                if (rows.length) done({ title: 'MediathekView', rows: rows });
                else search();
            }, JSON.stringify(payload));
        }
        search();
    }

    function commonsFilm(title, year, author, license, resolution, codecs, folder, filename) {
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
                }
            ]
        };
    }

    function play(title, url) {
        lampa.Player.play({ title: title, url: url, launch_player: 'lampa' });
    }

    function readResponse(url, timeout, read, done, body) {
        var request = new XMLHttpRequest();
        try {
            request.open(body ? 'POST' : 'GET', url, true);
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
            request.send(body || null);
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
        items = items.concat(classics.map(filmRow));
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
        return films.concat(classics).filter(function (candidate) {
            return candidate.year === year && (titles.indexOf(candidate.title.toLowerCase()) !== -1 ||
                (candidate.original && titles.indexOf(candidate.original.toLowerCase()) !== -1));
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

    function trackerSource(movie, tracker, done) {
        var labels = {rutor:'RuTor', kinozal:'Кинозал'};
        var original = movie.original_title || movie.original_name;
        var queries = [original, cardTitle(movie)].filter(function (value, index, all) {
            return value && all.indexOf(value) === index;
        });
        var titles = queries.map(normalizeTitle);
        var year = Number(String(movie.release_date || movie.first_air_date || '').slice(0,4));
        function search() {
            if (!queries.length || !lampa.Torrent || !lampa.Torrent.start) { done(null); return; }
            readJson('https://jacred.su/api/v1.0/torrents?search=' + encodeURIComponent(queries.shift()), function (items) {
                var seen = {};
                var releases = (Array.isArray(items) ? items : []).filter(function (item) {
                    if (!item || item.tracker !== tracker || !item.title) return false;
                    if (titles.indexOf(normalizeTitle(item.name)) < 0 && titles.indexOf(normalizeTitle(item.originalname)) < 0) return false;
                    if (!isSeries(movie) && year && Number(item.relased) !== year) return false;
                    if (!(Number(item.quality) >= 2160 || /\b(2160p?|4k|uhd)\b/i.test(item.title))) return false;
                    var hash = /^magnet:\?xt=urn:btih:([a-f\d]{40}|[a-z2-7]{32})(?:&|$)/i.exec(item.magnet);
                    if (!hash || seen[hash[1].toLowerCase()]) return false;
                    seen[hash[1].toLowerCase()] = true;
                    return true;
                }).sort(function (a,b) { return (Number(b.sid) || 0) - (Number(a.sid) || 0); });
                if (!releases.length) { search(); return; }
                done({title:labels[tracker], rows:releases.map(function (item) {
                    return {title:item.title, subtitle:[labels[tracker],item.sizeName,'Раздают: ' + (Number(item.sid) || 0)].filter(Boolean).join(' · '),
                        action:function () {
                            if (!lampa.Torserver || !lampa.Torserver.url || !lampa.Torserver.url()) {
                                lampa.Noty.show('Для просмотра раздач укажите TorrServer в настройках Lampa'); return;
                            }
                            lampa.Torrent.start({Title:item.title,title:item.title,MagnetUri:item.magnet,Size:Number(item.size)},movie);
                        }};
                })});
            });
        }
        search();
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

    function choosePlayback(title, media, hls, voiceIndex, onPlay) {
        var dash = media.dasha || media.dash;
        var validDash = typeof dash === 'string' &&
            /^https:\/\/(?:[a-z0-9-]+\.)*interkh\.com\/[a-z0-9_./%-]+\.mpd(?:\?[^\s<>"'#\\]*)?$/i.test(dash);
        var names = media.audio && media.audio.names;
        function launch(url) {
            if (onPlay) onPlay();
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
            if (voices[voiceIndex]) voices[voiceIndex].action();
            else showPicker('Озвучка · ' + title, voices, 'content');
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
                media: result,
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
                rows: rows,
                subtitle: 'Русская озвучка · серий: ' + rows.length,
                action: function (back) { showPicker(cardTitle(movie), rows, 'content', back); }
            } : null);
        });
    }

    function archiveLicense(value) {
        return typeof value === 'string' &&
            /^https?:\/\/(?:www\.)?creativecommons\.org\/(?:publicdomain\/(?:mark|zero)\/1\.0|licenses\/by(?:-nc)?(?:-sa|-nd)?\/[0-9.]+)\/?$/i.test(value);
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
                            action: function () { play(cardTitle(movie), file.url); }
                        };
                    });
                    done(rows.length ? {
                        title: 'Internet Archive',
                        rows: rows,
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

    function registerSettings() {
        var api = lampa.SettingsApi;
        if (!api) return;
        if (api.getComponent('open4k')) {
            if (!api.removeParams) return;
            api.removeParams('open4k');
        } else api.addComponent({ component: 'open4k', name: menuTitle, icon: icon });
        api.addParam({
            component: 'open4k',
            param: { name: 'open4k_default_source', type: 'select', default: 'auto', values: {
                auto: 'Автоматически', rutor:'RuTor', kinozal:'Кинозал', broadcast: 'MediathekView', collaps: 'Collaps', anime: 'AniLiberty',
                archive: 'Internet Archive', catalog: 'Подборка 4K'
            } },
            field: { name: 'Источник по умолчанию', description: 'Открывается при входе в карточку просмотра.' }
        });
    }

    function MovieScreen(options) {
        var self = this, $ = window.$, movie = options.movie || {};
        var names = { rutor:'RuTor', kinozal:'Кинозал', broadcast: 'MediathekView', collaps: 'Collaps', anime: 'AniLiberty', archive: 'Internet Archive', catalog: 'Подборка 4K' };
        var title = cardTitle(movie), original = movie.original_title || movie.original_name || '';
        var year = String(movie.release_date || movie.first_air_date || '').slice(0, 4);
        var film = findFilm(movie);
        var query = title, serial = 0, alive = true, last, loaded = {};
        var pref = lampa.Storage.get('open4k_default_source', 'auto');
        var order = film ? ['catalog','collaps'] : isAnimation(movie) ? ['anime','collaps'] : ['collaps'];
        if (lampa.Torrent && lampa.Torserver && lampa.Torserver.url && lampa.Torserver.url()) order.unshift('rutor','kinozal');
        if (pref === 'vix') { pref = 'auto'; lampa.Storage.set('open4k_default_source', pref); }
        order.push('broadcast');
        if (!isSeries(movie) && year) order.push('archive');
        if (!Object.prototype.hasOwnProperty.call(names, pref)) pref = 'auto';
        var source = pref === 'auto' ? order[0] : pref;
        var root = $('<div class="o4-view"></div>');
        var side = $('<aside class="o4-info"></aside>').appendTo(root);
        var main = $('<section class="o4-main"></section>').appendTo(root);
        var tools = $('<div class="o4-tools"></div>').appendTo(main);
        var list = $('<div class="o4-list"></div>').appendTo(main);
        var historyKey = 'open4k_recent_' + (isSeries(movie) ? 'tv' : 'film') + '_' + (movie.id || title + year);

        function picture(path, size) {
            if (!path || !lampa.Api || !lampa.Api.img) return '';
            return lampa.Api.img(path, size);
        }
        function tag(parent, cls, value) {
            return $('<div></div>').addClass(cls).text(value).appendTo(parent);
        }
        function control(parent, cls, label, action) {
            return tag(parent, 'selector ' + cls, label).on('hover:enter', action)
                .on('hover:focus', function () { last = this; this.scrollIntoView({block:'nearest'}); });
        }
        function focus() {
            if (!alive || lampa.Activity.active().activity !== self.activity) return;
            lampa.Controller.collectionSet(root);
            lampa.Controller.collectionFocus(last && $.contains(root[0],last) ? last : sourceButton[0], root);
        }
        function drawer(label, choices, pick) {
            lampa.Select.show({title:label, items:choices, onSelect:function (row) {
                lampa.Controller.toggle('content'); pick(row);
            }, onBack:function () { lampa.Controller.toggle('content'); }});
        }
        var sourceButton = control(tools, 'o4-chip', '', function () {
            drawer('Источник', Object.keys(names).map(function (key) {
                return { title:names[key], key:key, selected:key === source };
            }), function (row) { source = row.key; load(false); });
        });
        var queryButton = control(tools, 'o4-chip', '', function () {
            var choices = [{ title:'Указать название', edit:true }];
            if (lampa.Search) choices.push({ title:'Глобальный поиск', global:true });
            [title,original].forEach(function (value) {
                if (value && !choices.some(function (row) { return row.value === value; })) choices.push({title:value,value:value,selected:value === query});
            });
            function apply(value) {
                value = String(value || '').trim();
                if (!value) return;
                if (source === 'collaps' && value !== title && lampa.Search) {
                    lampa.Search.open({input:value}); return;
                }
                query = value; loaded = {}; load(false);
            }
            drawer('Уточнить поиск', choices, function (row) {
                if (row.global) lampa.Search.open({input:query});
                else if (row.edit) lampa.Input.edit({title:'Название',value:query,free:true}, apply);
                else apply(row.value);
            });
        });
        var poster = picture(movie.poster_path,'w342');
        var still = picture(movie.backdrop_path,'w500') || poster;
        if (poster) $('<img class="o4-poster" alt="">').attr('src',poster).appendTo(side);
        tag(side,'o4-meta',[year,(movie.production_countries || []).map(function (c) { return c.name; }).join(', '),
            Number(movie.vote_average) > 0 ? '★ ' + Number(movie.vote_average).toFixed(1) : ''].filter(Boolean).join(' · '));
        tag(side,'o4-name',title);
        tag(side,'o4-genres',(movie.genres || []).map(function (g) { return g.name; }).filter(Boolean).join(' · '));
        tag(side,'o4-summary',movie.overview || '');
        function remember(label) { lampa.Storage.set(historyKey, label); }
        function draw(rows) {
            list.empty();
            var recent = lampa.Storage.get(historyKey,'');
            tag(list,'o4-history',recent ? 'Последний выбор · ' + recent : 'Нет истории просмотра');
            rows.forEach(function (row) {
                var item = control(list,'o4-row','',function () { row.action(); });
                if (still) $('<img alt="">').attr('src',still).appendTo(item);
                var copy = $('<div class="o4-copy"></div>').appendTo(item);
                tag(copy,'o4-label',row.title);
                tag(copy,'o4-detail',[row.subtitle, movie.runtime ? movie.runtime + ' мин' : ''].filter(Boolean).join(' · '));
            });
            if (!rows.length) tag(list,'o4-empty','У источника нет видео для этой карточки. Выберите другой источник.');
            focus();
        }
        function rowsFor(found) {
            if (!found) return [];
            if (!found.media) return found.rows.map(function (row) {
                return {title:row.title,subtitle:row.subtitle,action:function () { remember(found.title + ' · ' + row.title); row.action(); }};
            });
            var media = found.media;
            if (!media.url) return collapsRows(movie, media, function () { draw(rowsFor(found)); });
            var voices = media.audio && media.audio.names || [];
            return (voices.length ? voices : ['Воспроизвести']).map(function (name,index) {
                return {title:String(name),subtitle:media.dash ? 'DASH / HLS · выбрать качество' : media.resolution || 'HLS',
                    action:function () { choosePlayback(title,media,media.url,index,function () { remember('Collaps · ' + name); }); }};
            });
        }
        function load(auto) {
            var id = ++serial, key = source;
            sourceButton.text('Источник · ' + names[key]);
            queryButton.text('Поиск · ' + query);
            list.empty(); tag(list,'o4-empty','Поиск видео…');
            function done(found) {
                if (!alive || id !== serial) return;
                loaded[key] = found || null;
                var rows = rowsFor(found);
                if (!rows.length && auto && order.indexOf(key) < order.length - 1) {
                    source = order[order.indexOf(key) + 1]; load(true);
                } else draw(rows);
            }
            if (Object.prototype.hasOwnProperty.call(loaded,key)) { done(loaded[key]); return; }
            var search = $.extend({},movie);
            if (query !== title) {
                search.title = search.name = query;
                search.original_title = search.original_name = query;
            }
            if (key === 'catalog') {
                var match = findFilm(search);
                done(match && {title:names[key],rows:match.streams.map(function (stream) {
                    return {title:stream.title,subtitle:stream.subtitle,action:function () { play(match.title,stream.url); }};
                })});
            } else if (key === 'rutor' || key === 'kinozal') trackerSource(search,key,done);
            else if (key === 'broadcast') broadcasterSource(search,done);
            else if (key === 'archive') {
                if (isSeries(movie) || !year) done(null); else archiveSource(search,Number(year),done);
            } else if (key === 'anime') aniLibertySource(search,done);
            else {
                var ids = collapsIds(movie);
                var tmdb = lampa.Api && lampa.Api.sources && lampa.Api.sources.tmdb;
                function resolve(ids) {
                    if (alive && id === serial) collapsSource(movie,ids,done);
                }
                function fallback() { indexedIds(movie,resolve); }
                if (!ids.length && movie.source === 'tmdb' && tmdb && tmdb.external_ids) {
                    tmdb.external_ids({id:movie.id,type:isSeries(movie)?'tv':'movie'},function (external) {
                        var externalIds = collapsIds(external || {});
                        if (externalIds.length) resolve(externalIds); else fallback();
                    },fallback);
                } else if (ids.length) resolve(ids); else fallback();
            }
        }
        this.create = function () {
            if (!$('#open4k-layout').length) $('<style id="open4k-layout"></style>').text(
                '.o4-view{display:flex;height:100%;padding:1.4em;box-sizing:border-box;gap:2em}.o4-info{width:26%;flex-shrink:0;overflow:hidden}.o4-poster{width:42%;border-radius:.5em}.o4-meta,.o4-detail,.o4-genres{opacity:.76;font-size:.88em}.o4-meta{margin:1em 0}.o4-name{font-size:1.85em;font-weight:700;line-height:1.1;margin:.5em 0}.o4-summary{margin-top:1.4em;line-height:1.45;opacity:.88}.o4-main{flex:1;min-width:0;display:flex;flex-direction:column}.o4-tools{display:flex;flex-wrap:wrap;gap:.65em;padding:.25em}.o4-chip,.o4-row{background:rgba(18,22,24,.76);border-radius:.5em;cursor:pointer}.o4-chip{padding:.8em 1em}.o4-list{overflow-y:auto;flex:1;padding:.3em}.o4-history,.o4-empty{padding:1em 0;opacity:.8}.o4-row{display:flex;align-items:center;min-height:4.7em;margin:.6em 0;overflow:hidden}.o4-row img{width:8em;height:4.7em;object-fit:cover}.o4-copy{padding:.65em 1em}.o4-label{font-size:1.24em}.o4-detail{margin-top:.35em}.o4-view .focus{outline:3px solid currentColor;outline-offset:-3px}'
            ).appendTo('head');
            this.activity.loader(false); this.activity.toggle(); load(pref === 'auto');
            return root;
        };
        this.start = function () {
            var controller = { toggle:focus,back:function () { lampa.Activity.backward(); } };
            ['up','down','left','right'].forEach(function (dir) { controller[dir] = function () { window.Navigator.move(dir); }; });
            lampa.Controller.add('content',controller); lampa.Controller.toggle('content');
        };
        this.render = function () { return root; };
        this.pause = this.stop = function () {};
        this.destroy = function () { alive = false; root.remove(); };
    }

    function openCard(movie) {
        if (lampa.Component && lampa.Activity && window.$) {
            lampa.Component.add('open4k_movie', MovieScreen);
            lampa.Activity.push({ component: 'open4k_movie', title: menuTitle, movie: movie });
            return;
        }
        var request = ++cardRequest;
        var film = findFilm(movie);
        if (film && film.credit !== 'Internet Archive') {
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

    function upgradeOpenMovie() {
        var activity = lampa.Activity;
        if (!activity || !activity.all || !activity.replace || !lampa.Component) return;
        if (lampa.Player && typeof lampa.Player.opened === 'function' && lampa.Player.opened()) return;
        var stack = activity.all();
        var screen = activity.active();
        if (!screen || screen.component !== 'open4k_sources' || !/ · Collaps$/.test(screen.title) ||
            !Array.isArray(screen.rows) || !screen.rows.some(function (row) { return row.title === 'Воспроизвести'; })) return;
        var previous = stack[stack.length - 2];
        if (!previous || previous.component !== 'full') return;
        var movie = previous.movie || previous.card;
        if (!movie || !movie.id) return;
        movie = window.$.extend({}, movie, { source: movie.source || previous.source,
            media_type: movie.media_type || previous.method });
        lampa.Component.add('open4k_movie', MovieScreen);
        activity.replace({ component: 'open4k_movie', title: menuTitle, movie: movie }, true);
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
            .on('hover:enter', function () {
                if (pagesHost && pagesHost.openCard) pagesHost.openCard(movie);
                else (pagesHost ? pagesHost.runtime.openCard : openCard)(movie);
            })
            .appendTo(buttons);
    }

    function init() {
        registerSettings();
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
    if (window.open4kPluginLoaded) {
        if (window.appready) { upgradeOpenMovie(); registerSettings(); }
        return;
    }
    window.open4kPluginLoaded = true;

    if (window.appready) init();
    else lampa.Listener.follow('app', function (event) {
        if (event.type === 'ready') init();
    });
}());
