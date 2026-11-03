import express from 'express';
import cors from 'cors';
import { Readable } from 'stream';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Funzione che rimuove il blocco checkValidLossless: 1 di BitChord
function removeLosslessLock(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeLosslessLock);

  delete obj.checkValidLossless;
  delete obj.requiresLosslessOutput;
  delete obj.losslessOnly;
  delete obj.requireLossless;

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      removeLosslessLock(obj[key]);
    }
  }
  return obj;
}

async function forwardRequest(targetBase, subPath, proxyPrefix, req, res) {
  try {
    const cleanBase = targetBase.replace(/\/manifest\.json$/, '').replace(/\/$/, '');
    const cleanSub = (!subPath || subPath === '/') ? '/manifest.json' : subPath;
    const targetUrl = `${cleanBase}${cleanSub}`;

    console.log(`[PROXY] ${req.method} -> ${targetUrl}`);

    const headers = {
      'user-agent': req.headers['user-agent'] || 'BitChord/1.8.2 (Android)',
      'accept': req.headers['accept'] || 'application/json, */*'
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

    const upstreamRes = await fetch(targetUrl, fetchOptions);

    // Gestione redirect diretti allo stream FLAC
    if ([301, 302, 303, 307, 308].includes(upstreamRes.status)) {
      const location = upstreamRes.headers.get('location');
      if (location) return res.redirect(upstreamRes.status, location);
    }

    const contentType = upstreamRes.headers.get('content-type') || '';

    // Intercetta tutti i JSON (manifest, search, stream) e rimuove checkValidLossless
    if (cleanSub.includes('manifest.json') || contentType.includes('application/json')) {
      const text = await upstreamRes.text();
      try {
        let data = JSON.parse(text);
        data = removeLosslessLock(data);

        const proxyFullBase = `https://${req.get('host')}${proxyPrefix}`;
        let jsonStr = JSON.stringify(data);
        jsonStr = jsonStr.replaceAll(cleanBase, proxyFullBase);

        return res.status(upstreamRes.status).set('Content-Type', 'application/json').send(jsonStr);
      } catch {
        return res.status(upstreamRes.status).set('Content-Type', contentType || 'text/plain').send(text);
      }
    }

    // Pass-through per flussi audio
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
    console.error('Errore Proxy:', err);
    res.status(500).json({ error: err.message });
  }
}

// 1. ROTTA AURIX (con il tuo token già configurato)
app.use('/aurix', (req, res) => {
  const base = "https://addon-2.aurix.dpdns.org/free_rLnRPnC6oZF5gvAx";
  const subPath = req.originalUrl
    .replace(/^\/aurix/, '')
    .replace(/^\/free_rLnRPnC6oZF5gvAx/, '');
  forwardRequest(base, subPath, '/aurix', req, res);
});

// 2. ROTTA DEPLEXO (accetta anche il token generato dalla pagina Deplexo)
app.use('/deplexo', (req, res) => {
  const base = "https://bitchord-hires-addon.de.deplexo.com";
  const subPath = req.originalUrl.replace(/^\/deplexo/, '');
  forwardRequest(base, subPath, '/deplexo', req, res);
});

app.get('/', (req, res) => {
  res.send('BitChord Lossless Unlocker Online!');
});

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});
