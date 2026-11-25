'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DOCTOR_WEB_DIR = path.join(REPO_ROOT, 'apps', 'doctor-web');
const MOBILE_DIR = path.join(REPO_ROOT, 'apps', 'mobile');

function getAppDir(absPath) {
  const norm = path.resolve(absPath);
  if (norm.startsWith(DOCTOR_WEB_DIR)) return DOCTOR_WEB_DIR;
  if (norm.startsWith(MOBILE_DIR)) return MOBILE_DIR;
  return DOCTOR_WEB_DIR;
}

function getTsFor(absPath) {
  const appDir = getAppDir(absPath);
  return require(path.join(appDir, 'node_modules', 'typescript'));
}

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => map.set(String(k), String(v)),
    removeItem: (k) => map.delete(String(k)),
    clear: () => map.clear(),
    get _data() {
      return Object.fromEntries(map.entries());
    },
  };
}

function makeLucideProxy(React) {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === '__esModule') return true;
        return (props) => React.createElement('span', { 'data-icon': String(prop), ...(props || {}) });
      },
    }
  );
}

function transpileAndLoad(absPath, mocks = {}, options = {}) {
  const resolvedPath = path.resolve(absPath);
  const appDir = options.appDir || getAppDir(resolvedPath);
  const ts = getTsFor(resolvedPath);
  let raw = fs.readFileSync(resolvedPath, 'utf8');
  if (options.shimImportMeta !== false) {
    raw = raw.replace(/import\.meta\.env/g, '({ VITE_API_URL: "", VITE_WS_URL: "", DEV: false })');
  }

  const transpiled = ts.transpileModule(raw, {
    fileName: resolvedPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  }).outputText;

  const storage = options.localStorage || makeMemoryStorage();
  const classList = new Set();
  const fakeDoc = {
    body: {
      classList: {
        add: (c) => classList.add(c),
        remove: (c) => classList.delete(c),
        contains: (c) => classList.has(c),
      },
    },
  };
  const fakeWindow = options.window || {
    location: { hostname: 'localhost', protocol: 'http:', pathname: '/' },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  let DateCtor = Date;
  if (options.fixedNow !== undefined) {
    const fixedMs = typeof options.fixedNow === 'number' ? options.fixedNow : new Date(options.fixedNow).getTime();
    DateCtor = class MockDate extends Date {
      constructor(...args) {
        if (args.length === 0) super(fixedMs);
        else super(...args);
      }
      static now() {
        return fixedMs;
      }
    };
  }

  const moduleCache = options._cache || new Map();

  const customRequire = (id) => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) {
      return mocks[id];
    }
    if (id.startsWith('.')) {
      const base = path.resolve(path.dirname(resolvedPath), id);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          const hit = Object.keys(mocks).find((k) => k.startsWith('.') && path.resolve(path.dirname(resolvedPath), k) === cand);
          if (hit) return mocks[hit];
          if (moduleCache.has(cand)) return moduleCache.get(cand);
          const loaded = transpileAndLoad(cand, mocks, { ...options, _cache: moduleCache, localStorage: storage });
          moduleCache.set(cand, loaded);
          return loaded;
        }
      }
    }
    const nmPath = path.join(appDir, 'node_modules', id);
    if (fs.existsSync(nmPath)) {
      return require(nmPath);
    }
    return require(id);
  };

  const moduleObj = { exports: {} };
  const context = vm.createContext({
    require: customRequire,
    module: moduleObj,
    exports: moduleObj.exports,
    __filename: resolvedPath,
    __dirname: path.dirname(resolvedPath),
    console: options.console || console,
    process: { env: { ...process.env, ...(options.env || {}) } },
    window: fakeWindow,
    document: fakeDoc,
    localStorage: storage,
    URLSearchParams,
    Intl,
    Date: DateCtor,
    Math,
    JSON,
    Promise,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Error,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });

  vm.runInContext(transpiled, context, { filename: resolvedPath });
  return moduleObj.exports;
}

function parseTsAst(absPath) {
  const resolvedPath = path.resolve(absPath);
  const ts = getTsFor(resolvedPath);
  const code = fs.readFileSync(resolvedPath, 'utf8');
  const sf = ts.createSourceFile(resolvedPath, code, ts.ScriptTarget.Latest, true);
  return { ts, sf, code };
}

function walkAst(node, visitor) {
  visitor(node);
  node.forEachChild((child) => walkAst(child, visitor));
}

function findNodes(sf, predicate) {
  const out = [];
  walkAst(sf, (n) => {
    if (predicate(n)) out.push(n);
  });
  return out;
}

function renderWithHookCounter(absPath, exportName, props, extraMocks = {}, options = {}) {
  const appDir = getAppDir(absPath);
  const realReact = require(path.join(appDir, 'node_modules', 'react'));
  const ReactDOMServer = require(path.join(appDir, 'node_modules', 'react-dom/server'));

  const hookCounts = { useState: 0, useEffect: 0, useMemo: 0, useCallback: 0, useRef: 0 };
  const hookOrder = [];

  const proxiedReact = new Proxy(realReact, {
    get(target, prop) {
      if (Object.prototype.hasOwnProperty.call(hookCounts, prop)) {
        return (...args) => {
          hookCounts[prop] += 1;
          hookOrder.push(prop);
          return target[prop](...args);
        };
      }
      return target[prop];
    },
  });

  const mocks = {
    react: proxiedReact,
    'react-dom': { createPortal: (node) => node },
    'lucide-react': makeLucideProxy(proxiedReact),
    ...extraMocks,
  };

  const mod = transpileAndLoad(absPath, mocks, options);
  const Component = exportName ? mod[exportName] : mod.default || mod;
  const html = ReactDOMServer.renderToStaticMarkup(proxiedReact.createElement(Component, props));
  const totalHooks = Object.values(hookCounts).reduce((a, b) => a + b, 0);
  return { html, hookCounts, hookOrder, totalHooks };
}

module.exports = {
  REPO_ROOT,
  DOCTOR_WEB_DIR,
  MOBILE_DIR,
  makeMemoryStorage,
  transpileAndLoad,
  parseTsAst,
  walkAst,
  findNodes,
  renderWithHookCounter,
};
