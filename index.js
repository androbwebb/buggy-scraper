const axios = require('axios');
const cheerio = require('cheerio');
const bluebird = require('bluebird');

const PAGE_CACHE = {};

const fetchPageFromCache = async (url) => {
    if (PAGE_CACHE[url]) {
        return PAGE_CACHE[url];
    }

    const { data } = await axios.get(url);
    PAGE_CACHE[url] = data;

    return data;
}

const scrapeProductData = async (baseUrl) => {
    const products = [];

    try {
        const content = await fetchPageFromCache(baseUrl);
        const $ = cheerio.load(content);

        const productElements = $('.product');

        await bluebird.map(productElements, async (element, index) => {
            const title = $(element).find('.text-xl.truncate').text();
            const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            const productUrl = `${baseUrl}items/${slug}.html`;
            const image = $(element).find('img').attr('src');

            let description = $(element).find('.text-gray-700.text-base').text().trim();
            let price = $(element).find('.price').text().replace('$', '');
            let tags = $(element).find('.tags span').map((index, element) => $(element).text()).get();
            let weight = null;
            let reviewCount = null;
            let averageStars = null;

            try {
                // If we can get more specific data by following the link, do so
                const productPageContent = await fetchPageFromCache(productUrl);
                const p$ = cheerio.load(productPageContent);

                // Try to get more specific data:
                price = p$('head').find('meta[property="og:price:amount"]').attr('content');
                weight = p$('.weight').text().replace('Weight: ', '');
                reviewCount = p$('.reviews .review').length;
                const totalStars = p$('.reviews .review').map((index, element) => {
                    return Number(p$(element).attr('data-stars'));
                }).get().filter((a) => a !== undefined).reduce((a, b) => a + b, 0);
                averageStars = totalStars / reviewCount;

            } catch (error) {
                // Couldn't get the product page, that's ok. Just use the data from the list page.
                return;
            }

            products.push({ productUrl, title, price, image, description, weight, tags, reviewCount, averageStars });
        }, { concurrency: 5 });
        
    } catch (error) {
        console.error(`Error: ${error}`);
    }

    return products;
};

// Usage:
scrapeProductData('https://bad-scrapper-3eac18dceb0d.herokuapp.com/').then(products => console.log(products));
