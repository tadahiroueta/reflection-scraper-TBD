/** Responds to CLI commands */

const yargs = require('yargs/yargs'); // 1st rule of programming

const coloniser = require('./src/coloniser.js'); // private modules


// CLI command and options
const argv = yargs(process.argv.slice(2))
	.usage('Usage: $0 <command> [options]')
	.command('acquire', 'Scrape [options]')
	.example('$0 acquire ids', 'Scrapes which titles are available in each country')
	.example('$0 acquire titles', 'Scrapes all missing title data from new ids')
	.example('$0 acquire thumbnails', 'Scrapes all missing thumbnails from new ids')
	.example('$0 acquire all', 'Scrapes ids, titles, and thumbnails -- a clean update')
	.alias('a', 'acquire')
	.demandOption(['a']);

const acquireOption = argv.argv.a;


(async () => {
	switch (acquireOption) {
	case "ids":
		await coloniser.acquireIds()
		break

	case "titles":
		await coloniser.acquireMissingTitles()
		break

	case "thumbnails":
		while (true) { // experimental
			try { 
				await coloniser.acquireMissingThumbnails()
				break
			} catch (e) {}
		}
		break

	case "all":
		await coloniser.acquireIds()
		await coloniser.acquireMissingTitles()
		await coloniser.acquireMissingThumbnails()
		break

	default:
		console.log("Invalid command.")
		console.log(argv.argv._)
	}

	process.exit()
})()