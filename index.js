const puppeteer = require("puppeteer");
const fs = require("fs");
const request = require("request");

const TIMEOUT_MS = 3000;
const MAX_PAGES = 100;
const MAX_ERRORS = 15;

let scrapeUrls = async (page) => {
  await page.goto('https://www.artic.edu/collection?is_public_domain=1')

  let times = 0, previousHeight = 0, errors = 0;
  while (times <= MAX_PAGES && errors <= MAX_ERRORS) {
    try {
      times++;
      console.log(`Page ${times} of ${MAX_PAGES} (max pages)`)
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
      console.log('Caught Error:', err);
      errors++;
    }
  }

  const urls = await page.$$eval('.o-collection-listing__colset a.m-listing__link', links => {
    return links.map(link => link.href);
  });

  console.log(`Total Distinct URL Count: ${urls.length}`);

  return urls;
};

// ----------------------------------------------------------------------

let downloadArt = async (page, pageUrls) => {
  let url;
  let count = 1, errors = 0;;
  try {
    while (url = pageUrls.pop() && errors <= MAX_ERRORS) {
      await page.goto(url, {
        waitFor: 'networkidle2',
        timeout: TIMEOUT_MS * 2
      });
      await page.click('button[data-gallery-download]') // download that shit
      console.log(`Downloaded ${count} images`)
      count++;
    }
  } catch (err) {
    console.log('Caught Error:', err);
    errors++;
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

  page.setDefaultNavigationTimeout(TIMEOUT_MS)

  await page.setRequestInterception(true);
  page.on('request', request => {
    if (request.resourceType() === 'image')
      request.abort();
    else
      request.continue();
  });

  const artworkPageUrls = await scrapeUrls(page);
  await downloadArt(page, artworkPageUrls);
  await browser.close();
}

run();



