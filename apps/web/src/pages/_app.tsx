// NPM Modules
import { HeroUIProvider } from '@heroui/react';
import Head from 'next/head';
import React from 'react';
import type { AppProps } from 'next/app';

// Custom Modules
import { generateDefaultSeo } from 'next-seo/pages';
import SEOConfig from '@/../seo.config';
import '@/assets/style.css';

export default class App extends React.Component<AppProps> {
    componentDidMount() {
        // Dev logs
        if (process.env.NODE_ENV === 'development') {
            console.log('NODE_ENV', process.env.NODE_ENV);
            console.log('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL);
            console.log('NEXT_PUBLIC_STORAGE_URL_FILES', process.env.NEXT_PUBLIC_STORAGE_URL_FILES);
            console.log('NEXT_PUBLIC_STORAGE_URL_UPLOADS', process.env.NEXT_PUBLIC_STORAGE_URL_UPLOADS);
            console.log('NEXT_PUBLIC_STORAGE_URL_WIDGET', process.env.NEXT_PUBLIC_STORAGE_URL_WIDGET);
        }
    }

    render() {
        const { Component, pageProps } = this.props;

        return (
            <HeroUIProvider>
                <Head>{generateDefaultSeo(SEOConfig)}</Head>

                <Component {...pageProps} />
            </HeroUIProvider>
        );
    }
}
