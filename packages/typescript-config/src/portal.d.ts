import type * as React from 'react';

declare global {
    namespace NodeJS {
        export interface ProcessEnv {
            NEXT_PUBLIC_PORTAL_URL: string;
        }
    }

    /** Bridges the bare global `JSX` namespace (removed from @types/react 19) back to `React.JSX`, for legacy libraries (e.g. react-markdown@8) that still reference it directly. */
    namespace JSX {
        type ElementType = React.JSX.ElementType;
        interface Element extends React.JSX.Element {}
        interface ElementClass extends React.JSX.ElementClass {}
        interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
        interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
        type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
        interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
        interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
        interface IntrinsicElements extends React.JSX.IntrinsicElements {}
    }
}
