const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const request = require("request");
const logSymbols = require('log-symbols');
const progress = require('progress');
const chalk = require('chalk');

const log = console.log;
const info = () => log(logSymbols.info, chalk.gray(Array.from(arguments).join(' ')));
const infowarm = () => log(logSymbols.info, chalk.yellow(Array.from(arguments).join(' ')));
const warn = () => log(logSymbols.warning, ...arguments);
const error = () => log(logSymbols.error, ...arguments);
const success = () => log(logSymbols.success, ...arguments);
const hr = () => log(chalk.dim('------------------------------'));

const TIMEOUT_MS = 3000;
const MAX_ATTEMPTS = 100;
const MAX_EXCEPTIONS = 30;

const PROGRESS_TEMPLATE = ':current/:total  [:bar] :percent    :eta sec remain'

let scrapeUrls = async (page) => {
  const bar = new progress(PROGRESS_TEMPLATE, {
    total: MAX_ATTEMPTS,
    width: 60,
    complete: '◽️',
    incomplete: ' ',
  });

  await page.setRequestInterception(true);

  page.on('request', request => {
    if (request.resourceType() === 'image') {
      request.abort();
    } else {
      request.continue();
    }
  });

  await page.goto('https://www.artic.edu/collection?is_public_domain=1')
  await page.waitFor(2000, {
    timeout: TIMEOUT_MS
  });

  let attempts = 0, previousHeight = 0, exceptions = 0;

  while (attempts <= MAX_ATTEMPTS) {
    if (exceptions > MAX_EXCEPTIONS) break;

    try {
      if (!bar.complete) bar.tick();

      attempts++;
      info(`Attempt ${attempts} of ${MAX_ATTEMPTS} attempts (max)`)

      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight - 200)');
      await page.waitFor('[data-behavior="loadMore"]', { timeout: TIMEOUT_MS });
      await page.click('[data-behavior="loadMore"]', {
        delay: 20
       });
      await page.waitFor(100, { timeout: TIMEOUT_MS });
      await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`, {
        timeout: TIMEOUT_MS
      });

    } catch (err) {
      error('Caught Exception')
      hr();
      info(err);
      hr();

      error(`Exception ${exceptions} of ${MAX_EXCEPTIONS} exceptions (max)`)
      exceptions++;
    }
  }

  const urls = await page.$$eval('.o-collection-listing__colset a.m-listing__link', links => {
    return links.map(link => link.href);
  });

  success(`Total Distinct URL Count: ${urls.length}`);

  return urls;
};

// ----------------------------------------------------------------------

let downloadArt = async (page, pageUrls) => {
  const sanitizedUrls = pageUrls.filter(url => typeof url === 'string');

  const bar = new progress(PROGRESS_TEMPLATE, {
    total: sanitizedUrls.length,
    width: 60,
    complete: '◽️',
    incomplete: ' ',
  });

  await page.setRequestInterception(false);

  let url;
  let count = 0;

  while (url = sanitizedUrls.pop()) {
    try {
      if (!bar.complete) bar.tick();
      infowarm(`[fetch] ${url} ...`);
      count++;

      await page.goto(url, {
        waitFor: 'networkidle2',
        timeout: TIMEOUT_MS * 2
      });

      // download that shit
      await page.click('button[data-gallery-download]')
      success(`Downloading image ${count}`)

    } catch (err) {
      error('Caught Exception')
      hr();
      info(err);
      hr();
    }
  }
};

let run = async () => {
  const browser = await puppeteer.launch({
    headless: false
  });

  const page = await browser.newPage();
  page.setViewport({
    width: 1600,
    height: 1200
  });

  // page.setDefaultNavigationTimeout(TIMEOUT_MS)

  // [fetch]
  const artworkPageUrls = await scrapeUrls(page);

  // [write]
  // save to file just in case
  // const json = JSON.stringify(artworkPageUrls);
  // await fs.writeFile('./artwork-urls.json', json);

  // [read]
  // const jsonText = await fs.readFile('./artwork-urls.json');
  // const artworkPageUrls = JSON.parse(jsonText);
  // success(`Total ${artworkPageUrls.length} URLs`);

  // download
  await downloadArt(page, artworkPageUrls);
}

run();



