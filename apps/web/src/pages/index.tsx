// NPM Modules
import { Button, Link } from '@heroui/react';
import Head from 'next/head';
import { generateNextSeo } from 'next-seo/pages';
import React from 'react';

// Custom Modules
import GlobalPageWrapper from '@/components/templates/global.template';

export default class HomePage extends React.Component {
    render() {
        const workflowSteps: { description: string; title: string }[] = [
            {
                description: 'A request arrives by email or through the public intake form and becomes a ticket.',
                title: 'A customer sends a Mayday.'
            },
            {
                description: 'New and open requests land in a shared inbox, each with a clear owner and status.',
                title: 'Your team picks it up.'
            },
            {
                description:
                    'Replies and internal notes stay on the same ticket, so anyone can pick up where someone else left off.',
                title: 'The conversation stays together.'
            }
        ];

        const roadmapItems: string[] = [
            'Shared inbox',
            'Email to ticket',
            'Web intake',
            'Replies and internal notes',
            'Assignment and status',
            'Customer portal',
            'Email connection checks',
            'Railway template'
        ];

        return (
            <GlobalPageWrapper>
                <Head>
                    {generateNextSeo({
                        canonical: process.env.NEXT_PUBLIC_SITE_URL,
                        description:
                            'Open-source help desk software for teams that run their own stack. A shared inbox, a clear owner for every request, and the full conversation on one ticket.',
                        openGraph: {
                            description:
                                'Open-source help desk software for teams that run their own stack. A shared inbox, a clear owner for every request, and the full conversation on one ticket.',
                            title: 'Mayday Command | Open-Source Help Desk Software',
                            url: process.env.NEXT_PUBLIC_SITE_URL
                        },
                        title: 'Mayday Command | Open-Source Help Desk Software'
                    })}
                </Head>
                <main className='bg-white w-full'>
                    <section id='hero' className='bg-center bg-cover bg-no-repeat home-hero min-h-160 relative'>
                        <div className='absolute inset-0 bg-black/70' />
                        <div className='max-w-7xl mx-auto px-4 py-20 relative'>
                            <div className='mr-auto pt-12 w-full lg:w-2/3'>
                                <div className='flex flex-col-reverse'>
                                    <h1 className='font-black font-quatro leading-none mb-8 text-3xl sm:text-5xl lg:text-6xl xl:text-7xl uppercase'>
                                        <span className='flex flex-wrap text-white'>
                                            Shared&nbsp;<span className='block text-safetyYellow'>Inbox.</span>
                                        </span>
                                        <span className='flex flex-wrap text-white'>
                                            Clear&nbsp;<span className='block text-safetyYellow'>Owners.</span>
                                        </span>
                                        <span className='flex flex-wrap text-white'>
                                            Full&nbsp;<span className='block text-safetyYellow'>History.</span>
                                        </span>
                                    </h1>
                                    <p className='font-bold mb-2 text-white uppercase'>
                                        Open-source help desk for teams that run their own stack
                                    </p>
                                </div>
                                <p className='leading-loose max-w-xl mb-10 text-white'>
                                    A customer sends a Mayday. Your team picks it up, sees the full conversation, and
                                    knows who&apos;s handling it. When the customer replies, the conversation continues
                                    on the same ticket.
                                </p>
                                <div className='flex flex-row flex-wrap gap-4'>
                                    <Button
                                        as={Link}
                                        className='bg-safetyYellow font-bold text-black uppercase'
                                        href='https://github.com/carbondigitalus/mayday-command'
                                        isExternal
                                        radius='sm'
                                        size='lg'
                                    >
                                        View on GitHub
                                    </Button>
                                    <Button
                                        as={Link}
                                        className='bg-white font-bold text-black uppercase'
                                        href='https://github.com/carbondigitalus/mayday-command#first-release-roadmap'
                                        isExternal
                                        radius='sm'
                                        size='lg'
                                    >
                                        See the Roadmap
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>
                    <section id='how-it-works' className='bg-safetyYellow font-display py-20'>
                        <div className='grid grid-cols-1 lg:grid-cols-2 max-w-7xl mx-auto overflow-hidden px-4'>
                            <div
                                className='bg-black bg-center bg-cover min-h-96 overflow-hidden relative rounded-lg'
                                style={{ backgroundImage: `url('/img/content/mayday-command-support-handoff.jpg')` }}
                            >
                                <div className='absolute bg-linear-to-b from-transparent inset-0 to-black/95 via-transparent' />
                                <div className='absolute bottom-0 left-0 p-8 right-0'>
                                    <div className='flex flex-col-reverse'>
                                        <h2 className='font-extrabold leading-none text-4xl md:text-5xl text-white uppercase'>
                                            Every Mayday.
                                            <br />
                                            Answered.
                                        </h2>
                                        <p className='font-bold mb-4 text-white text-sm tracking-widest uppercase'>
                                            Built for support teams
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className='flex flex-col justify-center lg:p-12 py-8'>
                                <div className='flex flex-col-reverse'>
                                    <h2 className='font-extrabold leading-none mb-6 text-4xl md:text-6xl text-black uppercase'>
                                        From first message.
                                        <br />
                                        To last reply.
                                    </h2>
                                    <h3 className='font-bold mb-4 text-black tracking-widest uppercase'>
                                        How it works
                                    </h3>
                                </div>
                                <p className='leading-loose mb-8 text-black'>
                                    Mayday Command is built around the everyday support workflow. Every request follows
                                    the same path, and everyone on the team can see where it stands.
                                </p>
                                <ol className='flex flex-col gap-5 mb-10'>
                                    {workflowSteps.map((step, index) => (
                                        <li className='flex flex-row gap-4' key={step.title}>
                                            <span className='bg-black flex font-bold h-8 items-center justify-center rounded-md shrink-0 text-white text-lg w-8'>
                                                {String(index + 1).padStart(2, '0')}
                                            </span>
                                            <div>
                                                <h3 className='font-bold text-black text-2xl uppercase'>
                                                    {step.title}
                                                </h3>
                                                <p className='text-black text-sm'>{step.description}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                                <div>
                                    <Button
                                        as={Link}
                                        className='bg-black font-bold text-white uppercase'
                                        href='https://github.com/carbondigitalus/mayday-command'
                                        isExternal
                                        radius='sm'
                                        size='lg'
                                    >
                                        Follow on GitHub
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>
                    <section id='self-hosting' className='font-display py-20'>
                        <div className='grid grid-cols-1 lg:grid-cols-2 max-w-7xl mx-auto overflow-hidden px-4'>
                            <div className='flex flex-col justify-center lg:p-12 py-8'>
                                <div className='flex flex-col-reverse'>
                                    <h2 className='font-extrabold leading-none mb-6 text-4xl md:text-6xl text-black uppercase'>
                                        Your servers.
                                        <br />
                                        Your data.
                                        <br />
                                        Your upgrades.
                                    </h2>
                                    <p className='font-bold mb-4 text-black tracking-widest uppercase'>
                                        Self-hosted and open source
                                    </p>
                                </div>
                                <h3 className='font-bold leading-relaxed mb-4 text-black text-xl'>
                                    Self-hosters need readable source, documented configuration, and upgrades they can
                                    review before applying.
                                </h3>
                                <p className='leading-loose mb-8 text-black'>
                                    Run Mayday Command on your own infrastructure under the MIT license. Native Node.js
                                    deployment is a first-class path, with Docker optional. Before an upgrade replaces
                                    anything, the planned updater will list your local changes and stop so you can
                                    review them.
                                </p>
                                <div>
                                    <Button
                                        as={Link}
                                        className='bg-black font-bold text-white uppercase'
                                        href='https://github.com/carbondigitalus/mayday-command/blob/main/license.md'
                                        isExternal
                                        radius='sm'
                                        size='lg'
                                    >
                                        Read the License
                                    </Button>
                                </div>
                            </div>
                            <div
                                className='bg-black bg-center bg-cover min-h-96 overflow-hidden relative rounded-lg'
                                style={{ backgroundImage: `url('/img/content/mayday-command-server-rack.jpg')` }}
                            >
                                <div className='absolute bg-linear-to-b from-transparent inset-0 to-black/95 via-black/30' />
                                <div className='absolute bottom-0 left-0 p-8 right-0'>
                                    <div className='flex flex-col-reverse'>
                                        <h2 className='font-extrabold leading-none text-4xl md:text-5xl text-white uppercase'>
                                            Run your
                                            <br />
                                            own stack.
                                        </h2>
                                        <p className='font-bold mb-4 text-white tracking-widest uppercase'>
                                            Readable source. Reviewable upgrades.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                    <section id='roadmap' className='bg-white font-display py-20'>
                        <div className='gap-12 grid grid-cols-1 items-center lg:grid-cols-2 max-w-7xl mx-auto px-4'>
                            <div className='flex items-center justify-center min-h-96 overflow-hidden py-12 relative rounded-lg'>
                                <div className='absolute bg-radial from-black inset-0 to-black' />
                                <div className='h-96 relative w-52 sm:w-64'>
                                    <div className='absolute bg-safetyYellow/60 h-full left-8 rotate-6 rounded-md shadow-2xl top-0 w-full' />
                                    <div className='absolute bg-safetyYellow flex flex-col h-full left-0 p-5 -rotate-6 rounded-md shadow-2xl top-0 w-full'>
                                        <img
                                            alt='Mayday Command'
                                            className='h-auto mb-4 w-40'
                                            src='/img/logo/logo-horizontal-black.png'
                                        />
                                        <p className='font-black font-quatro leading-none mb-4 text-black text-xl sm:text-2xl uppercase'>
                                            First release roadmap
                                        </p>
                                        <ul className='flex flex-col gap-2'>
                                            {roadmapItems.slice(0, 4).map((item) => (
                                                <li
                                                    className='flex font-bold gap-2 items-center text-black text-sm'
                                                    key={item}
                                                >
                                                    <span className='border-2 border-black h-4 rounded-sm shrink-0 w-4' />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                        <p className='font-bold mt-auto text-black text-xs tracking-widest uppercase'>
                                            Mayday Command &middot; In development
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div className='flex flex-col-reverse'>
                                    <h2 className='font-extrabold leading-none mb-6 text-4xl md:text-6xl text-black uppercase'>
                                        Built in the open.
                                        <br />
                                        Shaped by
                                        <br />
                                        support teams.
                                    </h2>
                                    <span className='bg-black font-bold mb-4 px-3 py-1 rounded-md self-start text-white text-sm tracking-widest uppercase'>
                                        In development
                                    </span>
                                    <p className='font-bold mb-4 text-black tracking-widest uppercase'>
                                        First release roadmap
                                    </p>
                                </div>
                                <p className='leading-loose mb-6 text-black'>
                                    Mayday Command is in early development. The first release focuses on the everyday
                                    support workflow, with Microsoft 365 as the first planned mail integration.
                                </p>
                                <ul className='flex flex-row flex-wrap gap-2 mb-6'>
                                    {roadmapItems.map((item) => (
                                        <li
                                            className='bg-safetyYellow font-bold px-3 py-1 rounded-md text-black text-sm uppercase'
                                            key={item}
                                        >
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <p className='leading-loose mb-8 text-black'>
                                    Proposing a feature or a substantial change? Start with a GitHub issue: describe the
                                    workflow, who it affects, and where it breaks down today.
                                </p>
                                <div className='flex flex-row flex-wrap gap-4'>
                                    <Button
                                        as={Link}
                                        className='bg-black font-bold text-white uppercase'
                                        href='https://github.com/carbondigitalus/mayday-command#first-release-roadmap'
                                        isExternal
                                        radius='sm'
                                        size='lg'
                                    >
                                        See the Roadmap
                                    </Button>
                                    <Button
                                        as={Link}
                                        className='bg-safetyYellow font-bold text-black uppercase'
                                        href='https://github.com/carbondigitalus/mayday-command/issues/new/choose'
                                        isExternal
                                        radius='sm'
                                        size='lg'
                                    >
                                        Propose a Feature
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </GlobalPageWrapper>
        );
    }
}
