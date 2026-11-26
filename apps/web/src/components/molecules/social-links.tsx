// NPM Modules
import { Link } from '@heroui/react';
import React from 'react';

// Custom Modules
import Github from '../atoms/icons/social-media/Github';

/** Props for {@link SocialLinks}. */
interface ComponentProps {
    /** Extra classes for the list, such as its alignment. */
    className?: string;
    /** Classes for each icon, such as its fill color. */
    iconClassName?: string;
    /** `id` for the list element. */
    id?: string;
    /** Width and height of each icon, in pixels. */
    size?: number;
}

/** A social media account shown by {@link SocialLinks}. */
interface SocialLink {
    /** URL of the account. */
    href: string;
    /** Icon component for the platform. */
    Icon: React.ComponentType<{ className?: string; size?: number | string }>;
    /** Platform name, read by screen readers. */
    label: string;
}

/** Mayday Command's social media accounts, in display order. */
const socialLinks: SocialLink[] = [
    { href: 'https://github.com/carbondigitalus/mayday-command', Icon: Github, label: 'Github' }
];

/** A row of icon links to Mayday Command's social media accounts. Each link opens in a new window. */
export default class SocialLinks extends React.Component<ComponentProps> {
    static defaultProps = {
        className: '',
        iconClassName: 'fill-safetyYellow',
        size: 24
    };

    render() {
        const { className, iconClassName, id, size } = this.props;

        return (
            <ul id={id} className={`flex ${className}`}>
                {socialLinks.map(({ href, Icon, label }) => (
                    <li key={label} className='p-1'>
                        <Link href={href} className='text-inherit' isExternal>
                            <Icon className={iconClassName} size={size} />
                            <span className='sr-only'>{label} (opens in a new window)</span>
                        </Link>
                    </li>
                ))}
            </ul>
        );
    }
}
