// SoaperTV provider — ported to Nuvio getStreams for the Tizen/Chromium-47 runtime.
// Source: tapframe/NuvioStreamsAddon providers/soapertv.js
// Runtime allows: global fetch, cheerio (via require), JSON, Promise. No node-fetch,
// no URLSearchParams (Chrome 47), no process.env.
const cheerio = require('cheerio');

const BASE_URL = 'https://soaper.cc';
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function soaperFetch(url, options = {}) {
  const isHttp = url.startsWith('http://') || url.startsWith('https://');
  const fullUrl = isHttp ? url : `${BASE_URL}${url}`;
  const opts = Object.assign({}, options);
  opts.headers = Object.assign({ 'User-Agent': UA }, options.headers || {});
  const response = await fetch(fullUrl, opts);
  if (!response.ok) throw new Error(`Response not OK: ${response.status}`);
  const ct = response.headers.get('content-type');
  if (ct && ct.includes('application/json')) return response.json();
  return response.text();
}

function compareMedia(media, title, year) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  if (norm(media.title) !== norm(title)) return false;
  if (year && media.year && media.year !== year) return false;
  return true;
}

function getStreams(tmdbId, mediaType = 'movie', season = '', episode = '') {
  return (async () => {
    try {
      const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'movie' ? 'movie' : 'tv'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
      const tmdbResponse = await fetch(tmdbUrl);
      if (!tmdbResponse.ok) throw new Error(`TMDB failed: ${tmdbResponse.status}`);
      const tmdbData = await tmdbResponse.json();
      if (tmdbData.success === false) throw new Error('TMDB error');

      const mediaInfo = {
        title: mediaType === 'movie' ? tmdbData.title : tmdbData.name,
        year: parseInt(mediaType === 'movie'
          ? (tmdbData.release_date || '').split('-')[0]
          : (tmdbData.first_air_date || '').split('-')[0], 10)
      };
      if (!mediaInfo.title) throw new Error('No title from TMDB');

      const searchUrl = `/search.html?keyword=${encodeURIComponent(mediaInfo.title)}`;
      const searchHtml = await soaperFetch(searchUrl);
      const search$ = cheerio.load(searchHtml);
      const searchResults = [];
      search$('.thumbnail').each((_, el) => {
        const title = search$(el).find('h5 a').first().text().trim();
        const yearText = search$(el).find('.img-tip').first().text().trim();
        const url = search$(el).find('h5 a').first().attr('href');
        if (title && url) searchResults.push({ title, year: yearText ? parseInt(yearText, 10) : undefined, url });
      });

      const match = searchResults.find((x) => compareMedia(mediaInfo, x.title, x.year));
      if (!match) return [];
      let contentUrl = match.url;

      if (mediaType === 'tv') {
        const showHtml = await soaperFetch(contentUrl);
        const show$ = cheerio.load(showHtml);
        const seasonBlock = show$('h4')
          .filter((_, el) => show$(el).text().trim().split(':')[0].trim().toLowerCase() === `season${season}`)
          .parent();
        if (seasonBlock.length === 0) return [];
        const episodeLinks = [];
        seasonBlock.find('a').each((_, el) => {
          const numText = show$(el).text().split('.')[0];
          const epUrl = show$(el).attr('href');
          if (numText && epUrl) episodeLinks.push({ num: parseInt(numText, 10), url: epUrl });
        });
        const target = episodeLinks.find((ep) => ep.num === parseInt(episode, 10));
        if (!target) return [];
        contentUrl = target.url;
      }

      const contentHtml = await soaperFetch(contentUrl);
      const content$ = cheerio.load(contentHtml);
      const pass = content$('#hId').attr('value');
      if (!pass) return [];

      const infoEndpoint = mediaType === 'tv' ? '/home/index/getEInfoAjax' : '/home/index/getMInfoAjax';
      const body = `pass=${encodeURIComponent(pass)}&e2=0&server=0`;
      const headers = {
        'referer': `${BASE_URL}${contentUrl}`,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      };
      const infoResp = await soaperFetch(infoEndpoint, { method: 'POST', body, headers });
      const streamInfo = typeof infoResp === 'string' ? JSON.parse(infoResp) : infoResp;
      if (!streamInfo || !streamInfo.val || typeof streamInfo.val !== 'string') return [];

      const p = streamInfo.val;
      const finalUrl = p.startsWith('http') ? p : (p.startsWith('/') ? `${BASE_URL}${p}` : `${BASE_URL}/${p}`);

      return [{
        url: finalUrl,
        quality: 'Auto',
        provider: 'soapertv',
        title: `${mediaInfo.title}${mediaType === 'tv' ? ` S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}` : ''} - SoaperTV`,
        name: 'SoaperTV',
        behaviorHints: { notWebReady: true }
      }];
    } catch (e) {
      if (globalThis.console) console.log('[soapertv] ' + e.message);
      return [];
    }
  })();
}

module.exports = { getStreams };
