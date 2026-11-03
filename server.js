import express from 'express';
import cors from 'cors';
import { Readable } from 'stream';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const DEPLEXO_BASE = "https://bitchord-hires-addon.de.deplexo.com";
const AURIX_BASE = "https://addon-2.aurix.dpdns.org/free_rLnRPnC6oZF5gvAx";

// Rimuove il blocco lossless dai JSON mostrati nelle tue foto
function unlockManifest(data) {
  if (!data || typeof data !== 'object') return data;
  delete data.checkValidLossless;
  data.allowDownloads = true;
  return data;
}

async function handleProxy(addonType, req, res) {
  try {
    const baseUrl = addonType === 'deplexo' ? DEPLEXO_BASE : AURIX_BASE;
    let subPath = req.originalUrl.replace(new RegExp(`^/${addonType}`), '');

    if (addonType === 'aurix') {
      subPath = subPath.replace(/^\/free_rLnRPnC6oZF5gvAx/, '');
    }

    let targetUrl;
    const isManifestRequest = (subPath === '' || subPath === '/' || subPath === '/manifest.json');

    if (isManifestRequest) {
      // Deplexo risponde sulla radice /, mentre Aurix vuole /manifest.json
      targetUrl = addonType === 'deplexo' ? `${DEPLEXO_BASE}/` : `${AURIX_BASE}/manifest.json`;
    } else {
      targetUrl = `${baseUrl}${subPath}`;
    }

    const headers = {
      'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'accept': req.headers['accept'] || '*/*'
    };
    if (req.headers['range']) headers['range'] = req.headers['range'];
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];

    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'manual'
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    let upstreamRes = await fetch(targetUrl, fetchOptions);

    // Fallback automatico: se Deplexo o Aurix danno 404 sul manifest, prova l'altro formato
    if (upstreamRes.status === 404 && isManifestRequest) {
      const altUrl = targetUrl.endsWith('/manifest.json')
        ? `${baseUrl}/`
        : `${baseUrl}/manifest.json`;
      upstreamRes = await fetch(altUrl, fetchOptions);
    }

    // Se l'addon fa redirect verso il file FLAC, reindirizza BitChord direttamente
    if ([301, 302, 303, 307, 308].includes(upstreamRes.status)) {
      const location = upstreamRes.headers.get('location');
      if (location) return res.redirect(upstreamRes.status, location);
    }

    const contentType = upstreamRes.headers.get('content-type') || '';

    if (isManifestRequest || contentType.includes('application/json')) {
      const text = await upstreamRes.text();
      try {
        let json = JSON.parse(text);
        json = unlockManifest(json);
        return res.status(upstreamRes.status).set('Content-Type', 'application/json').send(JSON.stringify(json));
      } catch {
        return res.status(upstreamRes.status).set('Content-Type', contentType || 'text/plain').send(text);
      }
    }

    // Pass-through per lo streaming audio
    res.status(upstreamRes.status);
    ['content-type', 'content-length', 'accept-ranges', 'content-range', 'cache-control'].forEach((h) => {
      const val = upstreamRes.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    if (upstreamRes.body) {
      Readable.fromWeb(upstreamRes.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error(`Errore [${addonType}]:`, err);
    res.status(500).json({ error: err.message });
  }
}

app.use('/deplexo', (req, res) => handleProxy('deplexo', req, res));
app.use('/aurix', (req, res) => handleProxy('aurix', req, res));

app.get('/', (req, res) => {
  res.send('BitChord Proxy Attivo!');
});

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});
