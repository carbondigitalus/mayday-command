// NPM Modules
import { ValidationPipe } from '@nestjs/common';

// Custom Modules
import OrganizationCreateDTO from 'src/organization/dto/create.dto';
import OrganizationUpdateDTO from 'src/organization/dto/update.dto';

describe('OrganizationUpdateDTO', () => {
    /** The same validation the app applies to every request body. */
    const pipe = new ValidationPipe({ whitelist: true });

    it('keeps the name and strips id, isActive and logo from an update body', async () => {
        const body: unknown = await pipe.transform(
            { id: 'org-2', isActive: false, logo: 'other-logo.png', name: 'New Name' },
            { metatype: OrganizationUpdateDTO, type: 'body' }
        );

        expect(body).toEqual({ name: 'New Name' });
    });
});

describe('OrganizationCreateDTO', () => {
    const pipe = new ValidationPipe({ whitelist: true });

    it('keeps the name and strips id, isActive and logo from a create body', async () => {
        const body: unknown = await pipe.transform(
            { id: 'org-2', isActive: false, logo: 'other-logo.png', name: 'Acme' },
            { metatype: OrganizationCreateDTO, type: 'body' }
        );

        expect(body).toEqual({ name: 'Acme' });
    });

    it('requires a name (400)', async () => {
        await expect(pipe.transform({ name: '' }, { metatype: OrganizationCreateDTO, type: 'body' })).rejects.toThrow();
    });
});
