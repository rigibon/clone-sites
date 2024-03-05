import scrape from "website-scraper";
import { HttpsProxyAgent } from "hpagent";
import PuppeteerPlugin from "website-scraper-puppeteer";
import { parse } from "csv";
import needle from "needle";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import path, { dirname } from "path";
import fs from "fs";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const proxyScrapeURL = "https://api.proxyscrape.com/v3/free-proxy-list/get"; // Free proxy list
const defaultProxyServer = "http://35.185.196.38:3128"; // Default US proxy server

const app = express();

app.use(cors());
app.use(express.static("public"));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));
app.listen(3000, () => {
	console.log("Server running on port 3000");
});

// Clone url
app.post("/clone", (req, res) => {
	console.log(req.body);
	var url = req.body.url;
	var country = req.body.country;

	var proxies = parseProxyList(country);

	const proxyServer = proxies.length > 0 ? proxies[0] : defaultProxyServer;

	const scraperOptions = {
		urls: [url],
		directory: path.join(__dirname, "/public"),
		request: {
			agent: {
				https: new HttpsProxyAgent({
					keepAlive: true,
					keepAliveMsecs: 1000,
					maxSockets: 256,
					maxFreeSockets: 256,
					scheduling: "lifo",
					proxy: proxyServer,
				}),
			},
		},
		plugins: [
			new PuppeteerPlugin({
				launchOptions: { headless: "new", args: [`--proxy-server=${proxyServer}`] },
				gotoOptions: { waitUntil: "networkidle0" },
				scrollToBottom: { timeout: 50000, viewportN: 10 },
			}),
		],
	};

	// Remove public folder
	fs.rmSync(path.join(__dirname, "/public"), { recursive: true, force: true });

	// Scrape url
	scrape(scraperOptions).then((result) => {
		res.sendStatus(200);
	});
});

// Host cloned website
app.get("/live", (req, res) => {
	res.sendFile(path.join(__dirname, "public/index.html"));
});

function parseProxyList(country) {
	const proxies = [];

	needle
		.get(`${proxyScrapeURL}?request=getproxies&protocol=http&country=${country}&anonymity=elite&timeout=1750&proxy_format=protocolipport&format=csv`)
		.pipe(parse())
		.on("data", (data) => {
			// Get only https proxies
			if (data[29] === "true") proxies.push(data);
		})
		.on("done", (err) => {
			if (err) console.log("Error parsing proxy list");
			else {
				console.log("Proxy list parsed successfully");
			}
		});

	return proxies;
}
