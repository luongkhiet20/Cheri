const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function loadTypeScript(filePath, mocks = {}) {
  const loadedModules = new Map();

  function load(resolvedPath) {
    if (loadedModules.has(resolvedPath)) return loadedModules.get(resolvedPath).exports;
    const scopedModule = new Module(resolvedPath);
    scopedModule.filename = resolvedPath;
    scopedModule.paths = Module._nodeModulePaths(path.dirname(resolvedPath));
    loadedModules.set(resolvedPath, scopedModule);
    const nativeRequire = Module.createRequire(resolvedPath);
    scopedModule.require = (request) => {
      if (Object.hasOwn(mocks, request)) return mocks[request];
      let dependencyPath;
      try {
        dependencyPath = nativeRequire.resolve(request);
      } catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND' || !request.startsWith('.')) throw error;
        const candidate = path.resolve(path.dirname(resolvedPath), request);
        dependencyPath = [candidate + '.ts', path.join(candidate, 'index.ts')]
          .find((file) => fs.existsSync(file));
        if (!dependencyPath) throw error;
      }
      return dependencyPath.endsWith('.ts') ? load(dependencyPath) : nativeRequire(request);
    };
    const { outputText } = ts.transpileModule(fs.readFileSync(resolvedPath, 'utf8'), {
      fileName: resolvedPath,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2018,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        esModuleInterop: true,
      },
    });
    scopedModule._compile(outputText, resolvedPath);
    return scopedModule.exports;
  }

  return load(path.resolve(filePath));
}

module.exports = { loadTypeScript };
