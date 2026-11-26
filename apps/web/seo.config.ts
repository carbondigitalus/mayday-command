import { DefaultSeoProps } from 'next-seo/pages';

const SEOConfig: DefaultSeoProps = {
    additionalMetaTags: [
        {
            content: `${process.env.NEXT_PUBLIC_SITE_URL}/img/logo/open-graph-x-logo.png`,
            name: 'twitter:image'
        }
    ],
    description: 'Open-source help desk software for teams that run their own stack.',
    openGraph: {
        description: 'Open-source help desk software for teams that run their own stack.',
        images: [
            {
                alt: 'Mayday Command Logo',
                height: 856,
                type: 'image/png',
                url: `${process.env.NEXT_PUBLIC_SITE_URL}/img/logo/open-graph-fb-logo.png`,
                width: 1640
            }
        ],
        locale: 'en_US',
        siteName: 'Mayday Command',
        type: 'website',
        url: process.env.NEXT_PUBLIC_SITE_URL
    },
    twitter: {
        cardType: 'summary_large_image'
    }
};

export default SEOConfig;
