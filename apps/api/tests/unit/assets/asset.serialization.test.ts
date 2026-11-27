// NPM Modules
import { CallHandler, ClassSerializerInterceptor, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

// Custom Modules
import Asset from 'src/database/asset.entity';

describe('Asset serialization', () => {
    it('never serializes the storage key, so clients only reach files through signed links', async () => {
        const interceptor = new ClassSerializerInterceptor(new Reflector());
        const context = { getClass: () => Object, getHandler: () => () => undefined } as unknown as ExecutionContext;
        const asset = Object.assign(new Asset(), {
            id: 'asset-1',
            storageKey: 'assets/0f8c',
            fileName: 'logo.png',
            contentType: 'image/png',
            size: 2048
        });

        const plain = (await lastValueFrom(
            await interceptor.intercept(context, { handle: () => of(asset) } as CallHandler)
        )) as Record<string, unknown>;

        expect(plain).toMatchObject({ id: 'asset-1', fileName: 'logo.png', contentType: 'image/png', size: 2048 });
        expect(plain).not.toHaveProperty('storageKey');
    });
});
