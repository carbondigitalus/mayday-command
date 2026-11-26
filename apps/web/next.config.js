const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com https://www.clarity.ms https://*.clarity.ms https://c.bing.com https://static.ads-twitter.com https://cdn.segment.com https://app.termageddon.com",
    "img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com https://*.g.doubleclick.net https://www.facebook.com https://staticxx.facebook.com https://analytics.tiktok.com https://business-api.tiktok.com https://c.bing.com https://*.clarity.ms https://static.ads-twitter.com https://analytics.twitter.com",
    "connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com https://www.facebook.com https://analytics.tiktok.com https://business-api.tiktok.com https://*.clarity.ms https://c.bing.com https://analytics.twitter.com https://ads-api.twitter.com https://cdn.segment.com https://api.segment.io https://app.termageddon.com",
    "style-src 'self' 'unsafe-inline'",
    'frame-src https://www.googletagmanager.com',
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests'
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy-Report-Only',
                        value: contentSecurityPolicy
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin'
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff'
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN'
                    }
                ]
            }
        ];
    },
    async redirects() {
        return [
            {
                source: '/:path/',
                permanent: false,
                destination: '/:path'
            },
            {
                source: '/faq',
                destination: '/faqs',
                permanent: true
            },
            {
                source: '/sitemaps.xml',
                destination: '/sitemap.xml',
                permanent: true
            }
        ];
    }
};

export default nextConfig;
