import express from 'express';
import cors from 'cors';
import { Readable } from 'stream';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// I tuoi due link originali
const UPSTREAMS = {
  deplexo: "https://bitchord-hires-addon.de.deplexo.com",
  aurix: "https://addon-2.aurix.dpdns.org/free_rLnRPnC6oZF5gvAx"
};

// Funzione che elimina il blocco dell'output lossless dal JSON
function stripLosslessLock(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripLosslessLock);

  delete obj.checkValidLossless;
  delete obj.requiresLosslessOutput;
  delete obj.losslessOnly;
  delete obj.requireLossless;

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      stripLosslessLock(obj[key]);
    }
  }
  return obj;
}

async function proxyAddon(addonKey, req, res) {
  try {
    const baseUrl = UPSTREAMS[addonKey];
    let subPath = req.originalUrl.replace(new RegExp(`^/${addonKey}`), '');

    // Pulisce eventuale token duplicato nell'URL
    if (addonKey === 'aurix') {
      subPath = subPath.replace(/^\/free_rLnRPnC6oZF5gvAx/, '');
    }

    if (!subPath || subPath === '/') {
      subPath = '/manifest.json';
    }

    const targetUrl = `${baseUrl}${subPath}`;

    // Passa l'User-Agent reale di BitChord (necessario perché i server non rispondano errore)
    const headers = {
      'user-agent': req.headers['user-agent'] || 'BitChord/1.9 (Android)',
      'accept': req.headers['accept'] || '*/*'
    };
    if (req.headers['range']) {
      headers['range'] = req.headers['range'];
    }
    if (req.headers['content-type']) {
      headers['content-type'] = req.headers['content-type'];
    }

    const fetchOptions = {
      method: req.method,
      headers,
      redirect: 'manual'
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const upstreamRes = await fetch(targetUrl, fetchOptions);

    // Se l'addon originale reindirizza al flusso FLAC diretto, gira il redirect a BitChord
    if ([301, 302, 303, 307, 308].includes(upstreamRes.status)) {
      const location = upstreamRes.headers.get('location');
      if (location) {
        return res.redirect(upstreamRes.status, location);
      }
    }

    const contentType = upstreamRes.headers.get('content-type') || '';

    // Se è il manifest o una risposta JSON, rimuove il blocco checkValidLossless
    if (subPath.includes('manifest.json') || contentType.includes('application/json')) {
      const text = await upstreamRes.text();
      try {
        let data = JSON.parse(text);
        data = stripLosslessLock(data);

        const proxyBase = `https://${req.get('host')}/${addonKey}`;
        let jsonString = JSON.stringify(data);
        jsonString = jsonString.replaceAll(baseUrl, proxyBase);

        return res.status(upstreamRes.status).set('Content-Type', 'application/json').send(jsonString);
      } catch {
        return res.status(upstreamRes.status).set('Content-Type', contentType || 'text/plain').send(text);
      }
    }

    // Inoltro diretto per eventuali stream audio
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
    console.error(`Errore proxy [${addonKey}]:`, err);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
}

app.use('/deplexo', (req, res) => proxyAddon('deplexo', req, res));
app.use('/aurix', (req, res) => proxyAddon('aurix', req, res));

app.get('/', (req, res) => {
  res.send('BitChord Proxy Addons attivo!');
});

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});
