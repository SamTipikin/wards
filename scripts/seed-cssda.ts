// Seed CSSDA WOTD winners captured via the browser extension (cssdesignawards
// edge-blocks this sandbox's IP, so Playwright can't reach it here). Uses the
// same recordWinner path as the pipeline, so multi-platform sites just gain a
// cssda award. Dates parsed with the scraper's own parseWotdDate.
import { openDb, recordWinner } from '../src/db.js';
import { parseWotdDate } from '../src/scrapers/cssda.js';

const RAW = [
  { ext: 'https://www.curiotech.co.jp/recruit/', date: 'JUL 4', title: 'Curio Tech' },
  { ext: 'https://wrapped-party.activetheory.dev/en', date: 'JUL 3', title: 'Spotify Wrapped Party' },
  { ext: 'https://rideradian.com/', date: 'JUL 2', title: 'Radian' },
  { ext: 'https://experiment.obys.agency/', date: 'JUL 1', title: 'Obys® Experiment Space' },
  { ext: 'https://kei-inc.jp/', date: 'JUN 30', title: 'KEI inc.' },
  { ext: 'https://trionn.com', date: 'JUN 29', title: 'TRIONN' },
  { ext: 'https://www.codebyjesse.com/', date: 'JUN 28', title: 'Code by Jesse' },
  { ext: 'http://eleos.la/', date: 'JUN 27', title: 'Eleos' },
  { ext: 'https://cipherdigital.com/', date: 'JUN 26', title: 'Cipher Digital' },
  { ext: 'https://aikawakenichi.com/', date: 'JUN 25', title: 'Kenichi Aikawa' },
  { ext: 'https://dobre.agency/', date: 'JUN 24', title: 'Dobre Agency' },
  { ext: 'https://aircenter.space/', date: 'JUN 23', title: 'AIR' },
  { ext: 'https://www.ilcapoproduction.com/', date: 'JUN 22', title: 'IL CAPO PRODUCTION' },
  { ext: 'https://www.houseofhoney.com/', date: 'JUN 21', title: 'House of Honey' },
  { ext: 'https://rdapkuns.github.io/around-digiphy/', date: 'JUN 20', title: 'DigiPHY' },
  { ext: 'https://bymonolog.com/', date: 'JUN 19', title: 'MONOLOG' },
  { ext: 'https://voltlites.com/', date: 'JUN 18', title: 'Volt' },
  { ext: 'https://artemartemartem.com/', date: 'JUN 17', title: 'Artem Shcherbakov — Portfolio' },
];

const db = openDb();
const tx = db.transaction(() => {
  for (const r of RAW) {
    recordWinner(db, 'cssda', {
      url: r.ext,
      title: r.title,
      awardType: 'wotd',
      awardDate: parseWotdDate(r.date),
      sourceUrl: 'https://www.cssdesignawards.com/wotd-award-winners',
    });
  }
});
tx();
const n = (db.prepare("SELECT COUNT(*) n FROM awards WHERE source='cssda'").get() as { n: number }).n;
console.log(`Seeded CSSDA: ${n} wotd awards.`);
db.close();
