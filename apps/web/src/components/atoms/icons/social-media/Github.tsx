// NPM Modules
import React from 'react';

interface PageProps {
    className?: string;
    size?: number | string;
}

export default class Github extends React.Component<PageProps> {
    static defaultProps = {
        className: '',
        size: 250
    };

    constructor(props: PageProps) {
        super(props);
    }

    render() {
        return (
            <svg
                aria-hidden='true'
                className={this.props.className}
                focusable='false'
                height={this.props.size}
                width={this.props.size}
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 640 640'
            >
                <path d='M280.5 426.5c-66-8-112.5-55.5-112.5-117 0-25 9-52 24-70-6.5-16.5-5.5-51.5 2-66 20-2.5 47 8 63 22.5 19-6 39-9 63.5-9s44.5 3 62.5 8.5c15.5-14 43-24.5 63-22 7 13.5 8 48.5 1.5 65.5 16 19 24.5 44.5 24.5 70.5 0 61.5-46.5 108-113.5 116.5 17 11 28.5 35 28.5 62.5l0 52C387 555.5 399.5 564 414.5 558 505 523.5 576 433 576 321 576 179.5 461 64 319.5 64S64 179.5 64 321c0 111 70.5 203 165.5 237.5 13.5 5 26.5-4 26.5-17.5l0-40c-7 3-16 5-24 5-33 0-52.5-18-66.5-51.5-5.5-13.5-11.5-21.5-23-23-6-0.5-8-3-8-6 0-6 10-10.5 20-10.5 14.5 0 27 9 40 27.5 10 14.5 20.5 21 33 21s20.5-4.5 32-16c8.5-8.5 15-16 21-21z' />
            </svg>
        );
    }
}
