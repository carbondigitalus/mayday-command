// NPM Modules
import { validate } from 'class-validator';

// Custom Modules
import StrongPassword from 'src/utils/decorators/StrongPassword.decorator';

class Subject {
    @StrongPassword()
    password: unknown;
}

const check = async (password: unknown) => {
    const subject = new Subject();
    subject.password = password;

    return (await validate(subject)).flatMap((error) => Object.values(error.constraints ?? {}));
};

describe('StrongPassword', () => {
    it.each([['Sup3rSecure!Pass'], ['Abcdefgh1!jk'], ['aA1.aA1.aA1.'], ['Correct-Horse-9-Battery']])(
        'accepts %p',
        async (password) => {
            await expect(check(password)).resolves.toEqual([]);
        }
    );

    it('accepts exactly 12 and exactly 60 characters', async () => {
        await expect(check(`Aa1!${'x'.repeat(8)}`)).resolves.toEqual([]);
        await expect(check(`Aa1!${'x'.repeat(56)}`)).resolves.toEqual([]);
    });

    it('rejects 11 characters, naming the minimum', async () => {
        const messages = await check(`Aa1!${'x'.repeat(7)}`);

        expect(messages).toContain('Passwords can not be less than 12 characters.');
    });

    it('rejects 61 characters, naming the maximum', async () => {
        const messages = await check(`Aa1!${'x'.repeat(57)}`);

        expect(messages).toContain('Passwords can not exceed 60 characters.');
    });

    it.each([
        ['no uppercase letter', 'sup3rsecure!pass'],
        ['no lowercase letter', 'SUP3RSECURE!PASS'],
        ['no number', 'SuperSecure!Pass'],
        ['no special character', 'Sup3rSecurePass1']
    ])('rejects a password with %s, with the strength message', async (_label, password) => {
        const messages = await check(password);

        expect(messages).toEqual([expect.stringContaining('Password Strength Requirements')]);
    });

    it('only counts the listed special characters', async () => {
        // `~` and a space are not in !@#$%^&*()-_+.
        await expect(check('Sup3rSecure~Pass')).resolves.toEqual([expect.stringContaining('Strength')]);
        await expect(check('Sup3r Secure Pass')).resolves.toEqual([expect.stringContaining('Strength')]);
    });

    it.each([[undefined], [null], [123456789012], [{}], [['Sup3rSecure!Pass']]])(
        'rejects the non-string %p',
        async (value) => {
            expect((await check(value)).length).toBeGreaterThan(0);
        }
    );
});
