const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const request = require("request");

const TIMEOUT_MS = 3000;
const MAX_ATTEMPTS = 100;
const MAX_ERRORS = 30;

let scrapeUrls = async (page) => {
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

  let attempts = 0, previousHeight = 0, errors = 0;
  while (attempts <= MAX_ATTEMPTS) {
    if (errors > MAX_ERRORS) break;

    try {
      attempts++;
      console.log(`Attempt ${attempts} of ${MAX_ATTEMPTS} attempts (max)`)
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
      console.log('', 'Caught Error:', err, '');
      console.log(`Error ${errors} of ${MAX_ERRORS} errors (max)`)
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
  await page.setRequestInterception(false);
  let url;
  let count = 0, errors = 0;
  try {
    while (url = pageUrls.pop()) {
      console.log(`[fetch] ${url} ...`);
      if (typeof url !== 'string') continue;
      if (errors > MAX_ERRORS) break;

      console.log(`Downloaded ${count} images`)
      count++;

      await page.goto(url, {
        waitFor: 'networkidle2',
        timeout: TIMEOUT_MS * 2
      });

      // download that shit
      await page.click('button[data-gallery-download]')
    }
  } catch (err) {
    console.log('', 'Caught Error:', err, '');
    console.log(`Error ${errors} of ${MAX_ERRORS} errors (max)`)
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


  // fetch
  // const artworkPageUrls = await scrapeUrls(page);

  // read
  const json = await fs.readFile('./artwork-urls.json');
  const artworkPageUrls = JSON.parse(json);
  console.log(`Total ${artworkPageUrls.length} URLs`);

  // write
  // save to file just in case
  // const json = JSON.stringify(artworkPageUrls);
  // await fs.writeFile('./artwork-urls.json', json);

  // download
  await downloadArt(page, artworkPageUrls);
  // await browser.close();
}

run();



