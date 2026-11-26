// NPM Modules
import { Link } from '@heroui/react';
import React from 'react';

// Custom Modules
import SocialLinks from '../molecules/social-links';

/** A link in a footer column. */
interface FooterLink {
    /** URL the link points to. */
    href: string;
    /** Opens the link in a new window when `true`. */
    isExternal?: boolean;
    /** Link text. */
    label: string;
}

/** A titled column of links in the footer. */
interface FooterColumn {
    /** Links in the column, in display order. */
    links: FooterLink[];
    /** Column heading. */
    title: string;
}

/** Base URL of the Mayday Command repository on GitHub. */
const repositoryURL = 'https://github.com/carbondigitalus/mayday-command';

/** Year the copyright notice starts, matching `license.md`. */
const copyrightStartYear = 2026;

/** Footer link columns, in display order. */
const footerColumns: FooterColumn[] = [
    {
        links: [
            { href: '/#how-it-works', label: 'How It Works' },
            { href: '/#self-hosting', label: 'Self-Hosting' },
            { href: '/#roadmap', label: 'Roadmap' }
        ],
        title: 'Product'
    },
    {
        links: [
            { href: repositoryURL, isExternal: true, label: 'GitHub' },
            { href: `${repositoryURL}/blob/main/.github/contributing.md`, isExternal: true, label: 'Contributing' },
            { href: `${repositoryURL}/blob/main/.github/security.md`, isExternal: true, label: 'Security' },
            { href: `${repositoryURL}/blob/main/license.md`, isExternal: true, label: 'License' }
        ],
        title: 'Project'
    },
    {
        links: [
            { href: `${repositoryURL}/issues/new?template=bug_report.yaml`, isExternal: true, label: 'Report a Bug' },
            {
                href: `${repositoryURL}/issues/new?template=support_request.yaml`,
                isExternal: true,
                label: 'Ask a Question'
            },
            {
                href: `${repositoryURL}/issues/new?template=feature_request.yaml`,
                isExternal: true,
                label: 'Propose a Feature'
            },
            { href: 'mailto:hello@maydaycommand.com', label: 'Email Us' }
        ],
        title: 'Get Help'
    }
];

export default class Footer extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        const currentYear = new Date().getFullYear();
        const copyrightYears =
            currentYear > copyrightStartYear ? `${copyrightStartYear}–${currentYear}` : `${copyrightStartYear}`;

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
                                <p className='mt-4 text-white'>
                                    Open-source help desk software for teams that run their own stack.
                                    <br />
                                    <br />
                                    Built by Carbon Digital.
                                </p>
                            </div>

                            <div className='footer-menu-section col-span-12 md:col-span-8 grid grid-cols-12 gap-4'>
                                {footerColumns.map((column) => (
                                    <div className='footer-menu-col col-span-12 lg:col-span-4' key={column.title}>
                                        <h2 className='text-xl font-bold mb-2 text-white'>{column.title}</h2>
                                        <ul className='space-y-1 text-white'>
                                            {column.links.map((link) => (
                                                <li key={link.label}>
                                                    <Link
                                                        href={link.href}
                                                        className='text-inherit hover:underline font-normal'
                                                        isExternal={link.isExternal}
                                                    >
                                                        {link.label}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className='copyright-row bg-black w-full'>
                    <div className='container mx-auto pt-2 pb-1 px-4'>
                        <div className='copyright-wrapper grid grid-cols-12 gap-4 pt-1 text-white text-lg'>
                            <div className='copyright-line col-span-12 sm:col-span-6 md:col-span-8'>
                                <p className='font-light text-sm text-white'>
                                    Copyright &copy; {copyrightYears} &middot;&nbsp;
                                    <Link
                                        href='https://carbondigital.us'
                                        className='text-sm text-inherit hover:underline'
                                        isExternal
                                    >
                                        Carbon Digital
                                    </Link>
                                    &nbsp;&middot; Mayday Command is released under the&nbsp;
                                    <Link
                                        href={`${repositoryURL}/blob/main/license.md`}
                                        className='text-sm text-inherit hover:underline'
                                        isExternal
                                    >
                                        MIT License
                                    </Link>
                                    .
                                </p>
                            </div>

                            <div className='social-line col-span-12 sm:col-span-6 md:col-span-4 uppercase'>
                                <SocialLinks id='footer-social-list' className='justify-end' />
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        );
    }
}
