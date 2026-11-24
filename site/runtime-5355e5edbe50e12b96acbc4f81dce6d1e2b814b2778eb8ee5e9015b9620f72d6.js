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
    var names = {collaps:'Collaps',lordfilm:'LordFilm',hdvb:'HDVB',cdnvideohub:'VideoHUB',
        http4khdhub:'4KHDHub (тест)',httpCineDoze:'CineDoze (тест)'};
    function isTestCatalog(key) { return key === 'http4khdhub' || key === 'httpCineDoze'; }

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

    function startContentNavigation(focus,rightFromList,stepRow) {
        var nav = window.Navigator;
        function move(direction,edge) {
            if (edge && !nav.canmove(direction)) lampa.Controller.toggle(edge);
            else nav.move(direction);
        }
        lampa.Controller.add('content',{
            toggle:focus,
            up:function () { if (!stepRow || !stepRow(-1)) move('up','head'); },
            left:function () { move('left','menu'); },
            down:function () { if (!stepRow || !stepRow(1)) move('down'); },
            right:function () { if (!rightFromList || !rightFromList()) move('right'); },
            back:function () { lampa.Activity.backward(); }
        });
        lampa.Controller.toggle('content');
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
                        startContentNavigation(function () {
                            lampa.Controller.collectionSet(root);
                            lampa.Controller.collectionFocus(last || false, root);
                        });
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
        return movie.media_type === 'tv' || !!(movie.first_air_date || movie.number_of_seasons || (movie.seasons || []).length);
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

    function qualityTier(w,h) {
        return w >= 3840 ? 2160 : w >= 2560 ? 1440 : w === 1920 ? 1080 : w === 1280 ? 720 : Number(h) || 0;
    }
    function qualityLabel(tier) { return tier === 2160 ? '4K' : tier ? tier+'p' : ''; }
    function withQuality(name,tier) { return tier ? name+' · '+qualityLabel(tier) : name; }
    function checkAll(items,check,done) {
        var remaining = items.length, next = 0;
        if (!remaining) { done(); return; }
        function worker() {
            if (next >= items.length) return;
            check(items[next++],function () { if (!--remaining) done(); else worker(); });
        }
        for (var i=0;i<Math.min(2,items.length);i++) worker();
    }
    function historyKeyFor(movie) {
        return 'open4k_watched_'+(isSeries(movie) ? 'tv_' : 'film_')+
            (movie.id || movie.imdb_id || movie.kp_id || cardTitle(movie)+'_'+(movie.release_date || movie.first_air_date || ''));
    }
    function timelineFor(movie,season,episode) {
        if (!lampa.Timeline || !lampa.Utils || !lampa.Utils.hash || (isSeries(movie) && episode == null)) return null;
        var key = historyKeyFor(movie);
        if (episode != null) key += '_s'+season+'_e'+episode;
        var link = lampa.Timeline.link && lampa.Timeline.link(movie,season,episode);
        return lampa.Timeline.view(lampa.Utils.hash(key),link);
    }
    function startWatching(video,movie,season,episode,transition) {
        var timeline = timelineFor(movie,season,episode);
        if (timeline) {
            video.card = movie;
            video.timeline = timeline;
            var save = timeline.handler;
            timeline.handler = function (percent,time,duration) {
                if (time > 0 && duration > 0) lampa.Storage.set(historyKeyFor(movie),{season:season,episode:episode});
                save(percent,time,duration);
            };
        }
        if (episode != null) { video.season = season; video.episode = episode; }
        if (transition) return transition.ready(video);
        lampa.Player.play(video);
        return video;
    }
    function playSeason(rows,selected) {
        var player = lampa.Player, active, activeIndex;
        function makeEntry(row,index) {
            var entry = {season:row.season,episode:row.episode,title:'S'+row.season+' · E'+row.episode+' — '+row.title};
            entry.url = function (next) {
                var previous = active;
                function current() { return player.opened() && player.playdata() === previous; }
                row.action({
                    current:current,
                    failed:function () {
                        if (current()) { player.close(); lampa.Noty.show('Не удалось загрузить серию'); }
                    },
                    ready:function (video) {
                        if (!current()) return;
                        playlist[activeIndex] = makeEntry(rows[activeIndex],activeIndex);
                        Object.assign(entry,video);
                        active = entry;
                        activeIndex = index;
                        next();
                        return entry;
                    }
                });
            };
            return entry;
        }
        var playlist = rows.map(makeEntry);
        selected.action({ready:function (video) {
            activeIndex = rows.indexOf(selected);
            playlist[activeIndex] = video;
            active = video;
            player.play(video);
            if (player.playlist) player.playlist(playlist);
            return video;
        }});
    }
    function collapsPlayback(title, media, url, quality,movie,season,episode,transition) {
        var video = { title: title, url: url, launch_player: 'lampa' };
        if (quality) video.quality = quality;
        if (media.audio && Array.isArray(media.audio.names)) {
            video.translate = { tracks: media.audio.names.map(function (name) {
                return { language: withQuality(typeof name === 'string' ? name.replace(/[<>]/g, '').slice(0, 120) : '',media.maxQuality) };
            }) };
        }
        startWatching(video,movie,season,episode,transition);
    }

    function collapsDash(media,done) {
        var dash = media.dasha || media.dash;
        var validDash = typeof dash === 'string' &&
            /^https:\/\/(?:[a-z0-9-]+\.)*interkh\.com\/[a-z0-9_./%-]+\.mpd(?:\?[^\s<>"'#\\]*)?$/i.test(dash);
        if (!validDash || media.dashResolution) { done(media.dashResolution); return; }
        readResponse(dash,4000,function (req) {
            var best = 0, label = '';
            (req.responseText.match(/<Representation\b[^>]*>/gi) || []).forEach(function (tag) {
                var w = /\bwidth="(\d+)"/.exec(tag), h = /\bheight="(\d+)"/.exec(tag);
                if (w && h && +w[1] > best) { best = +w[1]; label = w[1]+'×'+h[1]; }
            });
            return label;
        },function (resolution) {
            if (resolution) {
                media.dashResolution = resolution;
                var size = resolution.split('×');
                media.maxQuality = Math.max(media.maxQuality || 0,qualityTier(+size[0],+size[1]));
            }
            done(resolution);
        });
    }
    function choosePlayback(title, media, hls, voiceIndex,movie,season,episode,transition) {
        var names = media.audio && media.audio.names;
        function launch(url,quality) {
            if (!Array.isArray(names) || !names.length || !lampa.PlayerVideo || !lampa.Player.listener) {
                collapsPlayback(title, media, url,quality,movie,season,episode,transition);
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
                    collapsPlayback(title, media, url,quality,movie,season,episode,transition);
                } };
            });
            if (voices[voiceIndex]) voices[voiceIndex].action();
            else collapsPlayback(title, media, url, quality,movie,season,episode,transition);
        }
        collapsDash(media,function (resolution) {
            if (!resolution) { launch(hls); return; }
            var quality = {};
            quality['HLS' + (media.resolution ? ' · ' + media.resolution : '')] = hls;
            quality['DASH · ' + resolution] = media.dasha || media.dash;
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
                action: function () { choosePlayback(title, result, result.url,undefined,movie); }
            }];
        }
        return result.seasons.map(function (season) {
            var name = 'Сезон ' + season.number;
            return {
                title: name,
                subtitle: 'Серий: ' + season.episodes.length,
                action: function () {
                    var episodes = season.episodes.slice().sort(function (a,b) { return a.episode-b.episode; }).map(function (episode) {
                        var label = 'Серия ' + Number(episode.episode);
                        return {
                            title: label,
                            season:+season.number,episode:+episode.episode,
                            action: function (transition) {
                                choosePlayback(title + ' · ' + name + ' · ' + label, episode, episode.hls,undefined,movie,+season.number,+episode.episode,transition);
                            }
                        };
                    });
                    showPicker(name + ' · ' + title, episodes.map(function (row) {
                        return {title:row.title,action:function () { playSeason(episodes,row); }};
                    }), 'content', back);
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
                        return /^\s*#EXTM3U\b/.test(manifest) ? {responseText:manifest,responseURL:request.responseURL || result.url} : null;
                    }, function (manifest) {
                        if (!manifest) next();
                        else {
                            result.masterResponse = manifest;
                            var widest = 0;
                            manifest.responseText.replace(/\bRESOLUTION=(\d+)x(\d+)/g, function (match, width, height) {
                                if (Number(width) > widest) {
                                    widest = Number(width);
                                    result.resolution = width + '×' + height;
                                    result.maxQuality = qualityTier(+width,+height);
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

    function catalogQuery(movie) {
        var title = cardTitle(movie);
        var query = {id:movie.tmdb_id || movie.id, title:title, original_title:movie.original_title || movie.original_name,
            year:String(movie.release_date || movie.first_air_date || '').slice(0,4), serial:isSeries(movie)?1:0,
            imdb_id:movie.imdb_id || (movie.external_ids || {}).imdb_id, kinopoisk_id:movie.kinopoisk_id || movie.kp_id,rjson:true};
        return query;
    }
    function queryString(query) {
        return '?' + Object.keys(query).filter(function (k) { return query[k] || query[k] === 0; })
            .map(function (k) { return k+'='+encodeURIComponent(query[k]); }).join('&');
    }
    function anyAvailable(items,check,done,current) {
        var index = 0;
        function next(ok) {
            if (!current()) return;
            if (ok || index === items.length) done(!!ok);
            else check(items[index++],next);
        }
        next(false);
    }
    function segmentAvailable(url,done) {
        var xhr = new XMLHttpRequest(), finished = false;
        function finish(ok) {
            if (finished) return;
            finished = true;
            xhr.abort();
            done(ok);
        }
        xhr.open('GET',url,true);
        xhr.timeout = 5000;
        xhr.responseType = 'arraybuffer';
        xhr.setRequestHeader('Range','bytes=0-1023');
        xhr.onprogress = function (e) {
            if (xhr.status === 200 && e.loaded) finish(/^(video\/|audio\/|application\/octet-stream)/i.test(xhr.getResponseHeader('Content-Type') || ''));
        };
        xhr.onload = function () {
            var bytes = new Uint8Array(xhr.response || []);
            var mime = xhr.getResponseHeader('Content-Type') || '';
            finish((xhr.status === 206 || xhr.status === 200) && bytes.length > 0 &&
                (/^(video\/|audio\/|application\/octet-stream)/i.test(mime) || bytes[0] === 0x47 || bytes.length > 8 && bytes[4] === 0x66 && bytes[5] === 0x74));
        };
        xhr.onerror = xhr.ontimeout = function () { finish(false); };
        xhr.send();
    }
    function checkPlaylist(url,done,current,depth,master) {
        function parse(r) {
            var lines = r.responseText.trim().split(/\r?\n/);
            if (lines[0] !== '#EXTM3U') return null;
            var base = r.responseURL || url;
            function address(value) {
                var resolved = new URL(value,base);
                return resolved.protocol === 'https:' ? resolved.href : '';
            }
            var streams = [];
            for (var i=0;i<lines.length-1;i++) {
                if (/^#EXT-X-STREAM-INF:/.test(lines[i]) && lines[i+1] && lines[i+1][0] !== '#') {
                    var size = /\bRESOLUTION=(\d+)x(\d+)/.exec(lines[i]);
                    var childUrl = address(lines[i+1]);
                    if (childUrl) streams.push({url:childUrl,tier:size ? qualityTier(+size[1],+size[2]) : 0});
                }
                if (/^#EXTINF:/.test(lines[i])) {
                    var segment = lines.slice(i+1).find(function (line) { return line && line[0] !== '#'; });
                    var seconds = lines.indexOf('#EXT-X-ENDLIST') >= 0 ? lines.reduce(function (sum,line) {
                        return line.indexOf('#EXTINF:') === 0 ? sum + parseFloat(line.slice(8)) : sum;
                    },0) : 0;
                    return segment && {segment:address(segment),minutes:isFinite(seconds) ? Math.round(seconds/60) : 0};
                }
            }
            return {streams:streams.sort(function (a,b) { return b.tier-a.tier; })};
        }
        function inspect(playlist) {
            if (!current()) return;
            if (playlist && playlist.segment) segmentAvailable(playlist.segment,function (ok) { done(ok,0,playlist.minutes); });
            else if (playlist && playlist.streams && !depth) {
                var tier = 0, minutes = 0;
                anyAvailable(playlist.streams,function (child,next) {
                    checkPlaylist(child.url,function (ok,unused,duration) {
                        if (ok) { tier = child.tier; minutes = duration; }
                        next(ok);
                    },current,1);
                },function (ok) { done(ok,tier,minutes); },current);
            }
            else done(false);
        }
        if (master) {
            var parsed;
            try { parsed = parse(master); } catch (error) { parsed = null; }
            inspect(parsed);
        }
        else readResponse(url,6000,parse,inspect);
    }
    var catalogCache = new Map(), catalogPending = new Map();
    function readCatalog(url,done) {
        var cached = catalogCache.get(url);
        if (cached && cached.until > Date.now()) { done(cached.data); return; }
        if (catalogPending.has(url)) { catalogPending.get(url).push(done); return; }
        catalogPending.set(url,[done]);
        readResponse(url,10000,function (r) { return JSON.parse(r.responseText); },function (data) {
            if (data && (data.method === 'play' || Array.isArray(data.data) && data.data.length)) {
                catalogCache.delete(url);
                if (catalogCache.size >= 128) catalogCache.delete(catalogCache.keys().next().value);
                catalogCache.set(url,{data:data,until:Date.now()+30000});
            }
            var callbacks = catalogPending.get(url);
            catalogPending.delete(url);
            callbacks.forEach(function (fn) { fn(data); });
        });
    }
    var checkedMedia = new Map(), checkingMedia = new Map(), manifestCache = new Map();
    function onlineSource(key,movie,done,current,navigate,sourceName,verify,quick,screenOpen) {
        var base = 'https://z01.online/lite/' + key;
        var title = cardTitle(movie), query = catalogQuery(movie);
        sourceName = sourceName || names[key] || key;
        var ratings = Object.create(null), peak = 0, playRequest = 0;
        function read(url,callback) {
            readCatalog(url,function (data) {
                if (current()) callback(data);
            });
        }
        function apiUrl(url) {
            if (typeof url !== 'string' || url.indexOf(base) !== 0 || !/^[/?]/.test(url.slice(base.length))) return '';
            return url.replace(/([?&])rjson=[^&]*(&|$)/,'$1') + (url.indexOf('?') < 0 ? '?' : '&') + 'rjson=true';
        }
        function mediaUrl(url) {
            if (typeof url !== 'string') return false;
            return /^https:\/\/z01\.online\/proxy\/[^\s<>"]+$/.test(url);
        }
        function unavailable() { lampa.Noty.show('Источник не вернул доступное видео'); }
        function qualities(item,label,vast,valid,ready,failed,limit) {
            if (!valid()) return;
            if (!item || item.method !== 'play' || !mediaUrl(item.url)) { (failed || unavailable)(); return; }
            var variants = [], multiAudio = false;
            function add(w,h,url,probeUrl) {
                if (w && h && mediaUrl(url))
                    variants.push({w:w,h:h,url:url,probeUrl:probeUrl || url});
            }
            function deliver(list,audio) {
                if (!valid()) return;
                var usable = limit ? list.filter(function (v) { return qualityTier(v.w,v.h) <= limit; }) : list;
                var best = usable[0];
                if (!best) { (failed || unavailable)(); return; }
                var quality = {};
                usable.forEach(function (v) {
                    var size = qualityTier(v.w,v.h)+'p';
                    if (!quality[size]) quality[size] = v.url;
                });
                ready({title:title+' · '+label,url:audio ? hlsUrl(item.url) : best.url,quality:audio ? undefined : quality,launch_player:'lampa',vast:item.vast || vast},usable);
            }
            var manifestKey = key+'|'+item.url, entry = manifestCache.get(manifestKey);
            if (entry && entry.waiters) { entry.waiters.push(deliver); return; }
            if (entry && entry.until > Date.now()) { deliver(entry.list,entry.audio); return; }
            entry = {waiters:[deliver]};
            if (manifestCache.size >= 256) manifestCache.delete(manifestCache.keys().next().value);
            manifestCache.set(manifestKey,entry);
            function display() {
                variants.sort(function (a,b) { return b.w-a.w || b.h-a.h; });
                var waiters = entry.waiters;
                entry.waiters = null; entry.list = variants; entry.audio = multiAudio;
                entry.until = variants.length ? Date.now()+30000 : 0;
                waiters.forEach(function (fn) { fn(variants,multiAudio); });
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
                var lines = r.responseText.split(/\r?\n/);
                multiAudio = lines.some(function (line) {
                    return line.indexOf('#EXT-X-MEDIA:') === 0 && /\bTYPE=AUDIO\b/.test(line) && /\bURI="/.test(line);
                });
                lines.forEach(function (line,i) {
                    var size = /^#EXT-X-STREAM-INF:.*\bRESOLUTION=(\d+)x(\d+)/.exec(line);
                    if (size && lines[i+1]) {
                        var variant = new URL(lines[i+1],r.responseURL || item.url).href;
                        if (/^https:\/\//.test(variant)) add(+size[1],+size[2],hlsUrl(variant),variant);
                    }
                });
            },display);
        }
        function hlsUrl(url) {
            // Opaque proxy paths need a format hint for Lampa's HLS engine. Fragments stay on the device.
            return url.indexOf('.m3u8') >= 0 ? url : url.split('#')[0]+'#stream.m3u8';
        }
        function playable(item) {
            return item && (item.method === 'play' ? mediaUrl(item.url) : item.method === 'call' && apiUrl(item.url));
        }
        function labelOf(item) { return item.translate || item.name || item.title || title; }
        var duration = 0;
        function checkItem(item,cb,valid) {
            valid = valid || current;
            if (!valid()) return;
            if (ratings[item.url]) { cb(true); return; }
            var id = key+'|'+item.url;
            function receive(result) {
                if (!valid()) return;
                if (result) {
                    ratings[item.url] = result.tier;
                    peak = Math.max(peak,result.tier);
                    if (result.minutes) duration = result.minutes;
                }
                cb(!!result);
            }
            var cached = checkedMedia.get(id);
            if (cached && cached.until > Date.now()) { receive(cached); return; }
            if (checkingMedia.has(id)) { checkingMedia.get(id).push(receive); return; }
            checkingMedia.set(id,[receive]);
            function finish(result) {
                if (result) {
                    result.until = Date.now()+30000;
                    if (checkedMedia.size >= 256) checkedMedia.delete(checkedMedia.keys().next().value);
                    checkedMedia.set(id,result);
                }
                var callbacks = checkingMedia.get(id);
                checkingMedia.delete(id);
                callbacks.forEach(function (fn) { fn(result); });
            }
            function pendingProbe() { return true; }
            function check(media) {
                qualities(media,'',null,pendingProbe,function (video,variants) {
                    var tier = qualityTier(variants[0].w,variants[0].h), minutes = 0;
                    function rated(ok) {
                        finish(ok ? {tier:tier,minutes:minutes} : null);
                    }
                    if (video.url.indexOf('.m3u8') >= 0) anyAvailable(variants,function (v,next) {
                        tier = qualityTier(v.w,v.h);
                        checkPlaylist(v.probeUrl,function (ok,unused,value) { minutes = value; next(ok); },pendingProbe);
                    },rated,pendingProbe);
                    else rated(true);
                },function () { finish(null); });
            }
            if (item.method === 'play') check(item);
            else readCatalog(apiUrl(item.url),check);
        }
        function playVoices(choices,initial,caption,enrichTracks,transition) {
            var active = initial, revision = 0, work, request = ++playRequest;
            function tracks() {
                return choices.map(function (v,i) {
                    return {get name() { return withQuality(String(v.label).replace(/[<>]/g,''),ratings[v.item.url]); },ignore_translate:true,selected:i === active,
                        onSelect:function () { select(i); }};
                });
            }
            function refreshTracks() {
                if (!work || !current() || !lampa.Player.playdata || lampa.Player.playdata() !== work || choices.length < 2) return;
                work.voiceovers = tracks();
                if (lampa.PlayerPanel && lampa.PlayerPanel.setTracks) lampa.PlayerPanel.setTracks(work.voiceovers);
            }
            function rateTracks(list) {
                checkAll(list.filter(function (v) { return !ratings[v.item.url]; }),function (v,next) {
                    checkItem(v.item,function () { refreshTracks(); next(); });
                },function () {});
            }
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
                    return current() && request === playRequest && ticket === revision && (work ? lampa.Player.opened() && lampa.Player.playdata() === work : !transition || !transition.current || transition.current());
                }
                function resolve(item) {
                    qualities(item,caption || choice.label,choice.item.vast,valid,function (video) {
                        if (!work) {
                            if (choices.length > 1) video.voiceovers = tracks();
                            work = startWatching(video,movie,caption ? +choice.item.s : undefined,caption ? +choice.item.e : undefined,transition);
                            if (enrichTracks && choices.length > 1) rateTracks(choices);
                            return;
                        }
                        var size = Object.keys(work.quality || {}).filter(function (k) { return work.quality[k] === work.url; })[0];
                        var url = video.quality && video.quality[size] || video.url;
                        work.quality = video.quality;
                        lampa.PlayerPanel.quality(video.quality || {},url);
                        active = index;
                        mark(active);
                        lampa.PlayerPanel.listener.send('quality',{url:url,name:video.quality && video.quality[size] ? size : ''});
                    },!work && transition && transition.failed,ratings[choice.item.url]);
                }
                if (choice.item.method === 'play') resolve(choice.item);
                else read(apiUrl(choice.item.url),resolve);
            }
            select(initial);
            return function (incoming) {
                var added = incoming.filter(function (v) { return !choices.some(function (c) { return c.item.url === v.item.url; }); });
                if (!added.length) return;
                choices = choices.concat(added);
                refreshTracks();
                if (work) rateTracks(added);
            };
        }
        function episodeRows(page,complete,stillHere) {
            var groups = {}, voices = (page.voice || []).filter(function (v) { return apiUrl(v.url); });
            function collect(data,label,rank) {
                (data && data.data || []).forEach(function (ep) {
                    if (!playable(ep) || !/^\d+$/.test(ep.s) || !/^\d+$/.test(ep.e)) return;
                    var id = ep.s+'x'+ep.e;
                    var group = groups[id] || (groups[id] = {season:+ep.s,episode:+ep.e,voices:[]});
                    group.name = group.name || ep.episode_name || ep.name || ep.title;
                    group.overview = group.overview || ep.overview || ep.description;
                    group.still = group.still || ep.still_path;
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
                    return {season:g.season,episode:g.episode,title:g.name || 'Серия '+g.episode,overview:g.overview,still:g.still,subtitle:sourceName,
                        action:function (transition) {
                            if (!current() || (stillHere && !stillHere())) return;
                            g.append = playVoices(g.voices.slice(),0,caption,true,transition);
                        }};
                }));
            }
            function worker() {
                if (next >= pending.length) return;
                var i = next++, v = pending[i];
                read(apiUrl(v.url),function (data) {
                    collect(data,v.name,i+1);
                    Object.keys(groups).forEach(function (id) { var g = groups[id]; if (g.append) g.append(g.voices); });
                    if (!--remaining) finish(); else worker();
                });
            }
            if (!remaining) finish();
            else {
                if (stillHere && Object.keys(groups).length) finish();
                for (var i=0;i<Math.min(3,pending.length);i++) worker();
            }
        }
        function resultFor(data,cb) {
            if (verify && data && data.type === 'similar') {
                var matches = (data.data || []).filter(function (row) {
                    return apiUrl(row.url) && query.year && String(row.year) === query.year &&
                        [title,query.original_title].some(function (name) { return name && String(row.title).trim().toLowerCase() === name.trim().toLowerCase(); });
                });
                if (matches.length !== 1) { cb(null); return; }
                read(apiUrl(matches[0].url),function (child) {
                    if (child && child.type !== 'similar') resultFor(child,cb); else cb(null);
                });
                return;
            }
            if (data && (data.rch || data.accsdb)) {
                cb({title:sourceName,rows:[],notice:data.rch ? 'Сервер требует соединение RCH для этого источника.' : 'Сервер требует авторизацию для этого источника.'});
                return;
            }
            if (data && (isSeries(movie) && data.type === 'movie' || !isSeries(movie) && /^(season|episode)$/.test(data.type))) { cb(null); return; }
            if (data && data.type === 'season' && Array.isArray(data.data)) {
                var seasonPages = Object.create(null);
                var seasons = data.data.filter(function (s) { return apiUrl(s.url); }).map(function (s) {
                    var number = s.s != null ? s.s : (/[?&]s=(\d+)/.exec(s.url) || /\b(\d+)\b/.exec(labelOf(s)) || [])[1];
                    return {number:Number(number),label:labelOf(s),load:function (loaded,stillHere) {
                        if (seasonPages[s.url]) { episodeRows(seasonPages[s.url],loaded,stillHere); return; }
                        read(apiUrl(s.url),function (page) { episodeRows(page || {},loaded,stillHere); });
                    }};
                });
                if (seasons.length) {
                    if (!verify || quick) {
                        var series = {title:sourceName,seasons:seasons,quality:function () { return peak; }};
                        series.probeQuality = function (update) {
                            var first = data.data.find(function (s) { return apiUrl(s.url); });
                            readCatalog(apiUrl(first.url),function (page) { probeEpisodeQuality(page,update); });
                        };
                        cb(series); return;
                    }
                    anyAvailable(data.data.filter(function (s) { return apiUrl(s.url); }),function (s,next) {
                        read(apiUrl(s.url),function (page) {
                            if (page) seasonPages[s.url] = page;
                            checkEpisodes(page,next);
                        });
                    },function (ok) { cb(ok ? {title:sourceName,seasons:seasons,quality:function () { return peak; }} : null); },current);
                    return;
                }
            }
            if (data && data.type === 'episode') {
                function episodes(ok) {
                    if (ok) episodeRows(data,function (rows) { cb({title:sourceName,rows:rows,quality:function () { return peak; },
                        probeQuality:function (update) { probeEpisodeQuality(data,update); }}); }); else cb(null);
                }
                if (verify && !quick) checkEpisodes(data,episodes); else episodes(true);
                return;
            }
            function finishMovie() {
                var rows = rowsFor(data);
                cb(rows.length ? {title:sourceName,rows:rows,quality:function () { return peak; }} : null);
            }
            var candidates = (data && data.data || []).filter(playable);
            if (verify && quick) {
                    if (!candidates.length) { cb(null); return; }
                    var found = {title:sourceName,rows:rowsFor(data),quality:function () { return peak; },minutes:function () { return duration; }};
                    found.more = function (update,limit) {
                        var remaining = candidates.filter(function (item) { return ratings[item.url] == null; });
                        checkAll(limit ? remaining.slice(0,limit) : remaining,function (item,next) {
                            checkItem(item,function (ok) {
                                if (!ok) ratings[item.url] = 0;
                                found.rows = rowsFor(data);
                                update();
                                next();
                            },screenOpen || current);
                        },function () { found.more = null; update(); });
                    };
                    cb(found);
            }
            else if (verify) checkAll(candidates,checkItem,finishMovie);
            else finishMovie();
        }
        function probeEpisodeQuality(page,update) {
            var valid = screenOpen || current;
            if (!valid()) return;
            var sample = (page && page.data || []).find(playable);
            var voices = (page && page.voice || []).filter(function (v) { return !v.active && apiUrl(v.url); });
            var seen = Object.create(null);
            function probe(data,next) {
                if (!valid()) return;
                if (!sample) sample = (data && data.data || []).find(playable);
                var item = sample && (data && data.data || []).find(function (ep) {
                    return playable(ep) && +ep.s === +sample.s && +ep.e === +sample.e;
                });
                if (!item || seen[item.url]) { next(); return; }
                seen[item.url] = true;
                checkItem(item,function () { update(false); next(); },valid);
            }
            probe(page,function () {
                checkAll(voices,function (voice,next) {
                    if (!valid()) return;
                    if (peak >= 2160) { next(); return; }
                    readCatalog(apiUrl(voice.url),function (other) { probe(other,next); });
                },function () { update(true); });
            });
        }
        function checkEpisodes(page,next) {
            function checkPage(data,cb) {
                anyAvailable((data && data.data || []).filter(playable),checkItem,cb,current);
            }
            checkPage(page,function (ok) {
                if (ok) { next(true); return; }
                anyAvailable((page && page.voice || []).filter(function (v) { return !v.active && apiUrl(v.url); }),function (v,cb) {
                    read(apiUrl(v.url),function (other) { checkPage(other,cb); });
                },next,current);
            });
        }
        function rowsFor(data) {
            var choices = (data && data.data || []).filter(function (item) {
                return playable(item) && (quick ? ratings[item.url] !== 0 : !verify || ratings[item.url]);
            }).map(function (item) { return {item:item,label:labelOf(item)}; });
            return ((data && Array.isArray(data.data)) ? data.data : []).filter(function (item) {
                if (verify) return playable(item) && (quick ? ratings[item.url] !== 0 : !!ratings[item.url]);
                return item && (item.method === 'play' ? mediaUrl(item.url) : apiUrl(item.url));
            }).map(function (item) {
                var label = item.translate || item.name || item.title || title;
                return {id:item.url,title:label,tier:ratings[item.url],subtitle:[sourceName,qualityLabel(ratings[item.url]),item.year].filter(Boolean).join(' · '),action:function () {
                    if (playable(item)) {
                        var index = choices.map(function (c) { return c.item; }).indexOf(item);
                        playVoices(choices,index); return;
                    }
                    read(apiUrl(item.url),function (child) {
                        resultFor(child,function (found) {
                            if (found && navigate) navigate(found);
                            else if (found && found.rows) showPicker(sourceName,found.rows,'content');
                            else if (isSeries(movie)) lampa.Noty.show('Источник не вернул серии для этой карточки');
                            else unavailable();
                        });
                    });
                }};
            });
        }
        var search = queryString(query);
        var matchNeeded = key === 'cdnvideohub' && !query.kinopoisk_id && query.year;
        function matchCatalog(callback) {
                read('https://z01.online/lite/hdvb'+search,function (catalog) {
                    var matches = (catalog && catalog.type === 'similar' && catalog.data || []).filter(function (row) {
                        return row && String(row.year) === query.year && [title,movie.original_title,movie.original_name].some(function (name) {
                            return name && String(row.title).trim().toLowerCase() === name.trim().toLowerCase();
                        }) && /^https:\/\/z01\.online\/lite\/hdvb\?/.test(row.url);
                    });
                    if (matches.length !== 1) { callback(null); return; }
                    var kp = /[?&]kinopoisk_id=([1-9]\d{0,9})(?:&|$)/.exec(matches[0].url);
                    if (!kp) { callback(null); return; }
                    read(base+search+'&kinopoisk_id='+kp[1],callback);
                });
        }
        if (quick && matchNeeded) {
            var waiting = 2, received = false;
            function accept(data) {
                if (received) return;
                resultFor(data,function (found) {
                    if (received) return;
                    waiting--;
                    if (found && (found.seasons || found.rows && found.rows.length)) {
                        received = true; done(found);
                    } else if (!waiting) done(null);
                });
            }
            read(base+search,accept);
            matchCatalog(accept);
        } else read(base+search,function (data) {
            if (matchNeeded && !(data && data.data && data.data.length)) matchCatalog(function (found) { resultFor(found,done); });
            else resultFor(data,done);
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
            param: { name: 'open4k_default_source', type: 'select', default: 'cdnvideohub', values: names },
            field: { name: 'Источник по умолчанию', description: 'Открывается при входе в карточку просмотра.' }
        });
    }

    function uhdTrackWidth(buffer) {
        var bytes = new Uint8Array(buffer);
        function field(pos,strip) {
            var mask = 128, n = 1;
            while (mask && !(bytes[pos] & mask)) { mask >>= 1; n++; }
            if (!mask || pos+n > bytes.length || (!strip && n > 4)) return null;
            var value = strip ? bytes[pos] & (mask-1) : bytes[pos];
            for (var i=1;i<n;i++) value = value*256+bytes[pos+i];
            return {value:value,end:pos+n};
        }
        function find(start,end,path,depth) {
            while (start < end) {
                var id = field(start,false), size = id && field(id.end,true);
                if (!size || size.end > end) return 0;
                var stop = Math.min(end,size.end+size.value);
                if (id.value === path[depth]) {
                    if (depth === path.length-1 && size.value <= 4 && stop-size.end === size.value) {
                        var width = 0;
                        for (var i=size.end;i<stop;i++) width = width*256+bytes[i];
                        return width;
                    }
                    if (depth < path.length-1) {
                        var found = find(size.end,stop,path,depth+1);
                        if (found) return found;
                    }
                }
                start = stop;
            }
            return 0;
        }
        if (bytes.length < 4 || new DataView(buffer).getUint32(0) !== 0x1a45dfa3) return 0;
        return find(0,bytes.length,[0x18538067,0x1654ae6b,0xae,0xe0,0xb0],0);
    }
    function probeUhdFile(url,done) {
        var req = new XMLHttpRequest(), limit = 131072;
        req.open('GET',url,true);
        req.responseType = 'arraybuffer';
        req.timeout = 14000;
        req.setRequestHeader('Range','bytes=0-'+(limit-1));
        req.onreadystatechange = function () { if (req.readyState === 2 && req.status !== 206) req.abort(); };
        req.onprogress = function (e) { if (e.loaded > limit) req.abort(); };
        req.onload = function () { done(req.status === 206 && req.response && uhdTrackWidth(req.response) >= 3840); };
        req.onerror = req.ontimeout = req.onabort = function () { done(false); };
        req.send();
    }
    function testUhdCatalog(key,movie,current,done) {
        if (isSeries(movie)) { done(null); return; }
        var card = Object.assign({},movie,{kp_id:null,kinopoisk_id:null});
        resolveMovieIds(card,function (ids) {
            if (!current()) return;
            var imdb = ids.find(function (id) { return id.indexOf('imdb/') === 0; });
            if (!imdb) { done(null); return; }
            var provider = {provider:'httpstreaming'};
            'http4khdhub httpUHDMovies httpHDHub4u httpMoviesDrive httpMKVCinemas httpCineDoze httpMalluMv httpVixSrc httpMoviesMod httpMoviesLeech httpAnimeFlix http111477 httpXDMovies httpPixeldrain httpMkvBase httpVadapav httpInternetArchive'.split(' ').forEach(function (name) {
                provider[name] = name === key;
            });
            var config = {DebridServices:[provider],Languages:[],Resolutions:[],Scrapers:[],IndexerScrapers:[],ScrapersConfigured:true};
            var url = 'https://sooti.click/'+encodeURIComponent(JSON.stringify(config))+'/stream/movie/'+imdb.slice(5)+'.json';
            readResponse(url,25000,function (r) { return JSON.parse(r.responseText).streams; },function (streams) {
                if (!current()) return;
                var brand = key === 'http4khdhub' ? '4KHDHub' : 'CineDoze';
                var candidates = (Array.isArray(streams) ? streams : []).filter(function (s) {
                    return s && /^https:\/\/sooti\.click\//i.test(s.url) && /\b(?:4k|2160p)\b/i.test(s.name) &&
                        String(s.title || '').trim().toLowerCase().endsWith('| '+brand.toLowerCase());
                });
                var row;
                anyAvailable(candidates,function (s,next) {
                    probeUhdFile(s.url,function (ok) {
                        if (ok) {
                            var release = String(s.behaviorHints && s.behaviorHints.fileName || s.title);
                            var audio = [['Русский',/\b(?:rus|russian)\b/i],['Английский',/\b(?:eng|english)\b/i],
                                ['Хинди',/\bhindi\b/i],['Тамильский',/\btamil\b/i],['Телугу',/\btelugu\b/i]]
                                .filter(function (pair) { return pair[1].test(release); }).map(function (pair) { return pair[0]; });
                            row = {id:s.url,tier:2160,title:audio.join(' · ') || 'Язык не указан',subtitle:brand+' · 4K · MKV',
                                action:function () { startWatching({title:cardTitle(movie),url:s.url,launch_player:'lampa'},movie); }};
                        }
                        next(ok);
                    });
                },function (ok) { done(ok ? {title:names[key],rows:[row],quality:function () { return 2160; }} : null); },current);
            });
        });
    }
    function availableSource(key,movie,label,current,done,quick,screenOpen) {
        if (isTestCatalog(key)) { testUhdCatalog(key,movie,current,done); return; }
        if (key !== 'collaps') {
            onlineSource(key,movie,function (found) {
                done(found && (found.seasons || found.rows && found.rows.length) ? found : null);
            },current,null,label,true,quick,screenOpen);
            return;
        }
        resolveMovieIds(movie,function (ids) {
            if (!current()) return;
            collapsSource(movie,ids,function (found) {
                if (!current()) return;
                if (!found) { done(null); return; }
                var media = found.media;
                var entries = media.url ? [media] : [].concat.apply([],media.seasons.map(function (s) { return s.episodes; }));
                found.quality = function () { return media.maxQuality; };
                anyAvailable(entries,function (entry,next) {
                    checkPlaylist(entry.url || entry.hls,function (ok,tier,minutes) {
                        if (!ok) { next(false); return; }
                        entry.maxQuality = tier || entry.maxQuality;
                        if (media.url && minutes) found.minutes = function () { return minutes; };
                        collapsDash(entry,function () {
                            media.maxQuality = Math.max(media.maxQuality || 0,entry.maxQuality || 0);
                            next(true);
                        });
                    },current,0,entry.masterResponse);
                },function (ok) { done(ok ? found : null); },current);
            });
        });
    }

    function MovieScreen(options) {
        var self = this, $ = window.$, movie = options.movie || {};
        var title = cardTitle(movie), original = movie.original_title || movie.original_name || '';
        var year = String(movie.release_date || movie.first_air_date || '').slice(0, 4);
        var query = title, alive = true, last;
        var pref = lampa.Storage.get('open4k_default_source', 'cdnvideohub');
        var sources = names;
        var order = ['cdnvideohub','collaps','lordfilm','hdvb'];
        if (!isSeries(movie)) order.push('http4khdhub','httpCineDoze');
        if (isSeries(movie) && isTestCatalog(pref)) pref = 'cdnvideohub';
        if (!Object.prototype.hasOwnProperty.call(names,pref)) {
            pref = 'cdnvideohub';
            lampa.Storage.set('open4k_default_source',pref);
        }
        var source = pref;
        var root = $('<div class="o4-view"></div>');
        var side = $('<aside class="o4-info"></aside>').appendTo(root);
        var main = $('<section class="o4-main"></section>').appendTo(root);
        var tools = $('<div class="o4-tools"></div>').appendTo(main);
        var list = $('<div class="o4-list"></div>').appendTo(main);
        var historyKey = historyKeyFor(movie);
        var seasonInfo = Object.create(null), loadingInfo = Object.create(null);

        function picture(path, size) {
            if (!path || !lampa.Api || !lampa.Api.img) return '';
            return lampa.Api.img(path, size);
        }
        function tag(parent, cls, value) {
            return $('<div></div>').addClass(cls).text(value).appendTo(parent);
        }
        function centerRow(row) {
            var box = list[0], maxScroll = box.scrollHeight-box.clientHeight;
            if (!box.clientHeight || maxScroll <= 0 || row.parentNode !== box || list.children('.o4-row').length < 2) return;
            var top = box.getBoundingClientRect().top+box.clientTop;
            var target = box.scrollTop+row.getBoundingClientRect().top-top+(row.offsetHeight-box.clientHeight)/2;
            box.scrollTop = Math.max(0,Math.min(maxScroll,target));
        }
        function stepRow(delta) {
            if (!last || last.parentNode !== list[0] || !$(last).hasClass('o4-row')) return false;
            var sibling = delta < 0 ? last.previousElementSibling : last.nextElementSibling;
            if (sibling && $(sibling).hasClass('o4-row')) lampa.Controller.collectionFocus(sibling,root);
            else if (delta < 0) lampa.Controller.collectionFocus(sourceButton[0],root);
            return true;
        }
        function control(parent, cls, label, action) {
            return tag(parent, 'selector ' + cls, label).on('hover:enter', action)
                .on('hover:focus', function () {
                    last = this;
                    list.toggleClass('o4-row-focused',parent === list);
                    if (parent === list) centerRow(this);
                    else list[0].scrollTop = 0;
                });
        }
        function focus() {
            if (!alive || lampa.Activity.active().activity !== self.activity || lampa.Player.opened && lampa.Player.opened()) return;
            refreshHistory();
            var target = last && $.contains(root[0],last) ? last : list.children('.o4-row')[0] || sourceButton[0];
            lampa.Controller.collectionSet(root);
            lampa.Controller.collectionFocus(target,root);
        }
        function drawer(label, choices, pick) {
            lampa.Select.show({title:label, items:choices, onSelect:function (row) {
                lampa.Controller.toggle('content'); pick(row);
            }, onBack:function () { lampa.Controller.toggle('content'); }});
        }
        var sourceLabels = Object.create(null);
        function qualityStatus(key) {
            var found = verified[key], tier = found && found.quality();
            if (tier) return qualityLabel(tier)+(isSeries(movie) ? ' · по проверенной серии' : '');
            if (!found && checked[key]) return 'Источник недоступен';
            if (!found || found.more || found.probeQuality && !found.probeDone) return 'Проверяем качество…';
            return 'Качество не определено';
        }
        function refreshSourceLabel(key) {
            if (sourceLabels[key]) sourceLabels[key].text(qualityStatus(key));
            if (key === source && displayed && verified[key])
                sourceButton.text('Источник · '+withQuality(sources[key],verified[key].quality()));
        }
        function chooseSource() {
            var keys = order.filter(function (key) { return verified[key] || !checked[key] && !isTestCatalog(key); });
            if (!keys.length) { lampa.Noty.show(pending() ? 'Проверяем доступность видео…' : 'Нет доступного видео'); return; }
            drawer('Источник', keys.map(function (key) {
                return {title:sources[key],subtitle:qualityStatus(key),key:key,selected:key === source,
                    onDraw:function (item) { sourceLabels[key] = item.find('.selectbox-item__subtitle'); refreshSourceLabel(key); }};
            }), function (row) {
                if (verified[row.key]) displaySource(row.key);
                else if (!checked[row.key]) {
                    preferred = row.key; source = row.key; displayed = false;
                    ++seasonRevision; seasonButton.hide();
                    sourceButton.text('Источник · '+sources[row.key]); list.empty();
                    showLoading();
                } else lampa.Noty.show('Источник недоступен для этой карточки');
            });
        }
        var sourceButton = control(tools,'o4-chip','',chooseSource);
        var seasons = [], selectedSeason, seasonRevision = 0;
        function chooseSeason() {
            drawer('Сезон',seasons.map(function (s) { return {title:s.label,season:s,selected:s === selectedSeason}; }),
                function (row) { showSeason(row.season); });
        }
        var seasonButton = control(tools,'o4-chip','Сезон',chooseSeason).hide();
        function rightFromList() {
            if (!last || !$.contains(list[0],last) || !$(last).hasClass('o4-row')) return false;
            if (!seasons.length) chooseSource();
            else drawer('Выбор',[
                {title:'Источник',subtitle:sources[source],action:chooseSource},
                {title:'Сезон',subtitle:selectedSeason && selectedSeason.label,action:chooseSeason}
            ],function (row) { row.action(); });
            return true;
        }
        function showSeason(season) {
            var ticket = ++seasonRevision;
            selectedSeason = season;
            seasonButton.text(season.label).show();
            list.empty(); tag(list,'o4-empty','Загрузка серий…');
            function stillHere() { return alive && ticket === seasonRevision; }
            season.load(function (rows) { if (stillHere()) draw(rows); },stillHere);
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
                query = value; if (verified[source]) displaySource(source);
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
        var minutes = Number(movie.runtime) || Number((movie.episode_run_time || [])[0]);
        var meta = tag(side,'o4-meta','');
        function renderMovieMeta() {
            meta.text([year,(movie.production_countries || []).map(function (c) { return c.name; }).join(', '),
                Number(movie.vote_average) > 0 ? '★ ' + Number(movie.vote_average).toFixed(1) : '',
                minutes > 0 ? minutes+' мин'+(isSeries(movie) ? ' на серию' : '') : ''].filter(Boolean).join(' · '));
        }
        renderMovieMeta();
        tag(side,'o4-name',title);
        tag(side,'o4-genres',(movie.genres || []).map(function (g) { return g.name; }).filter(Boolean).join(' · '));
        tag(side,'o4-summary',movie.overview || '');
        function refreshHistory() {
            var latest = lampa.Storage.get(historyKey,{}) || {};
            var road = timelineFor(movie,latest.season,latest.episode);
            var heading = 'Нет истории просмотра';
            if (road && road.time > 0) {
                var seconds = Math.floor(road.time);
                var clock = Math.floor(seconds/60)+':'+('0'+seconds%60).slice(-2);
                heading = (latest.episode != null ? 'Сезон '+latest.season+' · Серия '+latest.episode+' · ' : '')+
                    (road.percent >= 100 ? 'Просмотрено' : 'Остановились на '+clock);
            }
            list.find('.o4-history').text(heading);
        }
        function paintEpisode(item,row) {
            var ep = (seasonInfo[row.season] || {})[row.episode] || {};
            item.find('.o4-label').text(ep.name || row.title);
            var description = ep.overview || row.overview || '';
            item.find('.o4-episode-summary').text(description).toggle(!!description);
            var path = ep.still_path || row.still || '';
            var url = /^https:\/\//i.test(path) ? path : /^\/[\w./%-]+$/.test(path) ? picture(path,'w500') : '';
            var img = item.find('.o4-frame img');
            url = url || still;
            if (url && img.attr('src') !== url) img.show().attr('src',url);
        }
        function loadEpisodeInfo(number) {
            if (seasonInfo[number] || loadingInfo[number]) return;
            function receive(season) {
                if (!alive || !season || !Array.isArray(season.episodes) || !season.episodes.length) return;
                var entries = seasonInfo[number] || Object.create(null);
                season.episodes.forEach(function (ep) {
                    if (!ep || ep.episode_number == null || (ep.season_number != null && +ep.season_number !== number)) return;
                    var entry = entries[ep.episode_number] || (entries[ep.episode_number] = {});
                    ['name','overview','still_path'].forEach(function (key) {
                        if (typeof ep[key] === 'string' && ep[key].trim()) entry[key] = ep[key].trim();
                    });
                });
                seasonInfo[number] = entries;
                list.find('.o4-episode').each(function () {
                    var item = $(this), row = item.data('o4-episode');
                    if (row.season === number) paintEpisode(item,row);
                });
                if (last && last.parentNode === list[0] && list.hasClass('o4-row-focused')) centerRow(last);
            }
            var embedded = Array.isArray(movie.seasons) && movie.seasons.find(function (season) { return season && +season.season_number === number; });
            receive(embedded);
            if (!movie.id || !lampa.Api || typeof lampa.Api.seasons !== 'function') return;
            loadingInfo[number] = true;
            try {
                lampa.Api.seasons(movie,[number],function (data) {
                    delete loadingInfo[number];
                    receive(data && data[number]);
                });
            } catch (error) { delete loadingInfo[number]; }
        }
        function draw(rows,notice) {
            var openingList = !list.children('.o4-row').length;
            var selectedUrl = last && $.contains(list[0],last) ? $(last).data('o4-url') : null;
            var previousIndex = selectedUrl != null ? list.children('.o4-row').index(last) : -1;
            list.empty();
            tag(list,'o4-history','');
            refreshHistory();
            var visibleSeasons = new Set();
            rows.forEach(function (row) {
                var item = control(list,'o4-row','',function () {
                    if (row.episode != null) playSeason(rows.filter(function (r) { return r.season === row.season; }),row);
                    else row.action();
                });
                var episode = row.episode != null, id = episode ? row.season+'x'+row.episode : row.id;
                if (id) {
                    item.data('o4-url',id);
                    if (id === selectedUrl) last = item[0];
                }
                if (episode) {
                    item.addClass('o4-episode').data('o4-episode',row);
                    var frame = $('<div class="o4-frame"></div>').appendTo(item);
                    $('<img alt="" loading="lazy">').on('error',function () {
                        if (still && $(this).attr('src') !== still) $(this).attr('src',still);
                        else $(this).hide();
                    }).appendTo(frame);
                    tag(frame,'o4-episode-number','S'+row.season+' · E'+row.episode);
                    visibleSeasons.add(row.season);
                } else if (still) $('<img alt="">').attr('src',still).appendTo(item);
                var copy = $('<div class="o4-copy"></div>').appendTo(item);
                tag(copy,'o4-label',row.title);
                if (episode) {
                    tag(copy,'o4-episode-summary','');
                    paintEpisode(item,row);
                }
                var road = timelineFor(movie,row.season,row.episode);
                if (road) {
                    lampa.Timeline.render(road).css({position:'relative',margin:'.45em 0',width:'100%'}).appendTo(copy);
                    if (lampa.Timeline.details) lampa.Timeline.details(road,'Просмотрено · ').appendTo(copy);
                }
                tag(copy,'o4-detail',row.subtitle);
            });
            if (openingList && rows.length) last = list.children('.o4-row')[0];
            else if (previousIndex >= 0 && rows.length && last.parentNode !== list[0]) {
                last = list.children('.o4-row')[Math.min(previousIndex,rows.length-1)];
            }
            visibleSeasons.forEach(loadEpisodeInfo);
            if (!rows.length) {
                tag(list,'o4-empty',notice || 'У источника нет доступного видео для этой карточки.');
            }
            if ((lampa.Controller.enabled() || {}).name === 'content') focus();
        }
        function rowsFor(found) {
            if (!found) return [];
            if (!found.media) {
                var visible = found.rows;
                if (!isSeries(movie)) visible = visible.filter(function (row) { return row.tier; })
                    .sort(function (a,b) { return b.tier-a.tier; });
                return visible;
            }
            var media = found.media;
            if (!media.url) return collapsRows(movie, media, function () { draw(rowsFor(found)); });
            var voices = media.audio && media.audio.names || [];
            return (voices.length ? voices : ['Воспроизвести']).map(function (name,index) {
                return {id:'collaps-'+index,title:String(name),subtitle:withQuality(media.dash ? 'DASH / HLS' : 'HLS',media.maxQuality),
                    action:function () { choosePlayback(title,media,media.url,index,movie); }};
            });
        }
        var verified = Object.create(null), checked = Object.create(null), queue = [], workers = 0;
        var preferred = source, displayed = false;
        function showLoading() {
            list.empty();
            if (isSeries(movie)) tag(list,'o4-empty','Проверяем доступность видео…');
            else tag(list,'o4-film-loading','Загружаем фильм… Проверяем качество озвучек.').attr('role','status');
        }
        function waitingForQuality(found) {
            return !isSeries(movie) && found.more && found.quality() < 2160;
        }
        function pending() { return workers || queue.length; }
        function displaySource(key) {
            source = key;
            displayed = true;
            ++seasonRevision; seasons = []; seasonButton.hide();
            sourceButton.text('Источник · ' + withQuality(sources[key],verified[key].quality()));
            queryButton.text('Поиск · ' + query);
            list.empty(); tag(list,'o4-empty','Поиск видео…');
            function done(found) {
                seasons = found && found.seasons || [];
                if (!seasons.length && found && found.rows && isSeries(movie)) {
                    var grouped = new Map();
                    found.rows.forEach(function (row) {
                        if (row.season == null || row.episode == null) return;
                        if (!grouped.has(row.season)) grouped.set(row.season,[]);
                        grouped.get(row.season).push(row);
                    });
                    grouped.forEach(function (rows,number) {
                        seasons.push({number:number,label:'Сезон '+number,load:function (loaded) { loaded(rows); }});
                    });
                }
                if (found && found.media && found.media.seasons) seasons = found.media.seasons.map(function (s) {
                    return {number:+s.number,label:'Сезон '+s.number,load:function (loaded) {
                        loaded(s.episodes.slice().sort(function (a,b) { return +a.episode - +b.episode; }).map(function (ep) {
                            var label = 'Серия '+ep.episode, code = 'S'+s.number+':E'+ep.episode;
                            return {season:+s.number,episode:+ep.episode,title:ep.name || label,overview:ep.overview || ep.description,still:ep.still_path,subtitle:withQuality('Collaps',ep.maxQuality),action:function (transition) {
                                function launch() { choosePlayback(title+' · '+code,ep,ep.hls,undefined,movie,+s.number,+ep.episode,transition); }
                                if (ep.maxQuality) launch();
                                else checkPlaylist(ep.hls,function (ok,tier) {
                                    if (!alive || source !== key || selectedSeason.label !== 'Сезон '+s.number) return;
                                    if (!ok) {
                                        if (transition && transition.failed) transition.failed();
                                        else lampa.Noty.show('Видео недоступно');
                                        return;
                                    }
                                    ep.maxQuality = tier;
                                    found.media.maxQuality = Math.max(found.media.maxQuality || 0,tier || 0);
                                    launch();
                                },function () { return alive && source === key; });
                            }};
                        }));
                    }};
                });
                if (seasons.length) {
                    var latest = lampa.Storage.get(historyKey,{}) || {};
                    showSeason(seasons.filter(function (s) { return s.number === latest.season; })[0] || seasons[0]);
                    return;
                }
                var rows = rowsFor(found);
                draw(rows,found && found.notice);
            }
            var found = verified[key];
            if (waitingForQuality(found)) showLoading();
            else done(found);
        }
        function enrichSource(key,found) {
            function update() {
                if (!alive) return;
                refreshSourceLabel(key);
                if (!minutes && found.minutes && found.minutes()) { minutes = found.minutes(); renderMovieMeta(); }
                if (!found.rows || isSeries(movie)) return;
                if (!found.rows.length) {
                    delete verified[key];
                    refreshSourceLabel(key);
                    if (source === key) { displayed = false; pump(); }
                    return;
                }
                if (source !== key || !displayed) return;
                sourceButton.text('Источник · '+withQuality(sources[key],found.quality()));
                if (waitingForQuality(found)) return;
                var rows = rowsFor(found);
                if (list.find('.o4-row').length !== rows.length) draw(rows);
            }
            if (found.probeQuality) found.probeQuality(function (finished) {
                if (!alive) return;
                found.probeDone = finished;
                refreshSourceLabel(key);
            });
            if (found.more) found.more(update);
            else update();
        }
        function pump() {
            if (!alive) return;
            while (workers < 4 && queue.length) startCheck(queue.shift());
            if (!displayed && checked[preferred]) {
                var key = verified[preferred] ? preferred : Object.keys(verified)[0];
                if (key) displaySource(key);
            }
            if (!displayed && !pending()) {
                sourceButton.text('Источник');
                draw([],'Нет доступных источников для этой карточки.');
            }
        }
        function startCheck(key) {
            workers++;
            availableSource(key,movie,sources[key],function () { return alive && (!checked[key] || source === key); },function (found) {
                if (!alive) return;
                checked[key] = true;
                if (found) verified[key] = found;
                refreshSourceLabel(key);
                workers--; pump();
                if (found) enrichSource(key,found);
            },true,function () { return alive; });
        }
        this.create = function () {
            if (!$('#open4k-list-style').length) $('<style id="open4k-list-style"></style>').text(
                '.o4-view .o4-tools{gap:0;padding:.2em 0 .35em}.o4-tools .o4-chip{margin:.2em .55em .2em 0}'+
                '.o4-view .o4-list{min-height:0;overflow-anchor:none}.o4-list .o4-row{min-height:5.6em;margin:.65em 0}'+
                '.o4-list .o4-row>img{height:5.6em;width:9.95em}.o4-list .o4-episode{min-height:7.1em}'+
                '.o4-list .o4-episode-summary{-webkit-line-clamp:3}.o4-list .o4-copy{padding:.8em 1em}'+
                '.o4-list.o4-row-focused .o4-row:not(.focus){opacity:.67}.o4-list .o4-row.focus{background:rgba(53,61,65,.96)}'
            ).appendTo('head');
            if (!$('#open4k-episode-style').length) $('<style id="open4k-episode-style"></style>').text(
                '.o4-episode .o4-frame{position:relative;flex:0 0 10.7em;align-self:stretch;min-height:6.1em;background:rgba(255,255,255,.05)}'+
                '.o4-row .o4-frame img{position:absolute;width:100%;height:100%;object-fit:cover}.o4-frame img:not([src]){display:none}'+
                '.o4-episode-number{position:absolute;bottom:.45em;left:.55em;padding:.2em .48em;border-radius:.3em;background:rgba(0,0,0,.78);font-size:.82em;font-weight:bold}'+
                '.o4-episode-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:.3em;font-size:.91em;line-height:1.3;opacity:.84}'
            ).appendTo('head');
            if (lampa.Timeline && lampa.Timeline.listener) lampa.Timeline.listener.follow('update',refreshHistory);
            if (!$('#open4k-history-style').length) $('<style id="open4k-history-style"></style>')
                .text('.o4-row .o4-copy{flex:1;min-width:0}.o4-copy .time-line-details{font-size:.9em}').appendTo('head');
            if (!$('#open4k-film-loader').length) $('<style id="open4k-film-loader"></style>').text(
                '.o4-film-loading{display:flex;align-items:center;padding:1.2em 0}.o4-film-loading:before{content:"";width:1em;height:1em;margin-right:.75em;border:.14em solid rgba(255,255,255,.3);border-top-color:currentColor;border-radius:50%;animation:o4-spin .9s linear infinite}@keyframes o4-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.o4-film-loading:before{animation:none}}'
            ).appendTo('head');
            if (!$('#open4k-layout').length) $('<style id="open4k-layout"></style>').text(
                '.o4-view{display:flex;height:100%;padding:1.4em;box-sizing:border-box;gap:2em}.o4-info{width:26%;flex-shrink:0;overflow:hidden}.o4-poster{width:42%;border-radius:.5em}.o4-meta,.o4-detail,.o4-genres{opacity:.76;font-size:.88em}.o4-meta{margin:1em 0}.o4-name{font-size:1.85em;font-weight:700;line-height:1.1;margin:.5em 0}.o4-summary{margin-top:1.4em;line-height:1.45;opacity:.88}.o4-main{flex:1;min-width:0;display:flex;flex-direction:column}.o4-tools{display:flex;flex-wrap:wrap;gap:.65em;padding:.25em}.o4-chip,.o4-row{background:rgba(18,22,24,.76);border-radius:.5em;cursor:pointer}.o4-chip{padding:.8em 1em}.o4-list{overflow-y:auto;flex:1;padding:.3em}.o4-history,.o4-empty{padding:1em 0;opacity:.8}.o4-row{display:flex;align-items:center;min-height:4.7em;margin:.6em 0;overflow:hidden}.o4-row img{width:8em;height:4.7em;object-fit:cover}.o4-copy{padding:.65em 1em}.o4-label{font-size:1.24em}.o4-detail{margin-top:.35em}.o4-view .focus{outline:3px solid currentColor;outline-offset:-3px}'
            ).appendTo('head');
            this.activity.loader(false); this.activity.toggle();
            sourceButton.text('Источник · '+sources[preferred]); queryButton.text('Поиск · '+query);
            showLoading();
            queue = [preferred].concat(order.filter(function (key) { return key !== preferred; }));
            pump();
            return root;
        };
        this.start = function () {
            startContentNavigation(focus,rightFromList,stepRow);
        };
        this.render = function () { return root; };
        this.pause = this.stop = function () {};
        this.destroy = function () {
            alive = false;
            if (lampa.Timeline && lampa.Timeline.listener) lampa.Timeline.listener.remove('update',refreshHistory);
            root.remove();
        };
    }

    function openCard(movie) {
        if (lampa.Component && lampa.Activity && window.$) {
            lampa.Component.add('open4k_movie', MovieScreen);
            lampa.Activity.push({ component: 'open4k_movie', title: menuTitle, movie: movie });
            return;
        }
        var request = ++cardRequest;
        function current() { return request === cardRequest; }
        availableSource('collaps',movie,names.collaps,current,function (found) {
                if (!current()) return;
                function alternatives() {
                    var keys = Object.keys(names).filter(function (key) { return key !== 'collaps'; });
                    var rows = [], remaining = keys.length;
                    keys.forEach(function (key,i) {
                        availableSource(key,movie,names[key],current,function (result) {
                            if (!current()) return;
                            if (result) rows[i] = {title:withQuality(names[key],result.quality()),action:function () { showPicker(names[key],result.rows,'content'); }};
                            if (!--remaining) {
                                var ready = rows.filter(Boolean);
                                if (ready.length) showPicker(cardTitle(movie),ready,'content');
                                else lampa.Noty.show('Для этой карточки нет доступных источников');
                            }
                        });
                    });
                }
                if (found) found.action(null,isSeries(movie) ? null : alternatives);
                else if (movie.release_date) alternatives();
                else lampa.Noty.show('Для этой карточки нет доступных источников');
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
        if (!buttons.length) buttons = event.body.find('.full-start-new__buttons, .full-start__buttons').first();
        if (!buttons.length) return;

        var warmedAt = 0;
        window.$('<div class="full-start__button selector open4k-card-button">' + icon + '<span>' +
            'Смотреть · ' + menuTitle + '</span></div>')
            .on('hover:focus', function () {
                if (Date.now()-warmedAt < 30000) return;
                warmedAt = Date.now();
                var search = queryString(catalogQuery(movie));
                var preferred = lampa.Storage && lampa.Storage.get('open4k_default_source','cdnvideohub') || 'cdnvideohub';
                ['cdnvideohub','lordfilm','hdvb'].forEach(function (key) {
                    if (key !== preferred) readCatalog('https://z01.online/lite/'+key+search,function () {});
                    else onlineSource(key,movie,function (found) {
                        if (found && found.more) found.more(function () {},2);
                    },function () { return Date.now()-warmedAt < 30000; },null,names[key],true,true);
                });
            })
            .on('hover:enter', function () {
                (pagesHost ? pagesHost.runtime.openCard : openCard)(movie);
            })
            .prependTo(buttons);
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
