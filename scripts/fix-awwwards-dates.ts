// One-off: the first Awwwards scrape stamped every winner with today's date.
// Re-scrape with the fixed parser (which reads each card's real createdAt) and
// replace the stale awwwards award rows so winners spread across their true days.
import { openDb, recordWinner } from '../src/db.js';
import { launchBrowser } from '../src/scrapers/util.js';
import { AwwwardsScraper } from '../src/scrapers/awwwards.js';

async function main(): Promise<void> {
  const db = openDb();
  const browser = await launchBrowser();
  let winners;
  try {
    winners = await new AwwwardsScraper(browser).scrape();
  } finally {
    await browser.close();
  }
  console.log(`scraped ${winners.length} awwwards winners with real dates`);
  const dates = [...new Set(winners.map((w) => w.awardDate))].sort();
  console.log(`distinct award dates: ${dates.length} (${dates[0]} … ${dates.at(-1)})`);

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM awards WHERE source = 'awwwards'").run();
    for (const w of winners) recordWinner(db, 'awwwards', w);
  });
  tx();
  console.log('awwwards award dates corrected.');
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
