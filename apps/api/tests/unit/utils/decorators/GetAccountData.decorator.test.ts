// NPM Modules
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ExecutionContext } from '@nestjs/common';

// Custom Modules
import GetAccountData from 'src/utils/decorators/GetAccountData.decorator';

/** Pulls out the factory function a `createParamDecorator` decorator registers, the standard NestJS pattern for
 * testing one. See https://docs.nestjs.com/custom-decorators. */
function getParamDecoratorFactory(
    decorator: (...args: any[]) => ParameterDecorator
): (data: unknown, ctx: ExecutionContext) => unknown {
    class TestDecorator {
        public test(@decorator() _value: unknown) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestDecorator, 'test');
    return args[Object.keys(args)[0]].factory as (data: unknown, ctx: ExecutionContext) => unknown;
}

describe('GetAccountData', () => {
    const factory = getParamDecoratorFactory(GetAccountData);

    const buildContext = (request: unknown) =>
        ({
            switchToHttp: () => ({
                getRequest: () => request
            })
        }) as unknown as ExecutionContext;

    it('returns the full request when no data key is provided', () => {
        const request = { id: '1', email: 'a@b.com' };
        const context = buildContext(request);

        const result = factory(undefined, context);

        expect(result).toBe(request);
    });

    it('returns the requested property when a data key is provided', () => {
        const request = { id: '1', email: 'a@b.com' };
        const context = buildContext(request);

        const result = factory('email', context);

        expect(result).toBe('a@b.com');
    });
});
