import type { Page } from 'playwright';

const MAX_SCRIPT_BYTES = 2_000_000; // cap total script text scanned for tech sigs
const MAX_SCRIPTS = 20;

/**
 * Attaches to a page BEFORE navigation and records the things extractors need
 * from the network layer: font file URLs and (capped) script bundle text.
 */
export class NetworkCapture {
  readonly fontUrls = new Set<string>();
  readonly scriptUrls = new Set<string>();
  private scriptChunks: string[] = [];
  private scriptBytes = 0;
  private scriptsRead = 0;
  private pending: Promise<void>[] = [];

  attach(page: Page): void {
    page.on('response', (res) => {
      const url = res.url();
      const type = res.request().resourceType();

      if (/\.woff2?(\?|$)/i.test(url)) {
        this.fontUrls.add(url);
        return;
      }

      if (type === 'script' && url.startsWith('http')) {
        this.scriptUrls.add(url);
        if (
          this.scriptsRead < MAX_SCRIPTS &&
          this.scriptBytes < MAX_SCRIPT_BYTES
        ) {
          this.scriptsRead += 1;
          // Read the body opportunistically; never let it throw into the run.
          const p = res
            .text()
            .then((t) => {
              if (this.scriptBytes < MAX_SCRIPT_BYTES) {
                this.scriptChunks.push(t.slice(0, MAX_SCRIPT_BYTES));
                this.scriptBytes += t.length;
              }
            })
            .catch(() => {});
          this.pending.push(p);
        }
      }
    });
  }

  /** Await any in-flight body reads (best effort) before extractors run. */
  async settle(): Promise<void> {
    await Promise.allSettled(this.pending);
  }

  scriptText(): string {
    return this.scriptChunks.join('\n');
  }
}
