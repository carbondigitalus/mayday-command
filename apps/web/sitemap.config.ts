// NPM Modules
import type { IConfig } from 'next-sitemap';

/**
 * Settings for `next-sitemap`, which generates `public/sitemap.xml` and `public/robots.txt` after each build.
 */
const sitemapConfig: IConfig = {
    /** Other language versions of each page. */
    alternateRefs: [],
    /** Adds a `<lastmod>` date to each URL. */
    autoLastmod: true,
    changefreq: 'daily',
    /** Writes a single sitemap instead of an index that links to several. */
    generateIndexSitemap: false,
    /** Generates `robots.txt` alongside the sitemap. */
    generateRobotsTxt: true,
    /** Folder the generated files are written to. */
    outDir: 'public',
    priority: 0.7,
    robotsTxtOptions: {
        includeNonIndexSitemaps: true,
        policies: [
            { allow: '/', userAgent: '*' },
            { disallow: '/', userAgent: 'SemrushBot' },
            { disallow: '/', userAgent: 'SemrushBot-SA' },
            { disallow: '/', userAgent: 'MJ12bot' }
        ]
    },
    sitemapBaseFileName: 'sitemap',
    /** Maximum number of URLs per sitemap file. */
    sitemapSize: 5000,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    /** Next.js build output that the sitemap is generated from. */
    sourceDir: '.next'
};

export default sitemapConfig;
