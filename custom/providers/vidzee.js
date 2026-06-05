// VidZee provider — ported to Nuvio getStreams for the Tizen/Chromium-47 runtime.
// Source: tapframe/NuvioStreamsAddon providers/VidZee.js
// Changes: axios -> global fetch, dropped process.env proxy/argv (not available on TV),
// renamed export to getStreams.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const REFERER = 'https://core.vidzee.wtf/';

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return (async () => {
    if (!tmdbId || (mediaType !== 'movie' && mediaType !== 'tv')) return [];
    if (mediaType === 'tv' && (!seasonNum || !episodeNum)) return [];

    const servers = [3, 4, 5];
    const perServer = servers.map(async (sr) => {
      let apiUrl = `https://player.vidzee.wtf/api/server?id=${tmdbId}&sr=${sr}`;
      if (mediaType === 'tv') apiUrl += `&ss=${seasonNum}&ep=${episodeNum}`;
      try {
        const res = await fetch(apiUrl, { headers: { 'Referer': REFERER, 'User-Agent': UA } });
        if (!res.ok) return [];
        const data = await res.json();
        if (!data || typeof data !== 'object') return [];

        let apiSources = [];
        if (Array.isArray(data.url)) apiSources = data.url;
        else if (typeof data.link === 'string') apiSources = [data];
        if (!apiSources.length) return [];

        return apiSources.map((item) => {
          const label = item.name || item.type || 'VidZee';
          const quality = String(label).match(/^\d+$/) ? `${label}p` : label;
          return {
            title: `VidZee S${sr} - ${quality}`,
            name: 'VidZee',
            url: item.link,
            quality,
            language: item.language || item.lang,
            provider: 'vidzee',
            behaviorHints: { notWebReady: true, headers: { 'Referer': REFERER } }
          };
        }).filter((s) => s.url);
      } catch (e) {
        return [];
      }
    });

    const nested = await Promise.all(perServer);
    return nested.flat();
  })();
}

module.exports = { getStreams };
