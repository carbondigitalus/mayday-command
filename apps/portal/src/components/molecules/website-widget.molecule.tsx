// NPM Modules
import * as React from 'react';

// Custom Modules
import CodeBlock from 'components/molecules/code-block.molecule';
import { getWidgetCode, WidgetEntity, WidgetLogo } from 'utils/widget/getWidgetCode';

interface ComponentProps {
    entity: WidgetEntity;
    /** Slug of the listing the widgets link to. */
    slug: string;
}

interface WidgetPanel {
    logo: WidgetLogo;
    title: string;
}

/** The widgets, in the order they are shown. The light and white logos only show on a dark panel, and their code blocks
 * take the inverse style to stand out from it. */
const widgetPanels: WidgetPanel[] = [
    { logo: 'black', title: 'Black Logo Preview:' },
    { logo: 'dark', title: 'Dark Logo Preview:' },
    { logo: 'light', title: 'Light Logo Preview:' },
    { logo: 'white', title: 'White Logo Preview:' }
];

const logoNames: Record<WidgetLogo, string> = {
    black: 'Black',
    dark: 'Dark',
    light: 'Light',
    white: 'White'
};

/** The "Website Widget" content of a listing's edit page: each widget's logo, and its code to copy. The same on every
 * listing, which differ only in the address the widget links to. */
export default class WebsiteWidget extends React.Component<ComponentProps> {
    constructor(props: ComponentProps) {
        super(props);
    }

    render() {
        const { entity, slug } = this.props;

        return (
            <>
                <h3 className='font-bold mb-5 text-2xl text-greenDarkest'>Website Widget</h3>
                <p className='mb-6'>
                    Copy the code for your desired widget, and paste it into your website. Preferably in the footer.
                </p>

                {widgetPanels.map(({ logo, title }, index) => {
                    const isDarkPanel = logo === 'light' || logo === 'white';
                    const headingColor = isDarkPanel ? 'text-white' : 'text-greenDarkest';

                    return (
                        <div
                            className={`${isDarkPanel ? 'bg-greenDarkest text-white' : 'bg-gray-100'} p-6 rounded-lg ${index < widgetPanels.length - 1 ? 'mb-6' : ''}`}
                            key={logo}
                        >
                            <h3 className={`font-bold mb-5 text-2xl ${headingColor}`}>{title}</h3>
                            <div className='max-w-xs mb-4'>
                                <img
                                    alt={`VeteranDB ${logoNames[logo]} Logo`}
                                    className='w-full h-auto'
                                    src={`${process.env.NEXT_PUBLIC_STORAGE_URL_WIDGET}/logo-horizontal-${logo}.png`}
                                />
                            </div>
                            <h4 className={`font-bold mb-5 text-xl ${headingColor}`}>Widget Code:</h4>
                            <CodeBlock
                                ariaLabel={`${logoNames[logo]} logo widget code`}
                                code={getWidgetCode({ entity, logo, slug })}
                                variant={isDarkPanel ? 'light' : 'dark'}
                            />
                        </div>
                    );
                })}
            </>
        );
    }
}
