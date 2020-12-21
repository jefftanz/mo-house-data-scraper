var lodash = require('lodash');
var fs = require('fs');

const puppeteer = require('puppeteer');
const { type } = require('os');

// Boilerplate stuff
async function startBrowser() {
  const browser = await puppeteer.launch({ headless: false, devtools: true});
  const page = await browser.newPage();
  return {browser, page};
}

async function closeBrowser(browser) {
  return browser.close();
}

// Normalizing the text
function getText(linkText) {
  linkText = linkText.replace(/\r\n|\r/g, "\n");
  linkText = linkText.replace(/\ +/g, " ");

  // Replace &nbsp; with a space 
  var nbspPattern = new RegExp(String.fromCharCode(160), "g");
  return linkText.replace(nbspPattern, " ");
}

function getInt(data, text){
  let filterValue = data.filter(td => td.includes(text));
  let value = filterValue.length > 0 ? filterValue[0].replace(text, '').trim() : 0;
  return parseInt(value);
}

function getFloat(data, text){
  let value;
  let filterValue = data.filter(td => td.includes(text));
  
  if (filterValue.length > 0){
    value = filterValue[0].replace(text, '').trim();
    value = value.replace(',', '');
  }
  return parseFloat(value);
}

function getStr(data, text){
  let filterValue = data.filter(td => td.includes(text));
  let value = filterValue.length > 0 ? filterValue[0].replace(text, '').trim() : '';
  return value;
}

// find the link, by going over all links on the page
async function findByLink(page, linkString) {
  const links = await page.$$('a')
  for (var i=0; i < links.length; i++) {
    let valueHandle = await links[i].getProperty('innerText');
    let hrefHandle = await links[i].getProperty('href');
    let linkUrl = await hrefHandle.jsonValue();
    let linkText = await valueHandle.jsonValue();
    const text = getText(linkText);

    // console.log('link ' + i + ' : ' + text);

    if (linkString == text) {
      console.log('Search: ' + linkString);
      console.log('Found: ' + text);
      console.log('Url: ' + linkUrl);
      //console.log("Found");
      return linkUrl;
    }

  }
  return null;
}

async function getZipData(url) {

  let houseData = [];

  const {browser, page} = await startBrowser();
  page.setViewport({width: 1366, height: 768});
  await page.goto(url);

  // Get ZipCode drop down input
  const zipcodeInput = await page.$$('[name="searchZipCode"]')
  console.log('zipcodeInput: ' + zipcodeInput);

  // Get option value of 6330 zipcode by text
  const zipOption = (await page.$x(
    '//*[@id = "searchZipCode"]/option[text() = "6330"]'
  ))[0];

  // Select the ZipCode drop down input value found above
  const zipValue = await (await zipOption.getProperty('value')).jsonValue();
  await page.select('#searchZipCode', zipValue);

  // Get Search Button
  const searchButton = await page.$$('[value="Search"]')
  console.log('button: ' + searchButton);

  // Sample logging issue to console
  searchButton ? await page.click('[value="Search"]') : console.log('Could not find Search Button');

  // Wait for the page reload
  await page.waitForSelector('table');

  // Set Results to 500 a page

  // Get Page drop down input
  const perPageInput = await page.$$('[name="results_per_page"]');
  console.log('results_per_page: ' + perPageInput);

  // Get option value of 500 by text
  // const pageOption = (await page.$x(
  //   '//*[@name = "results_per_page"]/option[text() = "500"]'
  // ))[0];

  // console.log('pageOption: ' + pageOption);

  // Select the Per Page drop down input value found above
  // const pageValue = await (await pageOption.getProperty('value')).jsonValue();
  // await page.select('[name="results_per_page"]', pageValue);

  // Wait for the page reload
  // await page.waitForSelector('table');

  // const perPageInput = await page.$$('[name="results_per_page"]');

  //return tds.map(td => td.textContent);
  
  const urls = await page.evaluate(() => {
    anchors = Array.from(document.querySelectorAll('table tr td a'));
    return anchors.map(anchor => anchor.getAttribute("href"));
  });

  // const link = urls[0];

  let link = '';
  for (let i=0; i < urls.length; i++){
    link = urls[i];

    const tabPage = await browser.newPage();

    console.log(`loading page: ${link}`);
    await tabPage.goto(link, {
      waitUntil: 'networkidle0',
      timeout: 120000,
    });
  
    const trData = await tabPage.evaluate(() => {
      tds = Array.from(document.querySelectorAll('table tr td'));
      return tds.map(td => td.innerText);
    });
  
    let dataModel = {
      accountNumber: getStr(trData, 'Account Number:'),
      parcelId: getStr(trData, 'Parcel ID:'),
      propertyAddress: getStr(trData, 'Property Address:'),
      schoolDistrict: getStr(trData, 'School District:'),
      city: getStr(trData, 'City:'),
      fireDistrict: getStr(trData, 'Fire District:'),
      neighborhoodCode: getStr(trData, 'Neighborhood Code:'),
      subdivision: getStr(trData, 'Subdivision:'),
      legalDescription: getStr(trData, 'Legal Description:'),
      lotSize: getStr(trData, 'Lot Size:'),
      yearBuilt: getStr(trData, 'Year Built:'),
      propertyType: getStr(trData, 'Property Type:'),
      qualityCode: getStr(trData, 'Quality Code:'),
      architecturalType: getStr(trData, 'Architectural Type:'),
      bedrooms: getInt(trData, 'Bedrooms:'),
      totalArea: getFloat(trData, 'Total Area:'),
      bathrooms: getInt(trData, 'Bathrooms:'),
      baseArea: getFloat(trData, 'Base Area:'),
      halfBathrooms: getInt(trData, 'Half Bathrooms:'),
      parkingArea: getFloat(trData, 'Parking Area:'),
      totalRooms: getInt(trData, 'Total Rooms: '),
      basementArea: getFloat(trData, 'Basement Area'),
      finishedBasementArea: getFloat(trData, 'Finished Basement Area:'),
    }
  
    console.log('data: ' + JSON.stringify(dataModel))
    console.log(`closing page: ${url}`);
    await tabPage.close();
  
    houseData.push(dataModel);
    console.log('json data added to array');
  }

  // const fs = require('fs');
  fs.writeFile('./house-data.json', JSON.stringify(houseData), err => err ? console.log(err): null);
  console.log('Data written to house-data.json');


  // let accountNumberFilter = trData.filter(td => td.includes('Account Number:'));
  // if (accountNumberFilter.length > 0){
  //   accountNumber = accountNumberFilter[0].replace('Account Number:', '').trim();
  // }
  // console.log('Account Number: ' + accountNumber);


  // const urls = [
  //   'https://www.google.com',
  //   'https://www.duckduckgo.com',
  //   'https://www.bing.com',
  // ];
  // const pdfs = urls.map(async (url, i) => {
  //   const page = await browser.newPage();

  //   console.log(`loading page: ${url}`);
  //   await page.goto(url, {
  //     waitUntil: 'networkidle0',
  //     timeout: 120000,
  //   });

  //   console.log(`saving as pdf: ${url}`);
  //   await page.pdf({
  //     path: `${i}.pdf`,
  //     format: 'Letter',
  //     printBackground: true,
  //   });

  //   console.log(`closing page: ${url}`);
  //   await page.close();
  // });

  // Promise.all(pdfs).then(() => {
  //   browser.close();
  // });


  // console.log('data length: ' + hrefData.length);
  // for (let i=0; i < hrefData.length; i++){
  //   console.log(i + ': ' + hrefData[i]);
  // }

}

(async () => {
  await getZipData("https://lookups.sccmo.org/assessor");
  // process.exit(1);
})();

