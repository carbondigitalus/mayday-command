// NPM Modules
import {
    Dropdown,
    DropdownItem,
    DropdownMenu,
    DropdownTrigger,
    Link,
    Navbar,
    NavbarBrand,
    NavbarContent,
    NavbarItem,
    NavbarMenu,
    NavbarMenuItem
} from '@heroui/react';
import React from 'react';
import ChevronDown from '../atoms/icons/ChevronDown';
import Menu from '../atoms/icons/Menu';

interface PageProps {
    child?: any;
}

/** A link in the main navigation. An item with `children` has no link of its own: it is a dropdown (a group in the
 * mobile menu) that holds the links in `children`. */
interface NavItem {
    children?: NavItem[];
    href?: string;
    isExternal?: boolean;
    label: string;
}

interface PageState {
    isMenuOpen: boolean;
}

/** HeroUI sizes the mobile menu with `100vh`, which on mobile browsers is the viewport with the address bar hidden, so
 * the bottom of the menu falls below the visible screen and the last links can't be scrolled into view. `100dvh`
 * tracks the visible viewport instead. */
const mobileMenuVariants = {
    enter: {
        height: 'calc(100dvh - var(--navbar-height))',
        transition: { duration: 0.3, ease: 'easeOut' as const }
    },
    exit: {
        height: 0,
        transition: { duration: 0.25, ease: 'easeIn' as const }
    }
};

export default class Header extends React.Component<PageProps, PageState> {
    constructor(props: PageProps) {
        super(props);

        this.state = {
            isMenuOpen: false
        };
    }

    private setIsMenuOpen = (isOpen: boolean) => {
        this.setState({ isMenuOpen: isOpen });
    };

    render() {
        const { isMenuOpen } = this.state;

        const topBarNavItems = [
            { label: 'Login', href: process.env.NEXT_PUBLIC_SSO_URL },
            {
                label: 'Register',
                href: `${process.env.NEXT_PUBLIC_SSO_URL}/register`
            },
            { label: 'Roadmap', href: 'https://veterandb.canny.io' },
            { label: 'Server Status', href: 'https://status.veterandb.com' }
        ];

        const mainNavItems: NavItem[] = [
            { label: 'Home', href: '/' },
            {
                label: 'Company',
                children: [
                    { label: 'About', href: '/about' },
                    { label: 'Advertise', href: '/advertise' },
                    { label: 'FAQs', href: '/faqs' }
                ]
            },
            {
                label: 'Listings',
                children: [
                    { label: 'Business', href: '/business' },
                    { label: 'Directory', href: '/directory' },
                    { label: 'NonProfit', href: '/nonprofit' },
                    { label: 'Podcast', href: '/podcast' }
                ]
            },
            {
                label: 'Media',
                children: [
                    { label: 'Blog', href: '/blog' },
                    { label: 'Press Releases', href: '/press' },
                    { label: 'Magazine', href: '/magazine' },
                    { label: 'VeteranFM', href: '/veteranfm' }
                ]
            },
            {
                label: 'Shop',
                children: [
                    {
                        label: 'Exchange',
                        href: 'https://exchange.veterandb.com/?utm_source=veterandb.com&utm_medium=website&utm_campaign=exchange-store&utm_content=header',
                        isExternal: true
                    },
                    {
                        label: 'Gear',
                        href: 'https://gear.veterandb.com/?utm_source=veterandb.com&utm_medium=website&utm_campaign=gear-store&utm_content=header',
                        isExternal: true
                    }
                ]
            }
        ];

        const mobileOnlyNavItems = [];

        return (
            <header>
                {/* Top Bar */}
                <div className='bg-black text-white p-1 w-full hidden lg:block'>
                    <div className='max-w-7xl mx-auto px-4'>
                        <div className='flex justify-between items-center'>
                            <div>
                                <p className='font-medium p-2'>
                                    <Link
                                        href='mailto:hello@maydaycommand.com'
                                        className='text-inherit hover:underline'
                                    >
                                        hello@maydaycommand.com
                                    </Link>
                                </p>
                            </div>
                            <div className='uppercase'>
                                <ul className='flex justify-end space-x-0'>
                                    {topBarNavItems.map((item) => (
                                        <li key={item.label} className='font-bold p-2'>
                                            <Link
                                                href={item.href}
                                                className='text-inherit text-sm hover:underline'
                                                isExternal
                                            >
                                                {item.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Navbar */}
                <Navbar
                    height='5rem'
                    isMenuOpen={isMenuOpen}
                    onMenuOpenChange={this.setIsMenuOpen}
                    classNames={{
                        base: 'bg-safetyYellow',
                        wrapper: 'max-w-7xl mx-auto py-10',
                        content: 'uppercase text-2xl'
                    }}
                >
                    <NavbarContent>
                        <NavbarBrand as='li'>
                            <Link href='/' className='logo-link text-inherit'>
                                <img
                                    src='/img/logo/logo-horizontal-black.png'
                                    alt='Mayday Command Logo'
                                    width={250}
                                    height={123}
                                />
                            </Link>
                        </NavbarBrand>
                    </NavbarContent>

                    <NavbarContent className='hidden lg:flex gap-4 text-black' justify='end'>
                        {mainNavItems.map((item) => (
                            <NavbarItem key={item.label}>
                                {item.children ? (
                                    <Dropdown
                                        classNames={{ content: 'bg-white min-w-48 p-1 rounded-lg' }}
                                        placement='bottom-start'
                                    >
                                        <DropdownTrigger>
                                            <button
                                                className='flex font-bold gap-1 hover:underline items-center text-inherit text-medium uppercase'
                                                type='button'
                                            >
                                                {item.label}
                                                <ChevronDown className='fill-black' size={16} />
                                            </button>
                                        </DropdownTrigger>
                                        <DropdownMenu
                                            aria-label={item.label}
                                            itemClasses={{
                                                base: [
                                                    'data-[hover=true]:bg-safetyYellow',
                                                    'data-[focus-visible=true]:bg-safetyYellow',
                                                    'text-black'
                                                ],
                                                title: 'font-bold text-medium uppercase'
                                            }}
                                        >
                                            {item.children.map((child) => (
                                                <DropdownItem
                                                    href={child.href}
                                                    key={child.label}
                                                    rel={child.isExternal ? 'noopener noreferrer' : undefined}
                                                    target={child.isExternal ? '_blank' : undefined}
                                                >
                                                    {child.label}
                                                </DropdownItem>
                                            ))}
                                        </DropdownMenu>
                                    </Dropdown>
                                ) : (
                                    <Link
                                        href={item.href}
                                        className='font-bold text-inherit hover:underline'
                                        isExternal={item.isExternal}
                                    >
                                        {item.label}
                                    </Link>
                                )}
                            </NavbarItem>
                        ))}
                    </NavbarContent>

                    <NavbarContent className='lg:hidden text-black' justify='end'>
                        <NavbarItem>
                            <button
                                onClick={() => this.setIsMenuOpen(!isMenuOpen)}
                                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                                className='lg:hidden text-black p-2'
                            >
                                <Menu className='fill-black cursor-pointer' size={40} />
                            </button>
                        </NavbarItem>
                    </NavbarContent>

                    <NavbarMenu
                        className='bg-black mobile-nav-wrapper pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-10'
                        motionProps={{ variants: mobileMenuVariants }}
                    >
                        {/* Main Navigation Items */}
                        {mainNavItems.map((item) =>
                            item.children ? (
                                <React.Fragment key={item.label}>
                                    <NavbarMenuItem>
                                        <p className='font-bold text-lg text-white'>{item.label}</p>
                                    </NavbarMenuItem>
                                    {item.children.map((child) => (
                                        <NavbarMenuItem key={`mobile-${item.label}-${child.label}`}>
                                            <Link
                                                href={child.href}
                                                className='font-bold hover:underline pl-4 text-lg text-white'
                                                isExternal={child.isExternal}
                                            >
                                                {child.label}
                                            </Link>
                                        </NavbarMenuItem>
                                    ))}
                                </React.Fragment>
                            ) : (
                                <NavbarMenuItem key={item.label}>
                                    <Link
                                        href={item.href}
                                        className='hover:underline font-bold text-white text-lg'
                                        isExternal={item.isExternal}
                                    >
                                        {item.label}
                                    </Link>
                                </NavbarMenuItem>
                            )
                        )}

                        {/* Divider */}
                        <NavbarMenuItem>
                            <div className='w-full border-t border-safetyYellow my-2'></div>
                        </NavbarMenuItem>

                        {/* Top Bar Items for Mobile */}
                        {topBarNavItems.map((item) => (
                            <NavbarMenuItem key={`mobile-${item.label}`}>
                                <Link
                                    href={item.href}
                                    className='hover:underline font-bold text-white text-lg'
                                    isExternal
                                >
                                    {item.label}
                                </Link>
                            </NavbarMenuItem>
                        ))}

                        {/* Mobile Only Items */}
                        {mobileOnlyNavItems.map((item) => (
                            <NavbarMenuItem key={`mobile-only-${item.label}`}>
                                <Link
                                    href={item.href}
                                    className='text-inherit hover:underline font-bold text-2xl uppercase'
                                    isExternal={item.isExternal}
                                >
                                    {item.label}
                                </Link>
                            </NavbarMenuItem>
                        ))}
                    </NavbarMenu>
                </Navbar>
            </header>
        );
    }
}
