const express = require('express');
const app = express();
const multer = require('multer');
const vosk = require('vosk');
const AudioBufferToWav = require('audiobuffer-to-wav');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('./config');
const { createProxyMiddleware } = require('http-proxy-middleware');

const upload = multer();

const pDict = {};

const pronounciationFile = fs.readFileSync('pronounciation.txt', { encoding: 'utf8', flag: 'r' });
for (let line of pronounciationFile.split("\n")) {
  const [word, pron] = line.split("  ");
  pDict[word] = pron;
}

function getPronounciation(word) {
  return pDict[word.toUpperCase()] ?? "";
}

vosk.setLogLevel(2);

const model = new vosk.Model("./model");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

app.post("/api/pronounce", (req, res) => {
  const words = req.body.words ?? [];
  res.json({ 
    result: words.map(word => word.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
                 .map(word => getPronounciation(word))
  });
});


app.post('/api/process', upload.single('audio'), async (req, res) => {

  const oggBuffer = req.file.buffer;
  
  const rec = new vosk.Recognizer({
    model: model,
    sampleRate: 48000
  });
  rec.setMaxAlternatives(0);
  rec.setWords(true);
  console.log('Final result:', rec.finalResult(rec));
  const done = rec.acceptWaveform(oggBuffer);  
  res.json(rec.finalResult(rec));
  rec.free();
});


app.use(
  '/js/info.js', 
  createProxyMiddleware({ 
    target: config.TRACKER_DOMAIN, 
    changeOrigin: true,
    pathRewrite: { 
      '^/js/info.js': config.TRACKER_SCRIPT 
    } 
  })
);

app.use(
  '/api/event',
  createProxyMiddleware({
    target: config.TRACKER_DOMAIN,
    changeOrigin: true
  }),
);



module.exports = app;
