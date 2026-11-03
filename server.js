import express from 'express';
import { addonBuilder } from 'stremio-addon-sdk';

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// ADDON 1: Deplexo HiRes Bypass
// ==========================================
const deplexoBuilder = new addonBuilder({
  id: "com.deplexo.bitchord.hires",
  version: "1.0.0",
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

deplexoBuilder.defineCatalogHandler(() => Promise.resolve({ metas: [] }));

deplexoBuilder.defineStreamHandler((args) => {
  const trackId = args.id;
  const targetHost = "https://bitchord-hires-addon.de.deplexo.com";

  return Promise.resolve({
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
        url: `${targetHost}/pipe?id=${trackId}&quality=high`
      }
    ]
  });
});

const deplexoInterface = deplexoBuilder.getInterface();

// ==========================================
// ADDON 2: Aurix DPDNS Bypass
// ==========================================
const TOKEN = "free_rLnRPnC6oZF5gvAx";

const aurixBuilder = new addonBuilder({
  id: "org.dpdns.aurix.bitchord.free",
  version: "1.0.0",
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

aurixBuilder.defineCatalogHandler(() => Promise.resolve({ metas: [] }));

aurixBuilder.defineStreamHandler((args) => {
  const trackId = args.id;
  const baseUrl = `https://addon-2.aurix.dpdns.org/${TOKEN}`;

  return Promise.resolve({
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

const aurixInterface = aurixBuilder.getInterface();

// Router Express per gestire i due addon affiancati
app.use('/deplexo', (req, res) => {
  deplexoInterface.get(req, res);
});

app.use('/aurix', (req, res) => {
  aurixInterface.get(req, res);
});

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});
