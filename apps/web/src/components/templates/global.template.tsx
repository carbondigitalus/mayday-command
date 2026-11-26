// NPM Modules
import React from 'react';

// Custom Modules
import Header from '../organisms/header';
import Footer from '../organisms/footer';

interface PageProps {
    children?: any;
}

export default class GlobalPageWrapper extends React.Component<PageProps> {
    constructor(props: PageProps) {
        super(props);
    }

    render() {
        return (
            <>
                <Header />
                {this.props.children}
                <Footer />
            </>
        );
    }
}
