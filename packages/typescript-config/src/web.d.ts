declare namespace NodeJS {
    export interface ProcessEnv {
        CONTENT_API_KEY: string;
        CONTENT_API_URL: string;
        DEPLOY_HOOK: string;
        NEXT_PUBLIC_ANALYTICS_ID_FACEBOOK_PIXEL: string;
        NEXT_PUBLIC_ANALYTICS_ID_GA4: string;
        NEXT_PUBLIC_ANALYTICS_ID_MICROSOFT_CLARITY: string;
        NEXT_PUBLIC_ANALYTICS_ID_SEGMENT: string;
        NEXT_PUBLIC_API_URL: string;
        NEXT_PUBLIC_SITE_URL: string;
        NEXT_PUBLIC_SSO_URL: string;
        NEXT_PUBLIC_STORAGE_FILES: string;
        NEXT_PUBLIC_STORAGE_UPLOADS: string;
        NEXT_PUBLIC_STORAGE_URL_FILES: string;
        NEXT_PUBLIC_STORAGE_URL_UPLOADS: string;
        NEXT_PUBLIC_STORAGE_URL_WIDGET: string;
        REVALIDATE_SECRET: string;
    }
}
