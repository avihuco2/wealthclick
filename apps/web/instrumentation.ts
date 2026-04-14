export async function register() {
  // Only run in the Node.js runtime (not edge), and only in production
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initScraperCron } = await import("./lib/scraperCron");
    initScraperCron();
  }
}
