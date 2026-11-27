// NPM Modules
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { ExecutionContext } from '@nestjs/common';

// Custom Modules
import ProtectedRoute from 'src/utils/decorators/ProtectedRoute.decorator';

// Standard NestJS testing pattern for extracting the underlying factory
// function registered by a `createParamDecorator`-based decorator.
// See: https://docs.nestjs.com/custom-decorators#testing
function getParamDecoratorFactory(
    decorator: (...args: any[]) => ParameterDecorator
): (data: unknown, ctx: ExecutionContext) => unknown {
    class TestDecorator {
        public test(@decorator() _value: unknown) {}
    }

    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestDecorator, 'test');
    return args[Object.keys(args)[0]].factory as (data: unknown, ctx: ExecutionContext) => unknown;
}

describe('ProtectedRoute', () => {
    const factory = getParamDecoratorFactory(ProtectedRoute);

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

        const result = factory('id', context);

        expect(result).toBe('1');
    });
});
