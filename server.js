import express from 'express';
import cors from 'cors';
import { Readable } from 'stream';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const DEPLEXO_BASE = "https://heisenbergbackaaahh.de.deplexo.com/a";
const AURIX_BASE = "https://addon-2.aurix.dpdns.org/free_rLnRPnC6oZF5gvAx";

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
      targetUrl = `${baseUrl}/manifest.json`;
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

    if (upstreamRes.status === 404 && isManifestRequest) {
      const altUrl = targetUrl.endsWith('/manifest.json')
        ? targetUrl.replace(/\/manifest\.json$/, '')
        : `${targetUrl}/manifest.json`;
      upstreamRes = await fetch(altUrl, fetchOptions);
    }

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

// Questa rotta risolve il problema della schermata bianca e del Cannot GET /
app.get('/', (req, res) => {
  res.send('BitChord Proxy Attivo e Funzionante!');
});

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});
