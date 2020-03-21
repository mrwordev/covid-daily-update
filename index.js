require('dotenv').config();
const fs = require('fs');
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const axios = require('axios');
const path = require('path');
const moment = require('moment');
const cheerio = require('cheerio');
const limit = require('express-rate-limit');
const endpoints = require('express-list-endpoints');

const PORT = process.env.PORT || 5000;
function allowCrossDomain(req, res, next) {
  res.header('Access-Control-Allow-Origin', process.env.APP_URL);
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.set('X-Frame-Options', 'DENY');
  next();
}

app.enable('trust proxy');
app.use(
  helmet({
    frameguard: {
      action: 'deny'
    }
  })
);
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.json({extended: false}));
app.use(allowCrossDomain);
app.use(cors({origin: true}));

// Limit request
const limiter = new limit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  delayMs: 0 // disable delaying - full speed until the max limit is reached
});
app.use(limiter);

// Process
const filename = path.join(
  __dirname,
  'sources',
  moment().format('DDMMYYYY') + '.html'
);
const exrtractFilename = path.join(
  __dirname,
  'extracted',
  moment().format('DDMMYYYY') + '.json'
);

app.get('/sync', async (req, res) => {
  if (!req.query.key || req.query.key != process.env.KEY)
    return res.status(403).send('Unauthorized');
  const result = await axios.get('https://www.worldometers.info/coronavirus/');
  fs.writeFile(filename, result.data, function(err) {
    if (err) throw err;
    res.status(200).send('Saved');
  });
});

app.get('/extract', async (req, res) => {
  if (!req.query.key || req.query.key != process.env.KEY)
    return res.status(403).send('Unauthorized');
  const result = {};
  const template = [
    'totalCases',
    'newCases',
    'totalDeaths',
    'newDeaths',
    'totalRecovered',
    'activeCases',
    'seriousCases',
    'perMilCases'
  ];
  fs.readFile(filename, (err, data) => {
    if (err) {
      return res.status(500).send(err);
    }

    const $ = cheerio.load(data);
    const table = $('#main_table_countries_today');
    const container = table.children('tbody')[0];
    const countries = $(container).children('tr');
    countries.each((index, country) => {
      const numbers = $(country).children('td');
      let currentCountry = null;
      numbers.each((_, number) => {
        const value = $(number).text();
        if (_ === 0) {
          result[value.toLowerCase()] = {};
          currentCountry = value.toLowerCase();
        } else {
          result[currentCountry][template[_ - 1]] = value.replace(',','').trim();
        }
      });
    });
    const stringify = JSON.stringify(result);
    fs.writeFile(exrtractFilename, stringify, function(err) {
      if (err) throw err;
      return res.status(200).send(result);
    });
  });
});

app.get('/data/:country', function(req, res) {
  fs.readFile(exrtractFilename, (err, data) => {
    const information = JSON.parse(data);
    try {
      return res.status(200).send(information[req.params.country]);
    } catch (error) {
      return res.status(404).send('Cannot find that country');
    }
  });
});

app.get('/data', function(req, res) {
  fs.readFile(exrtractFilename, (err, data) => {
    const information = JSON.parse(data);
    try {
      return res.status(200).send(information);
    } catch (error) {
      return res.status(404).send('Cannot find today data');
    }
  });
});

app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initiate website
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
endpoints(app);

// CRON Job
const cron = require('cron').CronJob;
const job = new cron('0 */6 * * *', function() {
  // Sync data
  await axios.get('/sync?key='+process.env.KEY);
  // Extract data
  await axios.get('/extract?key='+process.env.KEY);
}, null, true, 'Asia/Bangkok');
job.start();