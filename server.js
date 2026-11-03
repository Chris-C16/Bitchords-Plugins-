import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

const PORT = process.env.PORT || 10000;

// Middleware di fallback per qualsiasi rotta di catalogo/ricerca inviata da BitChord
const handleCatalogRequest = (req, res) => {
  res.json({ metas: [] });
};

// ==========================================
// ADDON 1: Deplexo HiRes Bypass
// ==========================================
app.get('/deplexo/manifest.json', (req, res) => {
  res.json({
    id: "com.deplexo.bitchord.hires",
    version: "1.0.7",
    name: "BitChord HiRes Addon",
    description: "Bypasses lossless playback limitation with auto-fallback stream configuration.",
    resources: ["stream", "catalog"],
    types: ["music"],
    catalogs: [
      {
        type: "music",
        id: "deplexo_catalog",
        name: "Deplexo HiRes",
        extra: [{ name: "search", isRequired: false }]
      }
    ]
  });
});

// Gestione rotte cataloghi e ricerca per Deplexo
app.get('/deplexo/catalog/*', handleCatalogRequest);

// Gestione flussi audio per Deplexo
app.get('/deplexo/stream/:type/:id.json', (req, res) => {
  const trackId = req.params.id;
  const targetHost = "https://bitchord-hires-addon.de.deplexo.com";

  res.json({
    streams: [
      {
        name: "Lossless (FLAC)",
        title: "FLAC 24-bit / 96kHz (Direct)",
        url: `${targetHost}/pipe?id=${trackId}&quality=flac`,
        behaviorHints: {
          notSupportedFallback: true,
          proxyHeaders: {
            "user-agent": "BitChordPlayer/2.0",
            "accept": "audio/flac, audio/mp4, audio/*"
          }
        }
      },
      {
        name: "High Quality (AAC)",
        title: "AAC 320kbps (Bypass Fallback)",
        url: `${targetHost}/pipe?id=${targetHost}&quality=high`
      }
    ]
  });
});

// ==========================================
// ADDON 2: Aurix DPDNS Bypass
// ==========================================
const TOKEN = "free_rLnRPnC6oZF5gvAx";

app.get('/aurix/manifest.json', (req, res) => {
  res.json({
    id: "org.dpdns.aurix.bitchord.free",
    version: "1.1.5",
    name: "Aurix Free Lossless Bypass",
    description: "Bypasses BitChord native decoder strict check for Aurix token streams.",
    resources: ["stream", "catalog"],
    types: ["music"],
    idPrefixes: ["aurix:"],
    catalogs: [
      {
        type: "music",
        id: "aurix_catalog",
        name: "Aurix Free",
        extra: [{ name: "search", isRequired: false }]
      }
    ]
  });
});

// Gestione rotte cataloghi e ricerca per Aurix
app.get('/aurix/catalog/*', handleCatalogRequest);

// Gestione flussi audio per Aurix
app.get('/aurix/stream/:type/:id.json', (req, res) => {
  const trackId = req.params.id;
  const baseUrl = `https://addon-2.aurix.dpdns.org/${TOKEN}`;

  res.json({
    streams: [
      {
        title: "FLAC Lossless (Bypassed)",
        url: `${baseUrl}/audio/${trackId}`,
        behaviorHints: {
          isLive: false,
          supportDirectPlay: true,
          headers: {
            "User-Agent": "Mozilla/5.0 (Android; Mobile)",
            "Accept-Encoding": "identity",
            "Content-Type": "audio/flac"
          }
        }
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});
