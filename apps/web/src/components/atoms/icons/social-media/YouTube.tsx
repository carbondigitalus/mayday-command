// NPM Modules
import React from 'react';

interface PageProps {
    className?: string;
    size?: number | string;
}

export default class YouTube extends React.Component<PageProps> {
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
                <path d='M581.7 188.1C575.5 164.4 556.9 145.8 533.4 139.5C490.9 128 320.1 128 320.1 128C320.1 128 149.3 128 106.7 139.5C83.2 145.8 64.7 164.4 58.4 188.1C47 231 47 320.4 47 320.4C47 320.4 47 409.8 58.4 452.7C64.7 476.3 83.2 494.2 106.7 500.5C149.3 512 320.1 512 320.1 512C320.1 512 490.9 512 533.5 500.5C557 494.2 575.5 476.3 581.8 452.7C593.2 409.8 593.2 320.4 593.2 320.4C593.2 320.4 593.2 231 581.8 188.1zM264.2 401.6L264.2 239.2L406.9 320.4L264.2 401.6z' />
            </svg>
        );
    }
}
