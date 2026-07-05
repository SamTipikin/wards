// Second vibe backfill — for FWA + SiteInspire winners analyzed locally.
// Same shape as vibe.ts output; CI overwrites going forward. #42 (fitosauna)
// was blocked (no usable render) so it's left null.
import Database from 'better-sqlite3';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(resolve(__dirname, '../data/radar.db'));

const VIBES = {
  32: { description: "North Kingdom case study for 'Race Condition', a 3D multi-agent marathon sim built for the Google Cloud Next keynote.", industry: 'agency', vibe_tags: ['dark', 'technical', 'editorial', 'photographic', 'futuristic'], mood: 'cinematic tech-showcase', uses_3d: true, notable: 'Keynote stage footage as the hero' },
  33: { description: "Miu Miu's 'A House That We Shaped' immersive bag-collection experience, gated by a sound-on entry.", industry: 'fashion', vibe_tags: ['luxury', 'minimal', 'typographic', 'dark', 'editorial'], mood: 'refined anticipation', uses_3d: true, notable: 'Spaced-out white type on royal blue' },
  34: { description: 'Site for Cipher, a talent & production house, presenting its work as a floating cloud of video stills.', industry: 'agency', vibe_tags: ['dark', 'editorial', 'photographic', 'minimal', 'futuristic'], mood: 'cinematic gallery', uses_3d: true, notable: 'Scattered video works orbiting on black' },
  35: { description: 'Portfolio for Studio K95, an Italian brand & digital design studio, with projects orbiting in 3D.', industry: 'agency', vibe_tags: ['colorful', 'technical', 'futuristic', 'playful', 'editorial'], mood: 'energetic showcase', uses_3d: true, notable: 'Work cards on 3D rings over electric blue' },
  36: { description: 'A 3D watch configurator presenting model 146GR, minimal and product-focused.', industry: 'ecommerce', vibe_tags: ['minimal', 'technical', 'luxury', 'light', 'typographic'], mood: 'precise and premium', uses_3d: true, notable: 'Rotating 3D watch with a live spec readout' },
  37: { description: "REF Digital's agency site, leading with 'Move fast, build to last.' — a wink at 'move fast, break things.'", industry: 'agency', vibe_tags: ['minimal', 'editorial', 'corporate', 'typographic', 'light'], mood: 'confident and wry', uses_3d: false, notable: "Counter-tagline: 'we've broken enough things already'" },
  38: { description: 'Cobloc, a French architecture studio, opening on a soft cream greeting screen.', industry: 'architecture', vibe_tags: ['minimal', 'light', 'editorial', 'organic'], mood: 'soft and understated', uses_3d: false, notable: "Defocused 'Bonjour' intro, mid-load" },
  39: { description: "'MechStorm', a controller-required browser mech game, with a loud arcade menu.", industry: 'gaming', vibe_tags: ['maximalist', 'playful', 'colorful', 'retro', 'technical'], mood: 'loud arcade energy', uses_3d: true, notable: "Hazard-yellow menu tagged 'CONTROLLER REQUIRED'" },
  40: { description: "Richard Mille's 'Below the Line', a photographic tale from Le Mans Classic 2025.", industry: 'event', vibe_tags: ['editorial', 'photographic', 'typographic', 'dark', 'maximalist'], mood: 'high-octane nostalgia', uses_3d: false, notable: "'BELOW THE LINE' in vast yellow over a blurred race car" },
  41: { description: "Serotoninn fashion ecommerce, positioned 'where glam meets grunge'.", industry: 'fashion', vibe_tags: ['editorial', 'photographic', 'typographic', 'minimal', 'light'], mood: 'glam-grunge', uses_3d: false, notable: 'Torn split-tone portrait over the hero' },
  43: { description: 'Nudot Studio, a Taiwanese brand & digital design studio, with a chromatic phone over inky liquid.', industry: 'agency', vibe_tags: ['dark', 'technical', 'editorial', 'typographic', 'futuristic'], mood: 'sleek and precise', uses_3d: true, notable: 'Chromatic-aberration device on black fluid' },
  44: { description: "Agency anniversary site — 'Before we inspired others, we were inspired' — 20 years of NK Studio.", industry: 'agency', vibe_tags: ['dark', 'editorial', 'typographic', 'minimal', 'organic'], mood: 'reflective and warm', uses_3d: true, notable: 'Serif statement over a teal nebula' },
  45: { description: "'What happens when you give blood?' — an interactive National Blood Week guide.", industry: 'health', vibe_tags: ['illustrative', 'playful', 'colorful', 'minimal', 'light'], mood: 'warm and educational', uses_3d: true, notable: 'Illustrated blood bag on bold red' },
  46: { description: 'Recruitment site for Tokyo firm Curio Tech, asking candidates if they are still craving their dream.', industry: 'other', vibe_tags: ['editorial', 'photographic', 'dark', 'typographic', 'monochrome'], mood: 'bold and aspirational', uses_3d: false, notable: 'Suited man revealing a childhood dream beneath his shirt' },
};

const stmt = db.prepare("UPDATE analyses SET vibe = ?, error = NULL WHERE site_id = ? AND vibe IS NULL");
let n = 0;
const tx = db.transaction(() => {
  for (const [id, vibe] of Object.entries(VIBES)) n += stmt.run(JSON.stringify(vibe), Number(id)).changes;
});
tx();
console.log(`Seeded vibe for ${n} sites.`);
db.close();
