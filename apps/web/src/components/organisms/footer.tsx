// NPM Modules
import { Link } from '@heroui/react';
import React from 'react';

// Custom Modules
import Facebook from '../atoms/icons/social-media/Facebook';
import Instagram from '../atoms/icons/social-media/Instagram';
import LinkedIn from '../atoms/icons/social-media/LinkedIn';
import Medium from '../atoms/icons/social-media/Medium';
import Reddit from '../atoms/icons/social-media/Reddit';
import XTwitter from '../atoms/icons/social-media/XTwitter';
import YouTube from '../atoms/icons/social-media/YouTube';

export default class Footer extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <footer className='bg-black py-20'>
                <div className='footer py-10 w-full'>
                    <div className='container mx-auto pt-8 pb-0 px-4'>
                        <div className='footer-grid grid grid-cols-12 gap-4'>
                            <div className='footer-logo-col col-span-12 md:col-span-4'>
                                <Link href='/' className='logo-link footer-logo-link text-inherit'>
                                    <img
                                        src='/img/logo/logo-horizontal-white.png'
                                        alt='Mayday Command Logo'
                                        width={250}
                                        height={123}
                                    />
                                </Link>
                                <br />
                                <p className='mt-4 text-white'>
                                    Veteran Database. The single point of reference for Veteran Business &amp;
                                    Entertainment.
                                    <br />
                                    <br />
                                    100% Veteran-Owned & Operated.
                                </p>
                                <Link
                                    href='https://play.google.com/store/apps/details?id=com.veterandb.android'
                                    className='text-white hover:underline font-normal'
                                    isExternal
                                >
                                    <img
                                        src='/img/icons/google-play-store.webp'
                                        alt='Google Play Store Logo'
                                        width={200}
                                        height={200}
                                    />
                                </Link>
                            </div>

                            <div className='footer-menu-section col-span-12 md:col-span-8 grid grid-cols-12 gap-4'>
                                <div className='veteran-listings-col footer-menu-col col-span-12 lg:col-span-3'>
                                    <h2 className='text-xl font-bold mb-2 text-white'>Veteran Listings</h2>
                                    <ul className='space-y-1 text-white'>
                                        <li>
                                            <Link href='/business' className='text-white hover:underline font-normal'>
                                                Business
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href='/directory'
                                                className='text-inherit hover:underline font-normal'
                                            >
                                                Directory
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href='/nonprofit'
                                                className='text-inherit hover:underline font-normal'
                                            >
                                                NonProfit
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href='/podcast' className='text-inherit hover:underline font-normal'>
                                                Podcast
                                            </Link>
                                        </li>
                                    </ul>
                                </div>

                                <div className='entertainment-col footer-menu-col col-span-12 lg:col-span-3'>
                                    <h2 className='text-xl font-bold mb-2 text-white'>VeteranDB Shops</h2>
                                    <ul className='space-y-1 mb-6 text-white'>
                                        <li>
                                            <Link
                                                href='https://exchange.veterandb.com/?utm_source=veterandb.com&utm_medium=website&utm_campaign=exchange-store&utm_content=header'
                                                className='text-inherit hover:underline font-normal'
                                                isExternal
                                            >
                                                Exchange
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href='https://gear.veterandb.com/?utm_source=veterandb.com&utm_medium=website&utm_campaign=gear-store&utm_content=footer'
                                                className='text-inherit hover:underline font-normal'
                                                isExternal
                                            >
                                                Gear Store
                                            </Link>
                                        </li>
                                    </ul>

                                    <h2 className='text-xl font-bold mb-2 text-white'>Entertainment</h2>
                                    <ul className='space-y-1'>
                                        <li>
                                            <span className='font-normal text-white'>Coming Soon!</span>
                                        </li>
                                    </ul>
                                </div>

                                <div className='useful-links-col footer-menu-col col-span-12 lg:col-span-3'>
                                    <h2 className='text-xl font-bold mb-2 text-white'>Useful Links</h2>
                                    <ul className='space-y-1 text-white'>
                                        <li>
                                            <Link href='/blog' className='text-inherit hover:underline font-normal'>
                                                Blog
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href='/faqs' className='text-inherit hover:underline font-normal'>
                                                FAQs
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href='/magazine' className='text-inherit hover:underline font-normal'>
                                                Magazine
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href={process.env.NEXT_PUBLIC_SSO_URL}
                                                className='text-inherit hover:underline font-normal'
                                                isExternal
                                            >
                                                Login
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href={`${process.env.NEXT_PUBLIC_SSO_URL}/register`}
                                                className='text-inherit hover:underline font-normal'
                                                isExternal
                                            >
                                                Register
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href='https://veterandb.canny.io'
                                                className='text-inherit hover:underline font-normal'
                                                isExternal
                                            >
                                                Roadmap
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href='/veteranfm'
                                                className='text-inherit hover:underline font-normal'
                                            >
                                                VeteranFM
                                            </Link>
                                        </li>
                                    </ul>
                                </div>

                                <div className='company-links-col footer-menu-col col-span-12 lg:col-span-3'>
                                    <h2 className='text-xl font-bold mb-2 text-white'>Company</h2>
                                    <ul className='space-y-1 text-white'>
                                        <li>
                                            <Link href='/about' className='text-inherit hover:underline font-normal'>
                                                About
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href='/advertise'
                                                className='text-inherit hover:underline font-normal'
                                            >
                                                Advertise
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href='https://github.com/carbondigitalus/mayday-command/blob/main/license.md'
                                                className='text-inherit hover:underline font-normal'
                                                isExternal
                                            >
                                                License
                                            </Link>
                                        </li>
                                        <li>
                                            <Link href='/press' className='text-inherit hover:underline font-normal'>
                                                Press Releases
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href='https://status.veterandb.com'
                                                className='text-inherit hover:underline font-normal'
                                                isExternal
                                            >
                                                Server Status
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                href='https://support.veterandb.com'
                                                className='text-inherit hover:underline font-normal'
                                                isExternal
                                            >
                                                Support
                                            </Link>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='copyright-row bg-black w-full'>
                    <div className='container mx-auto pt-2 pb-1 px-4'>
                        <div className='copyright-wrapper grid grid-cols-12 gap-4 pt-1 text-white text-lg'>
                            <div className='copyright-line col-span-12 sm:col-span-6 md:col-span-4'>
                                <p className='font-light text-sm text-white'>
                                    Copyright &copy; 2020-
                                    {new Date().getFullYear()} &middot; Veteran Database &middot; A&nbsp;
                                    <Link
                                        href='https://carbondigital.us'
                                        className='text-sm text-inherit hover:underline'
                                        isExternal
                                    >
                                        Carbon Digital
                                    </Link>
                                    &nbsp;Project &middot; All Rights Reserved.
                                </p>
                            </div>

                            <div className='social-line col-span-12 sm:col-span-6 md:col-span-8 uppercase'>
                                <ul id='footer-social-list' className='flex justify-end space-x-0 text-white'>
                                    <li className='font-bold p-1 text-base'>
                                        <Link
                                            href='https://www.facebook.com/veterandb'
                                            className='text-inherit hover:underline'
                                            isExternal
                                        >
                                            <Facebook className='fill-white' size={24} />
                                            <span className='sr-only'>Facebook (opens in a new window)</span>
                                        </Link>
                                    </li>
                                    <li className='font-bold p-1 text-base'>
                                        <Link
                                            href='https://www.instagram.com/veterandatabase/'
                                            className='text-inherit hover:underline'
                                            isExternal
                                        >
                                            <Instagram className='fill-white' size={24} />
                                            <span className='sr-only'>Instagram (opens in a new window)</span>
                                        </Link>
                                    </li>
                                    <li className='font-bold p-1 text-base'>
                                        <Link
                                            href='https://www.linkedin.com/company/veterandb/'
                                            className='text-inherit hover:underline'
                                            isExternal
                                        >
                                            <LinkedIn className='fill-white' size={24} />
                                            <span className='sr-only'>LinkedIn (opens in a new window)</span>
                                        </Link>
                                    </li>
                                    <li className='font-bold p-1 text-base'>
                                        <Link
                                            href='https://medium.com/@mayday-command'
                                            className='text-inherit hover:underline'
                                            isExternal
                                        >
                                            <Medium className='fill-white' size={24} />
                                            <span className='sr-only'>Medium (opens in a new window)</span>
                                        </Link>
                                    </li>
                                    <li className='font-bold p-1 text-base'>
                                        <Link
                                            href='https://www.reddit.com/r/VeteranDatabase/'
                                            className='text-inherit hover:underline'
                                            isExternal
                                        >
                                            <Reddit className='fill-white' size={24} />
                                            <span className='sr-only'>Reddit (opens in a new window)</span>
                                        </Link>
                                    </li>
                                    <li className='font-bold p-1 text-base'>
                                        <Link
                                            href='https://twitter.com/VeteranDatabase'
                                            className='text-inherit hover:underline'
                                            isExternal
                                        >
                                            <XTwitter className='fill-white' size={24} />
                                            <span className='sr-only'>
                                                X (formerly Twitter) (opens in a new window)
                                            </span>
                                        </Link>
                                    </li>
                                    <li className='font-bold p-1 text-base'>
                                        <Link
                                            href='https://www.youtube.com/@mayday-command'
                                            className='text-inherit hover:underline'
                                            isExternal
                                        >
                                            <YouTube className='fill-white' size={24} />
                                            <span className='sr-only'>YouTube (opens in a new window)</span>
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        );
    }
}
