/** Conducts the scraper around the world */

const { writeFileSync } = require('fs'); // file explorer library

// private modules
const scraper = require('./scraper.js');
const tourist = require('./tourist.js');


// constants
const PATHS = {
    data: "../data/",
    input: PATHS.data + "input/",
    output: PATHS.data + "output/",
    genres: PATHS.input + "genres.json",
    cookies: PATHS.input + "cookies.json",
    countries: PATHS.input + "countries.json",
    countryIds: PATHS.output + "countryIds/",
    ids: PATHS.output + "ids.json",
    titles: PATHS.output + "titles.json",
    thumbnails: PATHS.output + "thumbnails.json",
    availability: PATHS.output + "availability.json"
}


// data imports
const genres = require(PATHS.genres)
const cookies = require(PATHS.cookies)
const countries = require(PATHS.countries)


/** 
 * Cleans up array
 * 
 * @param {Array} array
 * @returns {string} compact JSON array in numerical order, with no duplicates
 */
const getCleanJSON = (array) => {
    const cleanArray = Array.from(new Set(array)) // remove duplicates
    cleanArray.sort((a, b) => a - b) // sort in numerical order
    return JSON.stringify(cleanArray)
}


/** 
 * Gets ids without any other data from country ids
 * 
 * @param {string} country
 * @return {Array} missing title ids
 */
const getMissingCountryTitles = (country) => {
    const countryIds = require(PATHS.countryIds + country + ".json")
    const titles = require(PATHS.titles)
    const missingIds = countryIds.filter((id) => !titles[id])
    return missingIds
}


/** Scrapes and downloads ids from each country */
const acquireCountryIds = async () => {

    for (const country of countries) {
        console.log(`Acquiring ids from ${country}...`)

        if(!await tourist.connectVPN(country)) continue // connection failed
        const page = await scraper.openNetflix(cookies)

        const countryIds = []
        for (const genre of genres) countryIds.push(await scraper.scrapeIds(page, genre.id))
        writeFileSync(PATHS.countryIds + country + ".json", getCleanJSON(countryIds))
    }

    await tourist.disconnectVPN()
}


/** Collects all ids */
const acquireIds = async () => {
    console.log("Acquiring ids...")
    await acquireCountryIds()
    updateAvailability()

    let ids = []
    for (const country of countries) ids.push(require(PATHS.countryIds + country + ".json"))
    writeFileSync(PATHS.ids, getCleanJSON(ids))
}


/** Updates the list of countries each title is available in */
const updateAvailability = () => {
    console.log("Updating availability...")
    const availability = require(PATHS.availability)

    for (const country of countries) {
        const countryIds = require(PATHS.countryIds + country + ".json")
        for (const id of countryIds) {
            if (!availability[id]) availability[id] = []
            availability[id].push(country)
    }}
    writeFileSync(PATHS.availability, JSON.stringify(availability))
}


/** Scrapes and downloads all missing title data from all over the world */
const acquireMissingTitles = async () => {
    console.log("Acquiring missing titles...")

    const titles = require(PATHS.titles)
    for (const country of countries) {
        console.log(`Acquiring missing titles from ${country}...`)
        
        const missingCountryIds = getMissingCountryTitles(country)
        if (missingCountryIds.length === 0) continue // no missing titles
        if(!await tourist.connectVPN(country)) continue // connection failed

        const page = await scraper.openNetflix(cookies)
        for (const id of missingCountryIds) {
            titles[id] = await scraper.scrapeTitle(page, id)
            writeFileSync(PATHS.titles, JSON.stringify(titles)) // save after each title
    }}
    
    await tourist.disconnectVPN()
}


/** Scrapes and downloads every missing thumbnail HREF from all over the world */
const acquireMissingThumbnails = async () => {
    console.log("Acquiring missing thumbnails...")

    const thumbnails = require(PATHS.thumbnails)
    for (const country of countries) {
        console.log(`Acquiring missing thumbnails from ${country}...`)
        
        const missingCountryIds = getMissingCountryTitles(country)
        if (missingCountryIds.length === 0) continue // no missing titles
        if(!await tourist.connectVPN(country)) continue // connection failed

        const page = await scraper.openNetflix(cookies)
        for (const id of missingCountryIds) {
            thumbnails[id] = await scraper.scrapeThumbnail(page, id)
            writeFileSync(PATHS.thumbnails, JSON.stringify(thumbnails)) // save after each thumbnail
    }}
    
    await tourist.disconnectVPN()
}


module.exports = {
    acquireIds,
    acquireMissingTitles,
    acquireMissingThumbnails,
}