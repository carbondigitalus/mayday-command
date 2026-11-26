/** @type {import('next-sitemap').IConfig} */
export default {
    alternateRefs: [], // other language page references
    autoLastmod: true, // add <lastmod/> property
    changefreq: 'daily',
    priority: '0.7',
    generateIndexSitemap: false, // create index sitemap
    generateRobotsTxt: true, // dynamically create a robots.txt file
    outDir: 'public', // save files here
    robotsTxtOptions: {
        includeNonIndexSitemaps: true,
        policies: [
            { userAgent: '*', allow: '/' },
            { userAgent: 'SemrushBot', disallow: '/' },
            { userAgent: 'SemrushBot-SA', disallow: '/' },
            { userAgent: 'MJ12bot', disallow: '/' }
        ]
    },
    sitemapBaseFileName: 'sitemap',
    sitemapSize: 5000, // max link count per sitemap file
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    sourceDir: '.next' // next.js build directory
};
