// NPM Modules
import React from 'react';
import { Html, Head, Main, NextScript } from 'next/document';

// Custom Modules
import { BreadcrumbJsonLd, ImageJsonLd, OrganizationJsonLd } from 'next-seo';

export default class Document extends React.Component {
    render() {
        return (
            <Html lang='en'>
                <BreadcrumbJsonLd
                    items={[
                        {
                            name: 'Home',
                            item: process.env.NEXT_PUBLIC_SITE_URL
                        }
                    ]}
                />
                <ImageJsonLd
                    images={[
                        {
                            acquireLicensePage:
                                'https://github.com/carbondigitalus/mayday-command/blob/main/license.md',
                            contentUrl: `${process.env.NEXT_PUBLIC_SITE_URL}/img/logo/knowledge-graph-logo.png`,
                            creator: {
                                '@type': 'Organization',
                                'name': 'Mayday Command'
                            },
                            creditText: 'Mayday Command',
                            copyrightNotice: '© Carbon Digital',
                            license: 'https://github.com/carbondigitalus/mayday-command/blob/main/license.md'
                        }
                    ]}
                />
                <OrganizationJsonLd
                    type='Organization'
                    logo={`${process.env.NEXT_PUBLIC_SITE_URL}/img/logo/seo-schema-logo.png`}
                    legalName='Carbon Digital'
                    name='Mayday Command'
                    address={{
                        addressLocality: 'Charlotte',
                        addressRegion: 'NC',
                        addressCountry: 'US'
                    }}
                    contactPoint={[
                        {
                            contactType: 'Customer Service',
                            email: 'hello@maydaycommand.com'
                        }
                    ]}
                    sameAs={['https://github.com/carbondigitalus/mayday-command']}
                    url={process.env.NEXT_PUBLIC_SITE_URL}
                />
                <Head>
                    <link rel='icon' href='/img/favicon.ico' />
                </Head>
                <body>
                    <Main />
                    <NextScript />
                </body>
            </Html>
        );
    }
}
