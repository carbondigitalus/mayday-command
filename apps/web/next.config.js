const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "style-src 'self' 'unsafe-inline'",
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
