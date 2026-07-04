// One-off: write human-authored vibe JSON (produced by viewing each screenshot)
// into analyses.vibe, matching the exact shape vibe.ts produces. This backfills
// the field locally since the `claude -p` CLI isn't available here; the daily
// CI run will overwrite/populate it going forward.
import Database from 'better-sqlite3';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(resolve(__dirname, '../data/radar.db'));

const VIBES = {
  1: { description: "Product site for Radian's EXR electric enduro motorcycle, built around an explorable 3D model of the bike.", industry: 'other', vibe_tags: ['technical', 'minimal', 'dark', 'photographic', 'futuristic'], mood: 'engineered and adrenaline-ready', uses_3d: true, notable: 'Interactive 3D motorcycle rendered in the hero' },
  2: { description: 'Ecommerce site for a small-batch BBQ sauce brand with a loud, tongue-in-cheek voice.', industry: 'food', vibe_tags: ['maximalist', 'playful', 'typographic', 'dark', 'photographic'], mood: 'loud and appetite-forward', uses_3d: false, notable: "Headline: 'the BBQ sauce that makes other sauces insecure'" },
  3: { description: 'All-inclusive student accommodation brand in Greece with a vivid, community-first feel.', industry: 'other', vibe_tags: ['colorful', 'playful', 'photographic', 'editorial', 'light'], mood: 'bright and sociable', uses_3d: false, notable: 'Primary-color numbered nav blocks down the left edge' },
  4: { description: 'Landing page for Wembi, an AI product, wrapped in a glassy, near-future identity.', industry: 'saas', vibe_tags: ['futuristic', 'technical', 'minimal', 'monochrome', 'light'], mood: 'sleek and near-future', uses_3d: true, notable: 'Lime wireframe logotype over a frosted-glass sphere' },
  5: { description: "Enter-page for NRG's data-center power offering, minimal and corporate.", industry: 'other', vibe_tags: ['minimal', 'corporate', 'dark', 'technical'], mood: 'quietly institutional', uses_3d: false, notable: "Sparse splash with a single 'Enter Site' button" },
  6: { description: 'Portfolio landing for model Meech, styled as a scattered set of editorial polaroids.', industry: 'fashion', vibe_tags: ['editorial', 'photographic', 'minimal', 'light', 'playful'], mood: 'casual fashion-editorial', uses_3d: false, notable: 'Photos scattered like pinned polaroids on a light canvas' },
  7: { description: 'Brand experience for IVRESS, captured on its intro loader — a small mascot on black.', industry: 'culture', vibe_tags: ['dark', 'minimal', 'playful'], mood: 'mysterious intro', uses_3d: false, notable: 'Loading screen with a tiny character at 00%' },
  8: { description: 'Agency site for Podium, offering creative direction and production for athleticism.', industry: 'agency', vibe_tags: ['minimal', 'organic', 'light', 'editorial', 'photographic'], mood: 'fluid and experimental', uses_3d: true, notable: 'Organic liquid-blob mask revealing footage' },
  9: { description: 'Immersive studio experience gated by a sound-on entry screen marked 2025.', industry: 'agency', vibe_tags: ['dark', 'minimal', 'typographic', 'editorial'], mood: 'cinematic anticipation', uses_3d: true, notable: "Big '2025' gate with an enter-with-sound choice" },
  // 10 (IL CAPO) returned a 403 page — nothing to describe; left null.
  11: { description: 'Corporate site for footwear group Wolverine Worldwide, bold editorial type over motion footage.', industry: 'fashion', vibe_tags: ['corporate', 'minimal', 'dark', 'photographic', 'typographic'], mood: 'purposeful and grounded', uses_3d: false, notable: "'Make. Every Day. Better.' in huge stacked type" },
  12: { description: 'Marketing site for the Sui blockchain, positioning it as full-stack infrastructure.', industry: 'crypto', vibe_tags: ['futuristic', 'technical', 'minimal', 'colorful', 'light'], mood: 'expansive and optimistic', uses_3d: false, notable: "Glowing, defocused 'Build full stack' headline" },
  13: { description: 'DeFi swap platform captured on its green branded loading screen.', industry: 'crypto', vibe_tags: ['minimal', 'dark', 'technical', 'monochrome'], mood: 'quiet and precise', uses_3d: true, notable: 'Diamond monogram loader on forest green' },
  14: { description: 'German digital agency site with a dark, cinematic hero behind its consent modal.', industry: 'agency', vibe_tags: ['dark', 'technical', 'corporate', 'editorial'], mood: 'moody and technical', uses_3d: true, notable: 'Pixel-swatch logo mark beside the wordmark' },
  15: { description: 'Communications agency captured on a navy loading screen with a small 3D mark.', industry: 'agency', vibe_tags: ['minimal', 'colorful', 'dark'], mood: 'crisp and corporate', uses_3d: true, notable: 'Tiny yellow 3D shape on deep navy' },
  16: { description: 'Ecommerce for Balmoral running apparel with gritty urban run photography.', industry: 'ecommerce', vibe_tags: ['editorial', 'photographic', 'minimal', 'light', 'luxury'], mood: 'athletic and refined', uses_3d: false, notable: 'Spring-Summer lookbook of runners in an alley' },
  17: { description: 'Immersive audio site for Indigo, a contemporary jewelry house told across five tales.', industry: 'fashion', vibe_tags: ['dark', 'luxury', 'editorial', 'minimal', 'typographic'], mood: 'intimate and cinematic', uses_3d: false, notable: "'Enter the experience' with an optional soundtrack" },
  18: { description: "Gucci's 'La Famiglia — Mystery Unfolds' interactive experience set at a moonlit villa.", industry: 'fashion', vibe_tags: ['luxury', 'dark', 'editorial', 'photographic', 'futuristic'], mood: 'opulent mystery', uses_3d: true, notable: 'Illustrated night-time mansion as the gateway' },
  19: { description: 'Marketing site for Fauna Robotics, framing home/office robots as capable, safe and fun.', industry: 'other', vibe_tags: ['playful', 'minimal', 'light', 'technical', 'photographic'], mood: 'friendly and optimistic', uses_3d: false, notable: 'Cream hero with a little robot dancing in an office' },
  20: { description: "Product site for Elva, an AI 'filmmaking crew in your phone', shown in a glossy device mockup.", industry: 'saas', vibe_tags: ['dark', 'futuristic', 'technical', 'photographic', 'minimal'], mood: 'cinematic and premium', uses_3d: true, notable: 'Phone mockup lit like a film still' },
  21: { description: 'Membership collective unlocking hidden Japanese sake experiences, backed by Suntory.', industry: 'culture', vibe_tags: ['luxury', 'editorial', 'photographic', 'futuristic', 'typographic'], mood: 'refined and warm', uses_3d: false, notable: 'Amber macro pour of sake filling the hero' },
  22: { description: 'Playful ecommerce for Crav smashburgers with loud type and a winking burger mascot.', industry: 'food', vibe_tags: ['playful', 'maximalist', 'colorful', 'illustrative', 'typographic', 'retro'], mood: 'fun and craveable', uses_3d: false, notable: "'THE BURGER' in warped red type around a hero patty" },
  23: { description: "Private-equity financing firm with a minimal 'Drive to grow' statement over a misty peak.", industry: 'fintech', vibe_tags: ['minimal', 'corporate', 'editorial', 'monochrome', 'light', 'typographic'], mood: 'assured and aspirational', uses_3d: false, notable: "Oversized 'Drive to grow' over a faded mountain" },
  24: { description: "Site for Serve Robotics' autonomous sidewalk delivery robots, led by a friendly-eyed bot.", industry: 'other', vibe_tags: ['futuristic', 'playful', 'photographic', 'technical', 'light'], mood: 'optimistic near-future', uses_3d: false, notable: "'The future is here' beside a robot with glowing eyes" },
  25: { description: 'Indian real-estate developer with a cinematic 3D cube floating over dark water.', industry: 'architecture', vibe_tags: ['futuristic', 'dark', 'technical', 'colorful'], mood: 'epic and aspirational', uses_3d: true, notable: 'Glowing blue monogram cube on a moonlit lake' },
  26: { description: 'Portfolio for a Paris-based motion & sound designer, gated by a glossy 3D orb splash.', industry: 'portfolio', vibe_tags: ['dark', 'minimal', 'futuristic', 'technical', 'monochrome'], mood: 'sleek and sensory', uses_3d: true, notable: "Iridescent green orb with 'enter with sound'" },
  27: { description: "Noomo Agency's 'Power of Storytelling' piece, shown on its soft lavender loading screen.", industry: 'agency', vibe_tags: ['minimal', 'light', 'colorful', 'organic'], mood: 'soft and dreamy', uses_3d: true, notable: 'Pale lavender gradient with a small central loader' },
  28: { description: 'Brand site for SOHub with a bold wordmark interlocked with a 3D robotic figure.', industry: 'other', vibe_tags: ['minimal', 'technical', 'light', 'typographic', 'futuristic'], mood: 'bold and clean', uses_3d: true, notable: "'sohub' wordmark pierced by a walking robot" },
  29: { description: 'Web3 gaming hub on ApeChain fronting decentralized games like ApeChurch.', industry: 'gaming', vibe_tags: ['maximalist', 'futuristic', 'colorful', 'playful', 'technical', 'dark'], mood: 'hype and energetic', uses_3d: true, notable: 'Green 3D ape idol beneath a giant A' },
  30: { description: 'Atmospheric site for Son Daven, a design resort-hotel, with a dithered sheep and glitch type.', industry: 'architecture', vibe_tags: ['editorial', 'retro', 'technical', 'dark', 'typographic', 'monochrome'], mood: 'dreamlike and moody', uses_3d: false, notable: "ASCII-dithered sheep and 'I am a valley of peace'" },
  31: { description: "Landing for Steven, 'the operating system for the creator economy', around a 3D camera-lens ring.", industry: 'saas', vibe_tags: ['dark', 'technical', 'futuristic', 'minimal', 'typographic'], mood: 'systematic and bold', uses_3d: true, notable: 'Rotating lens ring labeled creator media / products / communities' },
};

const stmt = db.prepare(
  "UPDATE analyses SET vibe = ?, error = NULL WHERE site_id = ? AND vibe IS NULL",
);
let n = 0;
const tx = db.transaction(() => {
  for (const [id, vibe] of Object.entries(VIBES)) {
    const res = stmt.run(JSON.stringify(vibe), Number(id));
    n += res.changes;
  }
});
tx();
console.log(`Seeded vibe for ${n} sites.`);
db.close();
