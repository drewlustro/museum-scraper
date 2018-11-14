const puppeteer = require("puppeteer");
const fs = require("fs");
const request = require("request");

let scrapeUrls = async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  page.setViewport({ width: 1600, height: 1200 });

  await page.goto('https://www.artic.edu/collection?is_public_domain=1')
  await page.waitFor(3000);

  let times = 0, previousHeight = 0;
  try {
    while (times < 100) {
      previousHeight = await page.evaluate('document.body.scrollHeight');
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.click('[data-behavior="loadMore"]');
      await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
      times++;
    }
  } catch (err) {
    console.log('Caught Error:', err);
  }

  const urls = await page.$$eval('.o-collection-listing__colset a.m-listing__link', links => {
    return links.map(link => link.href);
  });

  console.log('Distinct URLS: ', urls, `Total Count: ${urls.length} URLs`);

  return urls;
};

// ----------------------------------------------------------------------

let downloadArt = async (pageUrls) => {
  const browser = await puppeteer.launch({
    headless: false
  });
  const page = await browser.newPage();
  page.setViewport({
    width: 1600,
    height: 1200
  });

  await page.goto('https://www.artic.edu/collection?is_public_domain=1')

  let url;
  let count = 1;
  try {
    while (url = pageUrls.pop()) {
      await page.goto(url);
      await page.waitFor(500);
      await page.click('button[data-gallery-download]') // download that shit
      console.log(`Downloaded ${count} images`)
      count++;
    }
  } catch (err) {
    console.log('Caught Error:', err);
  }
};

let run = async () => {
  const artworkPageUrls = await scrapeUrls();
  downloadArt(artworkPageUrls);
}

run();



