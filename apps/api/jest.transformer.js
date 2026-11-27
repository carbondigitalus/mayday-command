// NPM Modules
const { TsJestTransformer } = require('ts-jest');

/**
 * Nest 12 ships as ESM. Jest's runtime is CommonJS and does not hand `require()` to Node's own `require(esm)`, so
 * the `@nestjs/*` sources are compiled to CommonJS by ts-jest (see `transformIgnorePatterns` in jest.config.ts).
 * TypeScript cannot emit `import.meta` as CommonJS, and the only thing Nest does with it is
 * `createRequire(import.meta.url)`, which in CommonJS is the module's own `require`. This rewrites those uses
 * before ts-jest compiles the file.
 */
function rewriteImportMeta(source, filePath) {
    if (!filePath.includes('/node_modules/@nestjs/') || !source.includes('import.meta')) {
        return source;
    }

    return source
        .replace(/^\s*const require = createRequire\(import\.meta\.url\);?\s*$/gm, '')
        .replace(/createRequire\(import\.meta\.url\)/g, 'require');
}

class NestESMTransformer extends TsJestTransformer {
    process(sourceText, sourcePath, transformOptions) {
        return super.process(rewriteImportMeta(sourceText, sourcePath), sourcePath, transformOptions);
    }

    async processAsync(sourceText, sourcePath, transformOptions) {
        return super.processAsync(rewriteImportMeta(sourceText, sourcePath), sourcePath, transformOptions);
    }
}

module.exports = {
    createTransformer: (tsJestConfig) => new NestESMTransformer(tsJestConfig)
};
