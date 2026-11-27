// NPM Modules
import { validate, ValidationArguments } from 'class-validator';

// Custom Modules
import MatchConstraint, { ValidateMatch } from 'src/utils/decorators/ValidateMatch.decorator';

class TestDTO {
    password: string;

    @ValidateMatch<TestDTO>('password')
    passwordConfirm: string;
}

class CustomMessageDTO {
    password: string;

    @ValidateMatch<CustomMessageDTO>('password', {
        message: 'Passwords must match.'
    })
    passwordConfirm: string;
}

describe('ValidateMatch', () => {
    it('passes validation when the two properties match', async () => {
        const dto = new TestDTO();
        dto.password = 'abc123';
        dto.passwordConfirm = 'abc123';

        const errors = await validate(dto);

        expect(errors).toHaveLength(0);
    });

    it('fails validation when the two properties do not match', async () => {
        const dto = new TestDTO();
        dto.password = 'abc123';
        dto.passwordConfirm = 'different';

        const errors = await validate(dto);

        expect(errors).toHaveLength(1);
        expect(errors[0].constraints).toHaveProperty('Match');
    });

    it('honors a custom validation message', async () => {
        const dto = new CustomMessageDTO();
        dto.password = 'a';
        dto.passwordConfirm = 'b';

        const errors = await validate(dto);

        expect(errors[0].constraints?.Match).toBe('Passwords must match.');
    });
});

describe('MatchConstraint', () => {
    let constraint: MatchConstraint<{ a: string; b: string }>;

    beforeEach(() => {
        constraint = new MatchConstraint();
    });

    it('returns true when the related property value matches', () => {
        const args = {
            constraints: ['a'],
            object: { a: 'x', b: 'y' }
        } as unknown as ValidationArguments;

        expect(constraint.validate('x', args)).toBe(true);
    });

    it('returns false when the related property value differs', () => {
        const args = {
            constraints: ['a'],
            object: { a: 'z', b: 'y' }
        } as unknown as ValidationArguments;

        expect(constraint.validate('x', args)).toBe(false);
    });

    it('returns false when args.object is undefined', () => {
        const args = {
            constraints: ['a'],
            object: undefined
        } as unknown as ValidationArguments;

        expect(constraint.validate('x', args)).toBe(false);
    });
});
