declare namespace NodeJS {
    export interface ProcessEnv {
        // Database Connection
        DB_HOST: string;
        DB_NAME: string;
        DB_PASSWORD: string;
        DB_PORT: number;
        DB_SSL: string;
        DB_TABLE: string;
        DB_USERNAME: string;
        // Email Transport
        EMAIL_HOST: string;
        EMAIL_PORT: number;
        EMAIL_USERNAME: string;
        EMAIL_PASSWORD: string;
        EMAIL_FROM: string;
        EMAIL_HOST_DEV: string;
        EMAIL_PORT_DEV: number;
        EMAIL_USERNAME_DEV: string;
        EMAIL_PASSWORD_DEV: string;
        // External Storage
        EXTERNAL_STORAGE_ACCOUNT_NAME: string;
        EXTERNAL_STORAGE_CONTAINER_NAME: string;
        EXTERNAL_STORAGE_KEY: string;
        EXTERNAL_STORAGE_URL: string;
        // JWTs
        JWT_ENCRYPTION_KEY: string;
        JWT_TOKEN_ACCESS_EXPIRES_IN: string;
        JWT_TOKEN_ACCESS_SECRET: string;
        JWT_TOKEN_EMAIL_VERIFY_EXPIRES_IN: string;
        JWT_TOKEN_EMAIL_VERIFY_SECRET: string;
        JWT_TOKEN_INVITATION_SECRET: string;
        JWT_TOKEN_MFA_CHALLENGE_EXPIRES_IN: string;
        JWT_TOKEN_MFA_CHALLENGE_SECRET: string;
        JWT_TOKEN_PASSWORD_RESET_EXPIRES_IN: string;
        JWT_TOKEN_PASSWORD_RESET_SECRET: string;
        // MFA
        MFA_REVALIDATION_DAYS: string;
        // NextJS Items
        NEXTJS_PORTAL_REVALIDATE_SECRET: string;
        NEXTJS_PORTAL_URL: string;
        NEXTJS_PUBLIC_REVALIDATE_SECRET: string;
        NEXTJS_PUBLIC_URL: string;
        NEXTJS_SSO_URL: string;
    }
}
