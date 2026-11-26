import { DefaultSeoProps } from 'next-seo/pages';

const SEOConfig: DefaultSeoProps = {
    description: 'Open-source help desk software for teams that run their own stack.',
    openGraph: {
        description: 'Open-source help desk software for teams that run their own stack.',
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
