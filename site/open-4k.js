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
}('fc7d0907fca5e7cd83b03a0b615da2d0aeb3e5c911180601c7a0b047dc364cd1'));

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

    function playCatalogStream(film, stream) {
        if (film.credit === 'Internet Archive') playArchive(film.title, stream.url);
        else play(film.title, stream.url);
    }

    /* studio-index:start */
    var studioIndex = [
        ["\"Мосфильм - 100 лет в кино\"",2023,[["Qm81l4G2Y34","4ebd8fc7438cfc034fe8d2e5c6dd8517"]]],
        ["“Мосфильм” в цифрах и фактах. История и современность легендарной киностудии",2020,[["QS9fdBv1Z7E",""]]],
        ["А если это любовь?",1961,[["-2IhHYRXExU",""]]],
        ["Автомобиль, скрипка и собака Клякса",1974,[["_Uf0uSOyULE",""]]],
        ["Айболит-66",1966,[["QvQx78csrtw",""]]],
        ["Александр Невский",1938,[["IKskdbazW7w",""]]],
        ["Алые Паруса",1961,[["5YzwW4hxrx4",""]]],
        ["Американская дочь",1995,[["1vAv28WLXkE","f594c020efcdbe4132ea5e9c8427427c"]]],
        ["Андрей Рублев",1966,[["F3TUvRzrwPk","6b9e387390ff191bfcf1ff24ebee15f7"]]],
        ["Анна Каренина (телесериал)",2017,[["s2FhGaDNeko",""],["FfnCI5BH8Tg",""],["Hm0iszGD-so",""],["bnM-qJLz7Zg",""],["9rD3yfO2ygM",""],["rHiSSYdDPps",""],["eC2gp_V2UDg",""],["iPMT1jLF3ps",""]]],
        ["Анна Каренина (Четырёхсерийный фильм)",2017,[["vHV72dS1vkE","5115847ea90aa493dae6421289f36830"],["dkzgJzGUDzA","2b8e4afc36ff1c3c0da93007c2507bcb"],["KCUJgPkIMXw","0b73d5d4d1b2e7ed9866af1f9233733a"],["RpNTs5j3Ujo","1b6705254dcf9e0205f0ef17ce94e751"]]],
        ["Анна Каренина. История Вронского",2017,[["ijqwV4wje_E",""]]],
        ["Афоня",1975,[["L9HATyYkZLs",""]]],
        ["Баллада о солдате",1959,[["H2ZFe7XGwt8",""]]],
        ["Батальоны просят огня",1985,[["UsmBFet9SQU",""],["QeHEIxpHuiY",""],["46PS3Lb9C00",""],["BE2eWF25HtY",""]]],
        ["Без страха и упрека",1962,[["oKxPNdrVwM8",""]]],
        ["Безответная любовь",1979,[["-lkyvDXJVPs",""]]],
        ["Безотцовщина",1976,[["XNlmEz7fYzo",""]]],
        ["Белый Тигр",2012,[["G-z1-uHyaus",""]]],
        ["Берегите мужчин!",1982,[["yUqXnQpbS1A",""]]],
        ["Бессмертный гарнизон",1956,[["5w1t9eKJpKc",""]]],
        ["Бешеные деньги",1981,[["7zJhNoX-Cs0",""]]],
        ["Большой аттракцион",1974,[["cwCflkT13IU","93a932c7d55ae7404e6d8d19cf1c5f32"]]],
        ["Борец и клоун",1957,[["QrmpWVWLOt0",""]]],
        ["Братья Карамазовы",1968,[["z_U-juAzXik",""],["I4arxS-jvJc",""],["MKMkOX7znwk",""]]],
        ["В зоне особого внимания",1977,[["0xqSmIBZHMM",""]]],
        ["Василий и Василиса",1981,[["lKhDCvTriic",""]]],
        ["Взлет",1979,[["HZGNwaP8iRY","22949ecd4e36c4abe450c4309529d927"]]],
        ["Вий",1967,[["Amh3uudVMBo",""]]],
        ["Владивосток",2021,[["Ty0ZpuDlzM4","6dd052a50f9a9d219092ef75f05f6607"]]],
        ["Возмездие",1967,[["ICim4u2kRF0",""],["JSN3he99FMo",""]]],
        ["Вокзал для двоих",1982,[["3g-p1d8H02o",""]]],
        ["Восхождение",1976,[["VteY61FDhc8",""]]],
        ["Время, вперед!",1965,[["RGZAzR4p3T4",""],["r__Z0Mz69wE",""]]],
        ["Всадник по имени Смерть",2004,[["v83jD-ccNTU","5c68e7af4a9ffb61b2dc99548fdae625"]]],
        ["Встреча на Эльбе",1949,[["ZymeUZuqsWo",""]]],
        ["Вызываем огонь на себя",1963,[["WYWjVP8KGlM",""],["wvbVXHcFaQ0",""],["x4yzKCr6Guk",""],["CvpQbQmgIVY",""]]],
        ["Город Зеро",1988,[["zbT53Q_olkU","6614062d41a92ae782d23fa26fdb4964"]]],
        ["Горячий снег",1972,[["Ay-vJ4OUDjM",""]]],
        ["Дамы приглашают кавалеров",1980,[["VypmP_Wq1dU",""]]],
        ["Двенадцать стульев",1971,[["P8t2dbJ7YXY",""]]],
        ["Девушка без адреса",1957,[["cEeMGnlihLY",""]]],
        ["Девчата",1961,[["8CYY8EM5xYE","7358ddc35dd78d6f136be8e99f8be457"]]],
        ["Деловые люди",1962,[["mPEpMflSsoM",""]]],
        ["День полнолуния",1998,[["BY5SB7JtmfA","85a18801a703fc537e68cda6f6b4b614"]]],
        ["Дерсу Узала",1975,[["bp2ihvch45k","76ae7e626a85cf672f901c0f75ea929f"],["HVobfdjETew",""]]],
        ["Джентльмены удачи",1971,[["8tJPKSz6Gaw","8f50ed5a7841ff1418671a3c6b7440d4"]]],
        ["Дни и ночи",1944,[["d8LsF0-MRaI",""]]],
        ["Добряки",1979,[["OgEvZh3cMsg","c075e93fa35900ab99b0e07877d4f47e"]]],
        ["Дорога к морю",1965,[["eVeATgpIaxQ",""]]],
        ["Дорога на Берлин",2015,[["DjHTWMP_T1U",""]]],
        ["Друг мой, Колька!..",1961,[["5wEvu3Y3eIo",""]]],
        ["Еще раз про любовь",1968,[["voGfZ7T8jQg","0648fd5f7438d672b72c5d50c0b8cf2b"]]],
        ["Жаркое лето в Кабуле",1983,[["dhMC1uA3w90",""]]],
        ["Жди меня",1943,[["GjgpRXLztmo",""]]],
        ["Женитьба Бальзаминова",1964,[["PYdfEMNkVwI",""]]],
        ["Жених с того света",1958,[["gKoaB1Hy-X8",""]]],
        ["Жестокий романс",1984,[["4naOrjRiTnc",""],["-6DNbCOaAH8",""]]],
        ["Живите в радости",1978,[["hPSwuMKG2Yk",""]]],
        ["Живые и мертвые",1963,[["ZpXhR5Iw6vM",""],["sE5MDJ9RCUk",""]]],
        ["За спичками",1980,[["12-mEzG8TUo",""]]],
        ["Звезда",2002,[["vcGC2JDh-pc",""]]],
        ["Звонят, откройте дверь",1965,[["A_qBi8GjeOY",""]]],
        ["Земля Санникова",1973,[["Lthcn5C4Mpg","517a03c96cb712b66c3490e8c5460271"]]],
        ["Зимний вечер в Гаграх",1985,[["vd1hzYAQHW8","2adc63a4d04293c2b4f73a2147d6bef0"]]],
        ["Змеелов",1985,[["MabRmJ2qrjM",""]]],
        ["Золотой теленок",1968,[["jchmRazCbJM",""],["pyqD23zX0YI",""]]],
        ["Иван Васильевич меняет профессию",1973,[["TQ8onQu5QKY","de108b940b59e5e9d361077328ca9201"]]],
        ["Иди и смотри",1985,[["UkkJZweYaLI","8a444281685a97ee8828ff27e87b0178"]]],
        ["Илья Муромец",1956,[["uopfqauEz64",""]]],
        ["Инкогнито из Петербурга",1977,[["UIM9wSOzJV0",""]]],
        ["Исчезнувшая империя",2007,[["Rfrmzk2zrTA","ea0df4d7b51ab0de57c92defee411054"]]],
        ["Ищите женщину",1982,[["fjfB08JEALY",""],["gWnefFBV_sY",""]]],
        ["Кавказская пленница, или Новые приключения Шурика",1966,[["0f1LxDfNpv0","2959f7a99504290930cc68951bd2f5ce"]]],
        ["Кадриль",1999,[["xTSppgrbhFE",""]]],
        ["Калина красная",1973,[["MYmi--Kot-k","1ffb924533679b0844a66ddbb4d7ca26"]]],
        ["Карусель",1970,[["t_rmuj4n1Gg",""]]],
        ["Киноальманах \"Совершенно серьезно\"",1961,[["SUe5icgNSFk",""]]],
        ["Киноальманах \"Совершенно серьезно\". Пес Барбос и необычный кросс",1961,[["iBNwsNmKGxA",""]]],
        ["Китайский сервиз",1999,[["7dhXHN-Jsws",""]]],
        ["Ко мне, Мухтар!",1964,[["5FJvRsh2pv4",""]]],
        ["Комедия давно минувших дней",1980,[["ehYajR5Qleg",""]]],
        ["Коммунист",1957,[["es8MdRnBdJQ","bbb873aa7fd627b349991322ef68883c"]]],
        ["Композитор Глинка",1952,[["FYF5ovlUNm4","111b1e2676735c36183e6520180a6aaf"]]],
        ["Косухи",2013,[["XH75vK6X4ik",""]]],
        ["Красное, синее, зеленое",1966,[["y2V7dC-pz7o",""]]],
        ["Крах",1968,[["UJwxRuIvf_s",""],["eZoMr8CFYyo",""]]],
        ["Курьер",1986,[["QSc3uk8Q5w4","788d258dd76e66c7f1e8bf972125e2bf"]]],
        ["Кыш и Двапортфеля",1974,[["7yU6u_tYdYg",""]]],
        ["Леди Макбет Мценского уезда",1989,[["5-lqqfCZydU",""]]],
        ["Лермонтов",1986,[["KicwbmKIq4I",""]]],
        ["Лестница",1989,[["cr-WmROmts8","d3c721770f281c561e261bb3d2353ca6"]]],
        ["Летят журавли",1957,[["2OccZQmxKac","7d448de4550e9c88c684be319fa43b7d"]]],
        ["Любимая женщина механика Гаврилова",1981,[["_HII9IO5M4g",""]]],
        ["Любовь в СССР",2012,[["ZYzLxPHv4d8","84936a4a7e583599f9499267745cd3d3"]]],
        ["Любовь земная",1974,[["Q4QZ11iuq1c",""]]],
        ["Любовь и голуби",1984,[["qYPVTBIgF7Q","68781d890618ea50933ec020fd5060bf"]]],
        ["Майор Вихрь",1967,[["dmVmabto42I",""],["WWs0qSuvWKQ",""],["9ysGdh37iGM",""]]],
        ["Маленькие трагедии",1979,[["1Ke33_1de_Y",""],["sJcrStM2U3c",""],["O9ncpNMzhSs",""]]],
        ["Мальчики",1971,[["HkrP2H_t6QE",""]]],
        ["Мачеха",1973,[["M2v970u8TCI",""]]],
        ["Места тут тихие",1967,[["yjhbrGCexgQ",""]]],
        ["Мимино",1977,[["P4k2LNPRV-0",""]]],
        ["Мичман Панин",1960,[["qUC4Ea_gqEo","899c87b257098f505351f83aef9f6b5d"]]],
        ["Мой ласковый и нежный зверь",1978,[["IQhBo9Pz0rw","e04d180bb2a8f0a5e6ad7ac4d1e2a54b"]]],
        ["Москва слезам не верит",1979,[["X7GuhjGZ-xs","c3f9a356e9e04ac607b4d7d295648eab"],["uUVd9j543s8","993a315cc6dbb860b88d1b1171e85d3b"]]],
        ["Москва, любовь моя",1974,[["SMkjDijxwq4",""]]],
        ["Мы из джаза",1983,[["sP_myq8HZ9c","58571267d048c4490ee0bffaa9844c44"]]],
        ["Не может быть!",1975,[["DZHXRy-FTuM",""]]],
        ["Не хочу быть взрослым!",1982,[["vGJPWk7H-b0",""]]],
        ["Невероятные приключения итальянцев в России",1973,[["0B3nK-k0KzQ",""]]],
        ["Неисправимый лгун",1973,[["IsbjcE8w0ps",""]]],
        ["Нейлон - 100%",1973,[["9GoZ-EO1hvQ",""]]],
        ["Неподсуден",1969,[["uMWb57a56c8",""]]],
        ["О друзьях-товарищах",1970,[["xwAQ_v4c0gU",""],["EnjupKnw8ZM",""]]],
        ["Одиноким предоставляется общежитие",1983,[["faQWW7RNchI",""]]],
        ["Одиночное плавание",1985,[["3hwqjvQ18vg","1fc2614cc6668453192d0141207e7c03"]]],
        ["Она",2013,[["k0vAWHGoXZA",""]]],
        ["Они сражались за Родину",1975,[["xfUlR_nuBb4",""]]],
        ["Опасно для жизни",1985,[["Glle7qNMxCE",""]]],
        ["Опекун",1970,[["KxJeEctWvxc",""]]],
        ["Операция \"Ы\" и другие приключения Шурика",1965,[["7ICl3sPny94","fcb693c38528938caa3b70101b7c58bf"]]],
        ["Освобождение. Фильм 1. Огненная дуга",1968,[["GZlzMhfx2hQ",""]]],
        ["Освобождение. Фильм 2-й. Прорыв",1968,[["j0t5CHhsuaM",""]]],
        ["Освобождение. Фильм 3-й. Направление главного удара",1970,[["Glz5ZJLEPgY",""]]],
        ["Освобождение. Фильм 4-й. Битва за Берлин",1971,[["MEfxAE6dTDU",""]]],
        ["Освобождение. Фильм 5-й. Последний штурм",1971,[["PqJEMXbRgdw",""]]],
        ["Осенние свадьбы",1967,[["Re4ovfuiQpU",""]]],
        ["Ответный ход",1981,[["HsGsMVVhb5A",""]]],
        ["Падение Берлина",1949,[["t-hZam8dXHU",""],["1AHUQ1QRVn4",""]]],
        ["Палата №6",2009,[["7lDz_9RW5zA","48be756b83375cacdb5a9b6bb81b0e89"]]],
        ["Пена",1979,[["TER9_JMLMv4",""]]],
        ["Первое свидание",1960,[["qENexAdKtm4",""]]],
        ["По главной улице с оркестром",1986,[["_OKnE5fSG-c","9a21fe793f3a6b8f7da7316dcd60eb75"]]],
        ["По семейным обстоятельствам",1977,[["CLiVVm7uaeA",""],["b3lQ6xZE93k",""]]],
        ["Помни имя своё",1974,[["R4B-qMqV7cA",""]]],
        ["Последняя жертва",1975,[["H5PdjPF4l6A",""]]],
        ["Прежде, чем расстаться",1984,[["W_M29YNoUWs",""]]],
        ["Пришел солдат с фронта",1971,[["1OxY3kYVd6A",""]]],
        ["Путь к причалу",1962,[["HhIco19wK4g",""]]],
        ["Пядь земли",1964,[["2Abp6AQhF4E",""]]],
        ["Пять дней, пять ночей",1960,[["cxfCGhUxMIE",""]]],
        ["Раз на раз не приходится",1987,[["StAibxiC6Uk",""]]],
        ["Ребро Адама",1990,[["nNVwosCwjlY",""]]],
        ["Решение о ликвидации",2018,[["-dLBhMfVi3E",""]]],
        ["Самая обаятельная и привлекательная",1985,[["v7PbeasXUbM","99fbb912b94d7d533d53556db73aa627"]]],
        ["Сашка",1981,[["W1k4Rm90p5o",""]]],
        ["Сверстницы",1959,[["jqbaCD-Gv88",""]]],
        ["Сдается дом со всеми неудобствами",2016,[["uy2E5CRXlnA",""]]],
        ["Седьмое небо",1971,[["HDwTiUluWbs",""]]],
        ["Секретная миссия",1950,[["O6tcm9ejFgE",""]]],
        ["Сказ про то, как царь Петр арапа женил",1976,[["aePYhB1VHfY",""]]],
        ["Сказка о потерянном времени",1964,[["rmyF-XTrHeU",""]]],
        ["Сказка странствий",1982,[["7LNrQ4bt-Qc",""]]],
        ["Служебный роман",1977,[["hR-1QGMK75c","9b8a20607f7a35bde58aaf51fd9d8348"],["kUNy3NrxZAc","45fd0c7752add6e3cad61521a8869dac"]]],
        ["Служили два товарища",1968,[["e7P3QbcI91U",""]]],
        ["Смешные люди",1977,[["nKzTV2YPHkI",""]]],
        ["Сны",1993,[["1mZZZ4dBlRo","2d2b72bf4071179b2aaca148c45ce4be"]]],
        ["Соло для слона с оркестром",1975,[["mZL3eexUziI",""],["Fl5yN6EpJpc",""]]],
        ["Спортлото-82",1982,[["FxWczA4ZgI4","4b6f02f2b06a16261b388e17df5ac02e"]]],
        ["Сталинград",1989,[["7MU_HhTLXcE","551ea69818b79dcdf1a46dc379335b98"],["FSslPhaPVzQ","d641fb0ef5223340b6c1de22c9eb8012"]]],
        ["Сталкер",1979,[["UPerb922QGM","51c61871c3db1ef2624b2e4cd0aae155"]]],
        ["Старшая сестра",1966,[["VoQEUYAJwbc",""]]],
        ["Странная женщина",1977,[["MzIPA7gAzvM","69c10c5669858266bfdc0bd9c938666a"]]],
        ["Судьба",1977,[["S8WCv3qz4DM",""]]],
        ["Судьба человека",1959,[["ov7bKyahGL4",""]]],
        ["Суета сует",1979,[["qZ-UglMUxN8","60b3de16497f812364819363fac5ed2b"]]],
        ["Табор уходит в небо",1976,[["udkz19ISbZs","5ee9ac8df7002536fe888df3503f686b"]]],
        ["Тема",1979,[["4A1TBPJnFFo","4ab73adb665f60bb0c33841b308db443"]]],
        ["Точка, точка, запятая",1972,[["9or1F07gh6Q",""]]],
        ["Трактир на Пятницкой",1977,[["P1XM8A-YdRU",""]]],
        ["Третий тайм",1962,[["X1awfyw9vIU",""]]],
        ["Трижды воскресший",1960,[["snXuJa5y768",""]]],
        ["Ты - мне, я - тебе",1976,[["GpRwjWEvizQ",""]]],
        ["У самого Белого моря",2021,[["HDuCqwlDaAo",""]]],
        ["Убийство на улице Данте",1956,[["OHug8mK1zlo",""]]],
        ["Укрощение огня",1972,[["k4h_ebC8KyY","5f546d43a8f15ef49a5aec53098c8a7a"]]],
        ["Фронт без флангов",1974,[["i3iibu2c_Yg",""],["mVeRQc8KPPo",""]]],
        ["Хитровка. Знак четырёх",2023,[["bf5P3wQZ3fc","e4815c220252ceac0ea9c0460b8cf5bc"]]],
        ["Хозяин тайги",1968,[["lQdfSGj6PQY",""]]],
        ["Цареубийца",1991,[["k5RncpCn4Xc","c990498a7a02b5e4d27ea3011446ddc2"]]],
        ["Цветы от победителей",1999,[["V23ErtWVtyo",""]]],
        ["Частный детектив, или операция \"Кооперация\"",1989,[["UWpyJM-0qlI",""]]],
        ["Человек родился",1956,[["YtlmWtXqcWs",""]]],
        ["Человек-невидимка",1984,[["K3CSWhXOB6k",""]]],
        ["Шаг",1988,[["KHlBy1DJBfA",""]]],
        ["Шантажист",1987,[["u4BgUGhSjnM",""]]],
        ["Шире шаг, маэстро!",1975,[["R01VilweboM","4f193a0d4ebd62266afdfb1a47428d60"]]],
        ["Ширли-Мырли",1995,[["_v3Kl79PMuE",""]]],
        ["Щит и меч",1967,[["4f-9REDLyZE",""],["B-sM6yS9s6A",""],["x6Ct6EnGk40",""],["844cLSXa20c",""]]],
        ["Экипаж",1979,[["lgSl7D_vtEE",""]]],
        ["Эта веселая планета",1973,[["xeQYVvKr5Mo",""]]],
        ["Яды, или Всемирная история отравлений",2001,[["mLVwmY527TU","dfc38c56d05a6efedf8be2701c378738"]]],
        ["The Assassin of the Tsar (английская версия фильма \"Цареубийца\")",1991,[["_Iz5ST2BYy8",""]]]
    ];
    /* studio-index:end */

    function studioSource(movie) {
        var year = Number(String(movie.release_date || movie.first_air_date || '').slice(0, 4));
        var titles = [movie.title, movie.original_title, movie.name, movie.original_name].map(normalizeTitle);
        var match = studioIndex.filter(function (entry) {
            return entry[1] === year && titles.indexOf(normalizeTitle(entry[0])) >= 0;
        })[0];
        if (!match) return null;
        var rows = [];
        match[2].forEach(function (part, index) {
            var title = match[0] + (match[2].length > 1 ? ' · Часть ' + (index + 1) : '');
            var fallback = youtubeStream(part[0]).url;
            rows.push({ title: title, subtitle: 'YouTube · Качество выбирает плеер',
                action: function () { play(title, fallback); } });
            if (part[1]) rows.push({ title: title, subtitle: 'RuTube · HLS', action: function () {
                var activity = lampa.Activity.active();
                readJson('https://rutube.ru/api/play/options/' + part[1] + '/?format=json', function (options) {
                    if (lampa.Activity.active() !== activity) return;
                    var stream = options && options.video_balancer && options.video_balancer.m3u8;
                    play(title, typeof stream === 'string' && /^https:\/\/[\w.-]+\//.test(stream) ? stream : fallback);
                });
            } });
        });
        return { title: 'Мосфильм', rows: rows };
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
                action: function () { playCatalogStream(film, stream); }
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
        items = items.concat(classics.concat(mosfilm).map(filmRow));
        items.push({ title: 'Каталог Мосфильма', subtitle: studioIndex.length + ' картин и сериалов',
            action: function () {
                function browse() {
                    var titles = studioIndex.map(function (entry) {
                        return { title: entry[0] + ' (' + entry[1] + ')', action: function () {
                            var found = studioSource({title: entry[0], release_date: String(entry[1])});
                            if (found) showPicker(entry[0], found.rows, controller, browse);
                        } };
                    });
                    showPicker('Мосфильм', titles, controller, function () { showCatalog(controller); });
                }
                browse();
            } });
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
        return films.concat(classics, mosfilm).filter(function (candidate) {
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
                auto: 'Автоматически', studio: 'Мосфильм', broadcast: 'MediathekView', collaps: 'Collaps', anime: 'AniLiberty',
                archive: 'Internet Archive', catalog: 'Подборка 4K'
            } },
            field: { name: 'Источник по умолчанию', description: 'Открывается при входе в карточку просмотра.' }
        });
    }

    function MovieScreen(options) {
        var self = this, $ = window.$, movie = options.movie || {};
        var names = { studio: 'Мосфильм', broadcast: 'MediathekView', collaps: 'Collaps', anime: 'AniLiberty', archive: 'Internet Archive', catalog: 'Подборка 4K' };
        var title = cardTitle(movie), original = movie.original_title || movie.original_name || '';
        var year = String(movie.release_date || movie.first_air_date || '').slice(0, 4);
        var film = findFilm(movie);
        var query = title, serial = 0, alive = true, last, loaded = {};
        var pref = lampa.Storage.get('open4k_default_source', 'auto');
        var order = film ? ['catalog','collaps'] : isAnimation(movie) ? ['anime','collaps'] : ['collaps'];
        if (studioSource(movie)) order.unshift('studio');
        order.push('broadcast');
        if (!isSeries(movie) && year) order.push('archive');
        var source = names[pref] ? pref : order[0];
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
                    return {title:stream.title,subtitle:stream.subtitle,action:function () { playCatalogStream(match,stream); }};
                })});
            } else if (key === 'studio') done(studioSource(search));
            else if (key === 'broadcast') broadcasterSource(search,done);
            else if (key === 'archive') {
                if (isSeries(movie) || !year) done(null); else archiveSource(search,Number(year),done);
            } else if (key === 'anime') aniLibertySource(search,done);
            else {
                var ids = collapsIds(movie);
                var tmdb = lampa.Api && lampa.Api.sources && lampa.Api.sources.tmdb;
                if (!ids.length && movie.source === 'tmdb' && tmdb && tmdb.external_ids) {
                    tmdb.external_ids({id:movie.id,type:isSeries(movie)?'tv':'movie'},function (external) {
                        if (alive && id === serial) collapsSource(movie,collapsIds(external || {}),done);
                    },function () { done(null); });
                } else collapsSource(movie,ids,done);
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
