/** Bottom level scraping algorithm */

const puppeteer = require('puppeteer') // headless browser library


// constants
const URLS = {
    browse: "https://www.netflix.com/browse",
    genreBase: 'https://www.netflix.com/browse/genre/',
    titleBase: 'https://www.netflix.com/title/',
    login: "https://www.netflix.com/login",
    films: "https://www.netflix.com/browse/genre/34399",
    series: "https://www.netflix.com/browse/genre/83",
    alphabetical: "?so=su",
    searchBase: "https://www.netflix.com/search?q=",
}
const SELECTORS = {
    email: "#id_userLoginId",
    password: "#id_password",
    profileList: "#appMountPoint > div > div > div:nth-child(1) > div.bd.dark-background > div.profiles-gate-container > div > div > ul",
    genreButton: 'div[label="Genres"] > div',
    genres: 'div[label="Genres"] > div + div li > a',
    link: ".slider-refocus",
    title: "div.boxart-container",
    fallbackName: "p.fallback-text",
    thumbnail: "img.boxart-image",
    release: "div.year",
    contentRating: "span.maturity-number",
    duration: "span.duration",
    imageDefinition: "span.player-feature-badge",
    description: "p.preview-modal-synopsis",
    name: "h3.previewModal--section-header > strong",
    aboutChildren: "div.about-container > div.previewModal--tags",
    sectionName: "span.previewModal--tags-label",
    aboutTags: "span.tag-item",
    ratingReason: "p.specificRatingReason",
    maturityDescription: "p.maturityDescription",
    episodeDuration: "div.titleCardList-title > span > span.ellipsized",
    audioDescription: "span.audio-description-badge"
}
const DELAYS = {
    scroll: 1000,
    loading: 3000,
}
const WAIT_OPTIONS = { waitUntil: "networkidle2", timeout: 0 } // no timeout
const isHeadless = true



/** 
 * Launch browser and return blank page
 * 
 * @returns {Object} puppeteer webpage object
 */
const launch = async () => {
    console.log(`Launching ${isHeadless ? "headless " : ""}browser...`)
    const browser = await puppeteer.launch({ headless: isHeadless, handleSIGINT: false }) // turn off handle signal interrupt to allow travel.js to handle it
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 800 }) // I think it helps
    return page
}


/** 
 * Open Netflix with cookies
 * 
 * @param {Object} cookies - personal Netflix account and profile cookies
 * @returns {Object} page logged into Netflix
 */
const openNetflix = async (cookies) => {
    const page = await launch()

    console.log("Opening Netflix with cookies...")
    await page.setCookie(...cookies)
    await page.goto(URLS.browse, WAIT_OPTIONS)
    return page
}


/**
 * Scrape all genres from an open dropdown menu
 * 
 * @param {string} nameExtension - either "Films" or "Programmes" to add to genre name
 * @returns {Object} list of genres
 */
const evaluateGenres = (nameExtension) => {
    console.log(`Scraping ${nameExtension.toLowerCase()} genres...`)
    const genreSelectors = document.querySelectorAll(SELECTORS.genres)
    const genres = []
    for (const genreSelector of genreSelectors) genres.push({
        name: genreSelector.innerText + nameExtension,
        id: genreSelector.pathname.substr(genreSelector.pathname.lastIndexOf('/') + 1)
    })
    return genres
}


/** 
 * Scrapes genres as objects with name and id
 * 
 * @param {Object} page - puppeteer webpage object
 * @returns {Object} list of genres
 */
const scrapeGenres = async (page) => {
    await page.goto(URLS.films, WAIT_OPTIONS)
    await page.click(SELECTORS.genreButton)
    const filmGenres = await page.evaluate(evaluateGenres, SELECTORS.genres, " Films")

    await page.goto(URLS.series, WAIT_OPTIONS)
    await page.click(SELECTORS.genreButton)
    const seriesGenres = await page.evaluate(evaluateGenres, SELECTORS.genres, " Programmes")

    return filmGenres.concat(seriesGenres)
}


/** 
 * Scrape all ids from a genre
 * 
 * @param {Object} page - puppeteer webpage object
 * @param {string} genreId - Netflix's id for the genre
 * @returns {Object} list of ids from genre
 */
const scrapeIds = async (page, genreId) => {
    console.log(`Scraping ids from genre ${genreId}...`)
    await page.goto(URLS.genreBase + genreId + URLS.alphabetical, WAIT_OPTIONS)
    let ids
    try {
        while (true) {
            ids = await page.evaluate(
                (linkSelector) => {
                    const linkNodeList = document.querySelectorAll(linkSelector)
                    const links = Array.from(linkNodeList) // convert NodeList to array
                    return links.map((links) => {
                        const href = links.pathname
                        return href.substr(href.lastIndexOf('/') + 1)
                })}, // just get the number id 
                SELECTORS.link
            )
            // checking for newly loaded titles
            const previousHeight = await page.evaluate(() => document.body.scrollHeight)
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
            await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`, { timeout: DELAYS.loading })
            await page.waitForTimeout(DELAYS.scroll)
    }}
    catch (error) {} // receives an error to exit the loop
    return ids
}


/** 
 * Scrapes names, descriptions, cast & etc. from title
 * 
 * @param {Object} page - puppeteer webpage object
 * @param {number} id - title id
 * @returns {Object} title - names, descriptions, cast & etc.
 */
const scrapeTitle = async (page, id) => {
    console.log(`Scraping data from title ${id}...`)
    await page.goto(URLS.titleBase + id, WAIT_OPTIONS)
    return await page.evaluate(
        (selectors, id) => {
            const aboutChildren = document.querySelectorAll(selectors.aboutChildren) // to make it easier to scrape degenerate tags
            
            /** 
             * Gets name of section in preview
             * 
             * @param {number} i - index of section
             * @returns {string} tagName of section
             */
            const getSectionName = (i) => aboutChildren[i].querySelector(selectors.sectionName).innerText

            /**
             * Gets list of values in section of preview
             * 
             * @param {number} i - index of section
             * @returns {array} list of tags
             */
            const getList = (i) => Array.from(aboutChildren[i].querySelectorAll(selectors.aboutTags)).map((tag) => {
                let text = tag.innerText
                text = text.substr(0, 1) === " " ? text.substr(1) : text // the first in the list starts with a space
                return text.replace(", ", "")
            })
            
            // scrape string properties
            const properties = [
                "name",
                "release",
                "contentRating",
                "duration",
                "imageDefinition",
                "description",
                "ratingReason",
                "maturityDescription"
            ]

            const title = { id, availableCountries: [] }
            for (const property of properties) {
                try { // some properties are not available
                    title[property] = document.querySelector(selectors[property]).innerText
                }
                catch (error) {}
            }

            // scrape array properties
            try { 
                for (let i = 0; i < 10; i++) title[getSectionName(i)] = getList(i)
            }
            catch (error) {} // I don't know many sections there are

            // potentially scrape average duration of episodes
            if (title.duration.includes("m")) title.isFilm = true // if it is a film...
            else {
                title.isFilm = false
                const episodeDurationElements = Array.from(document.querySelectorAll(selectors.episodeDuration))
                const episodeDurations = episodeDurationElements.map((element) => { // in minutes
                    const innerText = element.innerText
                    return parseInt(innerText.substr(0, innerText.indexOf("m")))
                })
                title.averageEpisodeDuration = `${parseInt(episodeDurations.reduce((previous, current) => previous + current, 0) / episodeDurations.length)}m`
            }

            // scrape audio description
            title.hasAudioDescription = document.querySelector(selectors.audioDescription) !== null
            
            return title
        },
        SELECTORS,
        id
)}


/**
 * Scrapes thumbnail from title
 * 
 * @param {Object} page - puppeteer webpage object
 * @param {string} name - title name
 * @returns {string} thumbnail - title thumbnail HREF
 */
const scrapeThumbnail = async (page, name) => {
    console.log(`Scraping thumbnail from ${name}...`)
    const URI = encodeURIComponent(name.replace("|", " "))
    await page.goto(URLS.thumbnailBase + URI, WAIT_OPTIONS)

    return await page.evaluate(
        async (linkSelector, thumbnailSelector) => {
            let link
            while (true) {
                link = document.querySelector(linkSelector)
                if (link !== null) break
                await new Promise((resolve) => setTimeout(resolve, 1000)) // sleep for 1 second
            }
            const href = link.pathname
            const code = href.substr(href.lastIndexOf('/') + 1) 
            const source = link.querySelector(thumbnailSelector).src
            return { code, source }
        }, 
        SELECTORS.link,
        SELECTORS.thumbnail
)}


// I couldn't find a more elegant way to do this
module.exports = {
    launch,
    openNetflix,
    scrapeGenres,
    scrapeIds,
    scrapeTitle,
    scrapeThumbnail
}
