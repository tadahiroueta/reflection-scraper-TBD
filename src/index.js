/** Responds to CLI commands */

const yargs = require('yargs'); // CLI library

const coloniser = require('./coloniser.js'); // private modules


// CLI command
const command = yargs.usage("Usage: -c <command>").option("c", { 
	alias: "command", 
	describe: "command to run", 
	type: "string", 
	demandOption: true 
}).argv.command


(async () => {
	switch (command) {
	case "acquire ids":
		await coloniser.acquireIds()
		break

	case "acquire titles":
		await coloniser.acquireMissingTitles()
		break

	case "acquire thumbnails":
		await coloniser.acquireMissingThumbnails()
		break

	default:
		console.log("Invalid command.")
	}

	process.exit()
})()