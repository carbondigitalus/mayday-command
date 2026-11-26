declare namespace NodeJS {
    export interface ProcessEnv {
        COOKIE_DOMAIN: string;
        COOKIE_NAME: string;
        NEXT_PUBLIC_DOMAIN_COOKIE: string;
        NODE_ENV: string;
        PORT: number;
        SENTRY_AUTH_TOKEN: string;
        SENTRY_DSN: string;
    }
}

declare module '*.css';
