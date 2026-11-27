// NPM Modules
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Test } from '@nestjs/testing';
import request from 'supertest';

// Custom Modules
import configureApp from 'src/app.setup';
import LoggerService from 'src/logger/logger.service';
import MFAController from 'src/mfa/mfa.controller';
import MFAService from 'src/mfa/mfa.service';

describe('Rate limiting (e2e)', () => {
    let app: INestApplication;
    let mfaService: { resend: jest.Mock };

    beforeEach(async () => {
        mfaService = { resend: jest.fn().mockResolvedValue({ ok: true }) };

        const moduleRef = await Test.createTestingModule({
            controllers: [MFAController],
            imports: [
                ThrottlerModule.forRoot({
                    ipv6SubnetPrefix: 64,
                    throttlers: [{ limit: 120, name: 'default', ttl: 60 * 1000 }]
                })
            ],
            providers: [
                { provide: APP_GUARD, useClass: ThrottlerGuard },
                { provide: MFAService, useValue: mfaService },
                {
                    provide: LoggerService,
                    useValue: { debug: jest.fn(), error: jest.fn(), log: jest.fn(), warn: jest.fn() }
                }
            ]
        }).compile();

        app = moduleRef.createNestApplication<NestExpressApplication>();
        configureApp(app as NestExpressApplication);
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    /** Railway's shape: the client's address, then one of its own hops, which varies between requests. */
    const resend = (ip: string, hop = '89.222.103.194', spoofed = '') =>
        request(app.getHttpServer())
            .post('/mfa/resend')
            .set('X-Forwarded-For', `${spoofed}${ip}, ${hop}`)
            .send({ mfaToken: 't' });

    it('lets a strict route through ten times, then answers 429 and keeps blocking that IP', async () => {
        for (let i = 0; i < 10; i++) {
            expect((await resend('203.0.113.7')).status).not.toBe(429);
        }

        expect((await resend('203.0.113.7')).status).toBe(429);
        expect((await resend('203.0.113.7')).status).toBe(429);
    });

    it("counts one client as one even though Railway's own hop varies between its requests", async () => {
        for (let i = 0; i < 10; i++) {
            await resend('203.0.113.7', i % 2 ? '89.222.103.193' : '89.222.103.194');
        }

        expect((await resend('203.0.113.7', '89.222.103.193')).status).toBe(429);
        expect((await resend('203.0.113.7', '89.222.103.194')).status).toBe(429);
    });

    it('is not escaped by a spoofed leading X-Forwarded-For entry', async () => {
        for (let i = 0; i < 10; i++) {
            await resend('203.0.113.7');
        }

        expect((await resend('203.0.113.7', '89.222.103.194', '1.2.3.4, ')).status).toBe(429);
    });

    it('counts every address in one IPv6 /64 as one client, so rotating addresses gains nothing', async () => {
        for (let i = 0; i < 10; i++) {
            await resend(`2001:db8:1:2::${i + 1}`);
        }

        expect((await resend('2001:db8:1:2:aaaa:bbbb:cccc:dddd')).status).toBe(429);
    });

    it('keeps different IPv6 /64 blocks apart', async () => {
        for (let i = 0; i < 11; i++) {
            await resend('2001:db8:1:2::1');
        }

        expect((await resend('2001:db8:1:2::2')).status).toBe(429);
        expect((await resend('2001:db8:1:3::1')).status).not.toBe(429);
    });

    it('tells apart clients behind the proxy by their forwarded IP, so one blocked IP does not block others', async () => {
        for (let i = 0; i < 11; i++) {
            await resend('203.0.113.7');
        }

        expect((await resend('203.0.113.7')).status).toBe(429);
        expect((await resend('198.51.100.9')).status).not.toBe(429);
    });
});
