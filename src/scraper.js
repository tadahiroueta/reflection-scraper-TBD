/** Bottom level scraping algorithm */

const puppeteer = require('puppeteer') // headless browser library


const cookies = require("../data/input/cookies.json")


// constants
const URLS = {
    genreBase: 'https://www.netflix.com/browse/genre/',
    titleBase: 'https://www.netflix.com/title/',
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
const IS_HEADLESS = true



/** 
 * Launch browser
 * 
 * @returns {Object} browser
 */
const launch = async () => {
    console.log(`Launching ${IS_HEADLESS ? "headless " : ""}browser...`)
    return await puppeteer.launch({ headless: IS_HEADLESS, handleSIGINT: false }) // turn off handle signal interrupt to allow travel.js to handle it
}


/**  
 * Opens new tab with cookies
 * 
 * @param {Object} browser
 * @param {string} url - url to open
 * @param {number} recursiveCounter - number of times function has been called recursively
 * @returns {Object}
 */
const openTab = async (browser, url, recursiveCounter=0) => {
    if (recursiveCounter >= 4) throw new Error("Too many failed attempts to open tab.")

    const page = await browser.newPage()
    await page.setCookie(...cookies)
    try { await page.goto(url, WAIT_OPTIONS) } catch (error) { return openTab(browser, url, recursiveCounter+1) }
    return page
}


/** 
 * Scrape all ids from a genre
 * 
 * @param {Object} browser
 * @param {string} genreId - Netflix's id for the genre
 * @returns {Object} list of ids from genre
 */
const scrapeIds = async (browser, genreId) => {
    console.log(`Scraping ids from genre ${genreId}...`)
    const page = await openTab(browser, URLS.genreBase + genreId + URLS.alphabetical)
    let ids
    try { while (true) {
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
    await page.close()
    return ids
}


/** 
 * Scrapes names, descriptions, cast & etc. from title
 * 
 * @param {Object} browser
 * @param {number} id - title id
 * @returns {Object} title - names, descriptions, cast & etc.
 */
const scrapeTitle = async (browser, id) => {
    console.log(`Scraping data from title ${id}...`)
    const page = await openTab(browser, URLS.titleBase + id)
    const title = await page.evaluate(
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

            const title = { id }
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
            if (title.duration && title.duration.includes("m")) title.isFilm = true // if it is a film...
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
    )
    await page.close()
    return title
}


/**
 * Scrapes thumbnail from title
 * 
 * @param {Object} browser
 * @param {string} name - title name
 * @returns {string} thumbnail - title thumbnail HREF
 */
const scrapeThumbnail = async (browser, name) => {
    console.log(`Scraping thumbnail from ${name}...`)
    const URI = encodeURIComponent(name.replace("|", " "))
    const page = await openTab(browser, URLS.searchBase + URI)

    const thumbnail = await page.evaluate(
        async (linkSelector, thumbnailSelector) => {
            let link
            while (true) {
                link = document.querySelector(linkSelector)
                if (link !== null) break
                await new Promise((resolve) => setTimeout(resolve, 1000)) // sleep for 1 second
            }
            return link.querySelector(thumbnailSelector).src
        }, 
        SELECTORS.link,
        SELECTORS.thumbnail
        )
    await page.close()
    return thumbnail
    }


// I couldn't find a more elegant way to do this
module.exports = {
    launch,
    scrapeIds,
    scrapeTitle,
    scrapeThumbnail
}
