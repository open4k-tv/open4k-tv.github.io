(function () {
    'use strict';

    var lampa = window.Lampa;
    var pagesHost = window.open4kPages;
    if (!lampa || (window.open4kPluginLoaded && !pagesHost)) return;

    var collapsMirrors = ['https://api.nextembed.ws/embed/', 'https://api.kinogram.best/embed/'];
    var cardRequest = 0;

    var menuTitle = 'Открытое 4K';
    var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>';
    var names = {collaps:'Collaps',lordfilm:'LordFilm',hdvb:'HDVB'};

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

    function play(title, url) {
        lampa.Player.play({ title: title, url: url, launch_player: 'lampa' });
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
        var items = [{title:'Найти фильм в Lampa',action:function () {
            if (lampa.Search) lampa.Search.open({input:''});
            else lampa.Noty.show('Откройте карточку фильма в Lampa');
        }}];
        if (lampa.Input && lampa.Input.edit) items.push({title:'Открыть свой поток',action:function () { openStream(controller); }});
        showPicker(menuTitle,items,controller);
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

    function resolveMovieIds(movie, resolve) {
        var ids = collapsIds(movie);
        if (ids.length) { resolve(ids); return; }
        var tmdb = lampa.Api && lampa.Api.sources && lampa.Api.sources.tmdb;
        function fallback() { indexedIds(movie,resolve); }
        if ((!movie.source || movie.source === 'tmdb') && movie.id && tmdb && tmdb.external_ids) {
            tmdb.external_ids({id:movie.id,type:isSeries(movie)?'tv':'movie'},function (external) {
                if (external && external.imdb_id) resolve(collapsIds(external)); else fallback();
            },fallback);
        } else fallback();
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

    function collapsPlayback(title, media, url, quality) {
        var video = { title: title, url: url, launch_player: 'lampa' };
        if (quality) video.quality = quality;
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
        function launch(url,quality) {
            if (onPlay) onPlay();
            if (!Array.isArray(names) || !names.length || !lampa.PlayerVideo || !lampa.Player.listener) {
                collapsPlayback(title, media, url,quality);
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
                    collapsPlayback(title, media, url,quality);
                } };
            });
            if (voices[voiceIndex]) voices[voiceIndex].action();
            else collapsPlayback(title, media, url, quality);
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
            var quality = {};
            quality['HLS' + (media.resolution ? ' · ' + media.resolution : '')] = hls;
            quality['DASH · ' + resolution] = dash;
            launch(hls,quality);
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

    function mp4Size(url,done) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET',url,true);
        xhr.responseType = 'arraybuffer';
        xhr.timeout = 7000;
        xhr.setRequestHeader('Range','bytes=0-8191');
        xhr.onreadystatechange = function () { if (xhr.readyState === 2 && xhr.status !== 206) xhr.abort(); };
        xhr.onprogress = function (e) { if (e.loaded > 8192) xhr.abort(); };
        xhr.onerror = xhr.ontimeout = xhr.onabort = function () { done(null); };
        xhr.onload = function () {
            if (xhr.status !== 206 || !xhr.response) { done(null); return; }
            var view = new DataView(xhr.response);
            for (var i = 4; i + 8 < view.byteLength; i++) {
                if (view.getUint32(i) !== 0x746b6864) continue;
                var length = view.getUint32(i-4), end = i-4+length;
                if (length < 92 || end > view.byteLength) continue;
                var w = view.getUint32(end-8) >>> 16, h = view.getUint32(end-4) >>> 16;
                if (w && h) { done({w:w,h:h}); return; }
            }
            done(null);
        };
        xhr.send();
    }

    function onlineSource(key,movie,done,current,navigate) {
        var base = 'https://z01.online/lite/' + key, title = cardTitle(movie);
        var query = {id:movie.tmdb_id || movie.id, title:title, original_title:movie.original_title || movie.original_name,
            year:String(movie.release_date || movie.first_air_date || '').slice(0,4), serial:isSeries(movie)?1:0,
            imdb_id:movie.imdb_id || (movie.external_ids || {}).imdb_id, kinopoisk_id:movie.kinopoisk_id || movie.kp_id,rjson:true};
        function read(url,callback) {
            readResponse(url,10000,function (r) { return JSON.parse(r.responseText); },function (data) {
                if (current()) callback(data);
            });
        }
        function apiUrl(url) {
            if (typeof url !== 'string' || url.indexOf(base) !== 0 || !/^[/?]/.test(url.slice(base.length))) return '';
            return url.replace(/([?&])rjson=[^&]*(&|$)/,'$1') + (url.indexOf('?') < 0 ? '?' : '&') + 'rjson=true';
        }
        function mediaUrl(url) { return typeof url === 'string' && /^https:\/\/z01\.online\/proxy\/[^\s<>"]+$/.test(url); }
        function unavailable() { lampa.Noty.show('Источник не вернул доступный вариант Full HD или 4K'); }
        function qualities(item,label,vast,valid,ready) {
            if (!valid()) return;
            if (!item || item.method !== 'play' || !mediaUrl(item.url)) { unavailable(); return; }
            var variants = [], multiAudio = false;
            function add(w,h,url) {
                if (w && h && mediaUrl(url)) variants.push({w:w,h:h,url:url});
            }
            function display() {
                if (!valid()) return;
                variants.sort(function (a,b) { return b.w-a.w || b.h-a.h; });
                var best = variants[0];
                if (!best || (!isSeries(movie) && best.w < 1920 && best.h < 1080)) { unavailable(); return; }
                var quality = {};
                variants.forEach(function (v) {
                    var size = v.w+'×'+v.h;
                    if (!quality[size]) quality[size] = v.url;
                });
                ready({title:title+' · '+label,url:multiAudio ? item.url : best.url,quality:multiAudio ? undefined : quality,launch_player:'lampa',vast:item.vast || vast});
            }
            var files = Object.keys(item.quality || {}).filter(function (k) {
                return /^\d{3,4}p$/.test(k) && mediaUrl(item.quality[k]);
            });
            if (files.length) {
                var remaining = files.length;
                files.forEach(function (k) {
                    var url = item.quality[k];
                    mp4Size(url,function (s) { if (s) add(s.w,s.h,url); if (!--remaining) display(); });
                });
            } else readResponse(item.url,8000,function (r) {
                multiAudio = /#EXT-X-MEDIA:.*TYPE=AUDIO/.test(r.responseText);
                var lines = r.responseText.split(/\r?\n/);
                lines.forEach(function (line,i) {
                    var size = /^#EXT-X-STREAM-INF:.*\bRESOLUTION=(\d+)x(\d+)/.exec(line);
                    if (size && lines[i+1]) add(+size[1],+size[2],new URL(lines[i+1],r.responseURL || item.url).href);
                });
            },display);
        }
        function playable(item) {
            return item && (item.method === 'play' ? mediaUrl(item.url) : item.method === 'call' && apiUrl(item.url));
        }
        function labelOf(item) { return item.translate || item.name || item.title || title; }
        function playVoices(choices,initial,caption) {
            var active = initial, revision = 0, work;
            function mark(index) {
                (work && work.voiceovers || []).forEach(function (track,i) { track.selected = track.enabled = i === index; });
            }
            function select(index) {
                var ticket = ++revision, choice = choices[index];
                if (work) {
                    mark(active);
                    if (index === active) return;
                }
                function valid() {
                    return current() && ticket === revision && (!work || (lampa.Player.opened() && lampa.Player.playdata() === work));
                }
                function resolve(item) {
                    qualities(item,caption || choice.label,choice.item.vast,valid,function (video) {
                        if (!work) {
                            if (choices.length > 1) video.voiceovers = choices.map(function (v,i) {
                                return {name:String(v.label).replace(/[<>]/g,''),ignore_translate:true,selected:i === initial,
                                    onSelect:function () { select(i); }};
                            });
                            work = video;
                            lampa.Player.play(video);
                            return;
                        }
                        var size = Object.keys(work.quality || {}).filter(function (k) { return work.quality[k] === work.url; })[0];
                        var url = video.quality && video.quality[size] || video.url;
                        work.quality = video.quality;
                        lampa.PlayerPanel.quality(video.quality || {},url);
                        active = index;
                        mark(active);
                        lampa.PlayerPanel.listener.send('quality',{url:url,name:video.quality && video.quality[size] ? size : ''});
                    });
                }
                if (choice.item.method === 'play') resolve(choice.item);
                else read(apiUrl(choice.item.url),resolve);
            }
            select(initial);
        }
        function episodeRows(page,complete) {
            var groups = {}, voices = (page.voice || []).filter(function (v) { return apiUrl(v.url); });
            function collect(data,label,rank) {
                (data && data.data || []).forEach(function (ep) {
                    if (!playable(ep) || !/^\d+$/.test(ep.s) || !/^\d+$/.test(ep.e)) return;
                    var id = ep.s+'x'+ep.e;
                    var group = groups[id] || (groups[id] = {season:+ep.s,episode:+ep.e,voices:[]});
                    if (!group.voices.some(function (v) { return v.item.url === ep.url; }))
                        group.voices.push({item:ep,label:label || ep.translate || 'Основная',rank:rank});
                });
            }
            var selected = voices.filter(function (v) { return v.active; })[0];
            collect(page,selected && selected.name,0);
            var pending = voices.filter(function (v) { return !v.active; }), remaining = pending.length, next = 0;
            function finish() {
                complete(Object.keys(groups).map(function (id) { return groups[id]; }).sort(function (a,b) {
                    return a.season-b.season || a.episode-b.episode;
                }).map(function (g) {
                    var caption = 'Сезон '+g.season+' · Серия '+g.episode;
                    g.voices.sort(function (a,b) { return a.rank-b.rank; });
                    return {title:'Серия '+g.episode,subtitle:'S'+g.season+':E'+g.episode+' · '+names[key],
                        action:function () { playVoices(g.voices,0,caption); }};
                }));
            }
            function worker() {
                if (next >= pending.length) return;
                var i = next++, v = pending[i];
                read(apiUrl(v.url),function (data) {
                    collect(data,v.name,i+1);
                    if (!--remaining) finish(); else worker();
                });
            }
            if (!remaining) finish();
            else for (var i=0;i<Math.min(3,pending.length);i++) worker();
        }
        function resultFor(data,cb) {
            if (isSeries(movie) && data && data.type === 'movie') { cb(null); return; }
            if (data && data.type === 'season' && Array.isArray(data.data)) {
                var seasons = data.data.filter(function (s) { return apiUrl(s.url); }).map(function (s) {
                    return {label:labelOf(s),load:function (loaded) {
                        read(apiUrl(s.url),function (page) { episodeRows(page || {},loaded); });
                    }};
                });
                if (seasons.length) { cb({title:names[key],seasons:seasons}); return; }
            }
            if (data && data.type === 'episode') {
                episodeRows(data,function (rows) { cb({title:names[key],rows:rows}); }); return;
            }
            var rows = rowsFor(data);
            cb(rows.length ? {title:names[key],rows:rows} : null);
        }
        function rowsFor(data) {
            var choices = (data && data.data || []).filter(playable).map(function (item) { return {item:item,label:labelOf(item)}; });
            return ((data && Array.isArray(data.data)) ? data.data : []).filter(function (item) {
                return item && (item.method === 'play' ? mediaUrl(item.url) : apiUrl(item.url));
            }).map(function (item) {
                var label = item.translate || item.name || item.title || title;
                return {title:label,subtitle:[names[key],item.year].filter(Boolean).join(' · '),action:function () {
                    if (playable(item)) {
                        var index = choices.map(function (c) { return c.item; }).indexOf(item);
                        playVoices(choices,index); return;
                    }
                    read(apiUrl(item.url),function (child) {
                        resultFor(child,function (found) {
                            if (found && navigate) navigate(found);
                            else if (found && found.rows) showPicker(names[key],found.rows,'content');
                            else if (isSeries(movie)) lampa.Noty.show('Источник не вернул серии для этой карточки');
                            else unavailable();
                        });
                    });
                }};
            });
        }
        var params = Object.keys(query).filter(function (k) { return query[k] || query[k] === 0; })
            .map(function (k) { return k+'='+encodeURIComponent(query[k]); });
        read(base+'?'+params.join('&'),function (data) {
            resultFor(data,done);
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
                auto:'Автоматически', collaps:'Collaps', lordfilm:'LordFilm', hdvb:'HDVB'
            } },
            field: { name: 'Источник по умолчанию', description: 'Открывается при входе в карточку просмотра.' }
        });
    }

    function MovieScreen(options) {
        var self = this, $ = window.$, movie = options.movie || {};
        var title = cardTitle(movie), original = movie.original_title || movie.original_name || '';
        var year = String(movie.release_date || movie.first_air_date || '').slice(0, 4);
        var query = title, serial = 0, alive = true, last;
        var pref = lampa.Storage.get('open4k_default_source', 'auto');
        var order = ['collaps','lordfilm','hdvb'];
        if (pref !== 'auto' && !Object.prototype.hasOwnProperty.call(names,pref)) {
            pref = 'collaps';
            lampa.Storage.set('open4k_default_source',pref);
        }
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
        var seasons = [], selectedSeason, seasonRevision = 0;
        var seasonButton = control(tools,'o4-chip','Сезон',function () {
            drawer('Сезон',seasons.map(function (s) { return {title:s.label,season:s,selected:s === selectedSeason}; }),
                function (row) { showSeason(row.season); });
        }).hide();
        function showSeason(season) {
            var ticket = ++seasonRevision;
            selectedSeason = season;
            seasonButton.text(season.label).show();
            list.empty(); tag(list,'o4-empty','Загрузка серий…');
            season.load(function (rows) { if (alive && ticket === seasonRevision) draw(rows); });
        }
        var queryButton = control(tools, 'o4-chip', '', function () {
            var choices = [{ title:'Указать название', edit:true }];
            if (lampa.Search) choices.push({ title:'Глобальный поиск', global:true });
            [title,original].forEach(function (value) {
                if (value && !choices.some(function (row) { return row.value === value; })) choices.push({title:value,value:value,selected:value === query});
            });
            function apply(value) {
                value = String(value || '').trim();
                if (!value) return;
                if (value !== title && lampa.Search) {
                    lampa.Search.open({input:value}); return;
                }
                query = value; load(false);
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
            if (!rows.length) {
                tag(list,'o4-empty','У источника нет доступного видео для этой карточки.');
            }
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
            ++seasonRevision; seasons = []; seasonButton.hide();
            sourceButton.text('Источник · ' + names[key]);
            queryButton.text('Поиск · ' + query);
            list.empty(); tag(list,'o4-empty','Поиск видео…');
            function done(found) {
                if (!alive || id !== serial) return;
                seasons = found && found.seasons || [];
                if (found && found.media && found.media.seasons) seasons = found.media.seasons.map(function (s) {
                    return {label:'Сезон '+s.number,load:function (loaded) {
                        loaded(s.episodes.slice().sort(function (a,b) { return +a.episode - +b.episode; }).map(function (ep) {
                            var label = 'Серия '+ep.episode, code = 'S'+s.number+':E'+ep.episode;
                            return {title:ep.name || label,subtitle:code+' · Collaps',action:function () {
                                choosePlayback(title+' · '+code,ep,ep.hls,undefined,function () { remember('Collaps · '+code); });
                            }};
                        }));
                    }};
                });
                if (seasons.length) { showSeason(seasons[0]); return; }
                var rows = rowsFor(found);
                if (!rows.length && auto && order.indexOf(key) < order.length - 1) {
                    source = order[order.indexOf(key) + 1]; load(true);
                } else draw(rows);
            }
            if (key === 'collaps') {
                resolveMovieIds(movie,function (ids) { if (alive && id === serial) collapsSource(movie,ids,done); });
            } else onlineSource(key,movie,done,function () { return alive && id === serial; },done);
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
        function current() { return request === cardRequest; }
        resolveMovieIds(movie,function (ids) {
            collapsSource(movie,ids,function (found) {
                if (!current()) return;
                function alternatives() {
                    var rows = ['lordfilm','hdvb'].map(function (key) {
                        return {title:names[key],action:function () {
                            onlineSource(key,movie,function (result) {
                                if (result) showPicker(names[key],result.rows,'content');
                                else lampa.Noty.show('Для этой карточки нет доступных источников');
                            },current);
                        }};
                    });
                    showPicker(cardTitle(movie),rows,'content');
                }
                if (found) found.action(null,isSeries(movie) ? null : alternatives);
                else if (movie.release_date) alternatives();
                else lampa.Noty.show('Для этой карточки нет доступных источников');
            });
        });
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
