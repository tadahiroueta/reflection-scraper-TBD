# reflection-scraper
 Netflix VPN aid scraper

### CLI
 To use the CLI execute 
 > node index -c <command>
 
 CLI commands:
 - `acquire ids` -- scrapes and downloads ids from each country, then organises them into their availability and a complete collection
 - `acquire titles` -- scrapes and downloads title data for new ids
 - `acquire thumbnails` -- scrapes and downloads thumbnail HREF for new ids

### Requirements
 - Netflix cookies
 - Input data
   - genres.json
   - countries.json
 - Open VPN
   - & imported server data
