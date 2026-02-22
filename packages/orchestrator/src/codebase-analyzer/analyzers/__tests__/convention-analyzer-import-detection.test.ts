/**
 * ConventionAnalyzer Import Style and Grouping Detection Tests
 *
 * Comprehensive tests for import style detection (ES6, CommonJS, AMD, UMD, mixed)
 * and import grouping patterns (type-separate, source-separate, alphabetical, custom, none)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Import Style and Grouping Detection', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `import-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Import Style Detection', () => {
    describe('ES6 Module Style', () => {
      it('should detect ES6 import style with various import patterns', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const es6ImportCode = `
import React from 'react';
import { useState, useEffect } from 'react';
import * as utils from './utils';
import type { User } from './types';
import { Component as MyComponent } from './components';
import './styles.css';

export const MyApp: React.FC = () => {
  const [state, setState] = useState(0);
  return <div>Hello</div>;
};
`;

        await fs.writeFile(join(srcDir, 'app.tsx'), es6ImportCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('es6');
        expect(result.imports.quotes).toBeDefined();
      });

      it('should detect ES6 with different quote styles', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const singleQuoteCode = `
import React from 'react';
import { useState } from 'react-hooks';
import utils from './utils';
`;

        const doubleQuoteCode = `
import React from "react";
import { useState } from "react-hooks";
import utils from "./utils";
`;

        await fs.writeFile(join(srcDir, 'single.js'), singleQuoteCode);
        await fs.writeFile(join(srcDir, 'double.js'), doubleQuoteCode);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('es6');
        expect(['single', 'double', 'mixed']).toContain(result.imports.quotes);
      });

      it('should handle ES6 imports with re-exports', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const reExportCode = `
import { ComponentA, ComponentB } from './components';
import type { Props as ComponentProps } from './types';

export { ComponentA, ComponentB };
export type { ComponentProps };
export * from './utils';
export { default as MyDefault } from './default';
`;

        await fs.writeFile(join(srcDir, 'index.ts'), reExportCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('es6');
      });
    });

    describe('CommonJS Style', () => {
      it('should detect CommonJS require style', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const commonjsCode = `
const express = require('express');
const { createServer } = require('http');
const path = require('path');
const fs = require('fs');
const userService = require('./services/user');
const { validateInput, sanitizeData } = require('./utils/validation');

const app = express();
const server = createServer(app);

module.exports = {
  app,
  server,
  startServer: () => server.listen(3000)
};
`;

        await fs.writeFile(join(srcDir, 'server.js'), commonjsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('commonjs');
        expect(result.imports.quotes).toBeDefined();
      });

      it('should detect CommonJS with different require patterns', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const variousRequiresCode = `
// Standard require
const lodash = require('lodash');

// Destructuring require
const { merge, cloneDeep } = require('lodash/object');

// Require with assignment
let config = require('./config.json');

// Require in variable declaration
var utils = require('./utils'),
    helpers = require('./helpers');

// Dynamic require (should still be detected)
const moduleName = 'express';
const dynamicModule = require(moduleName);

// Require with complex paths
const deepModule = require('../../shared/utils/formatter');
`;

        await fs.writeFile(join(srcDir, 'requires.js'), variousRequiresCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('commonjs');
      });
    });

    describe('AMD Style', () => {
      it('should detect AMD define style with dependencies', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const amdWithDepsCode = `
define(['jquery', 'underscore', 'backbone', 'text!templates/user.html'], function($, _, Backbone, userTemplate) {
  'use strict';

  var UserModel = Backbone.Model.extend({
    defaults: {
      name: '',
      email: ''
    }
  });

  var UserView = Backbone.View.extend({
    template: _.template(userTemplate),

    render: function() {
      this.$el.html(this.template(this.model.toJSON()));
      return this;
    }
  });

  return {
    Model: UserModel,
    View: UserView
  };
});
`;

        await fs.writeFile(join(srcDir, 'amd-with-deps.js'), amdWithDepsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('amd');
      });

      it('should detect AMD define style without dependencies', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const amdSimpleCode = `
define(function() {
  'use strict';

  var utils = {
    capitalize: function(str) {
      return str.charAt(0).toUpperCase() + str.slice(1);
    },

    debounce: function(func, wait) {
      var timeout;
      return function() {
        var context = this, args = arguments;
        var later = function() {
          timeout = null;
          func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  };

  return utils;
});

define(['require'], function(require) {
  var dependency = require('some-module');
  return dependency;
});
`;

        await fs.writeFile(join(srcDir, 'amd-simple.js'), amdSimpleCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('amd');
      });
    });

    describe('UMD Style', () => {
      it('should detect UMD pattern with factory function', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const umdCode = `
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        // CommonJS
        module.exports = factory(require('lodash'));
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(['lodash'], factory);
    } else {
        // Browser globals
        root.MyLibrary = factory(root._);
    }
}(typeof self !== 'undefined' ? self : this, function (lodash) {
    'use strict';

    function MyLibrary(options) {
        this.options = lodash.defaults(options || {}, {
            debug: false,
            version: '1.0.0'
        });
    }

    MyLibrary.prototype.process = function(data) {
        if (this.options.debug) {
            console.log('Processing:', data);
        }
        return lodash.map(data, item => item.value);
    };

    MyLibrary.prototype.validate = function(input) {
        return lodash.isObject(input) && lodash.has(input, 'value');
    };

    return MyLibrary;
}));
`;

        await fs.writeFile(join(srcDir, 'umd-library.js'), umdCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('umd');
      });

      it('should detect UMD pattern variations', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const umdVariationCode = `
// UMD Pattern Variation 1
!function(root, factory) {
    if (typeof exports === "object" && typeof module !== "undefined") {
        module.exports = factory();
    } else if (typeof define === "function" && define.amd) {
        define([], factory);
    } else {
        root.utils = factory();
    }
}(this, function() {
    "use strict";

    return {
        format: function(str) {
            return str.trim().toLowerCase();
        }
    };
});

// UMD Pattern Variation 2
(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.myModule = {}));
}(this, (function(exports) {
    'use strict';

    exports.calculate = function(x, y) {
        return x + y;
    };
})));
`;

        await fs.writeFile(join(srcDir, 'umd-variations.js'), umdVariationCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('umd');
      });
    });

    describe('Mixed Import Styles', () => {
      it('should detect mixed ES6 and CommonJS imports', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const mixedES6CommonJSCode = `
import React from 'react';
import { Component } from 'react';
const express = require('express');
const { Router } = require('express');
import * as utils from './utils';
const path = require('path');

export default class MyComponent extends Component {
  render() {
    return <div>Mixed imports</div>;
  }
}

module.exports = {
  component: MyComponent,
  server: express()
};
`;

        await fs.writeFile(join(srcDir, 'mixed-es6-cjs.js'), mixedES6CommonJSCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('mixed');
      });

      it('should detect mixed import styles across multiple files', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const es6File = `
import { useState, useEffect } from 'react';
import api from './api';

export const Component = () => {
  const [data, setData] = useState(null);
  return <div>{data}</div>;
};
`;

        const commonjsFile = `
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);

module.exports = {
  loadConfig: async (configPath) => {
    const content = await readFile(path.resolve(configPath), 'utf8');
    return JSON.parse(content);
  }
};
`;

        const amdFile = `
define(['jquery', 'moment'], function($, moment) {
  return {
    formatDate: function(date) {
      return moment(date).format('YYYY-MM-DD');
    }
  };
});
`;

        await fs.writeFile(join(srcDir, 'component.jsx'), es6File);
        await fs.writeFile(join(srcDir, 'config.js'), commonjsFile);
        await fs.writeFile(join(srcDir, 'date-utils.js'), amdFile);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('mixed');
      });

      it('should handle edge case where single style has low dominance', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        // Create files where each style appears but none dominates (< 60%)
        const es6File1 = `import A from 'a';`;
        const es6File2 = `import B from 'b';`;
        const cjsFile1 = `const c = require('c');`;
        const cjsFile2 = `const d = require('d');`;
        const amdFile1 = `define(['e'], function(e) { return e; });`;

        await fs.writeFile(join(srcDir, 'es6-1.js'), es6File1);
        await fs.writeFile(join(srcDir, 'es6-2.js'), es6File2);
        await fs.writeFile(join(srcDir, 'cjs-1.js'), cjsFile1);
        await fs.writeFile(join(srcDir, 'cjs-2.js'), cjsFile2);
        await fs.writeFile(join(srcDir, 'amd-1.js'), amdFile1);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('mixed');
      });
    });

    describe('No Imports Handling', () => {
      it('should default to ES6 when no imports are found', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const noImportsCode = `
function calculate(a, b) {
  return a + b;
}

class Calculator {
  add(x, y) {
    return x + y;
  }
}

const utils = {
  format: (num) => num.toFixed(2)
};

export { calculate, Calculator, utils };
`;

        await fs.writeFile(join(srcDir, 'no-imports.js'), noImportsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.style).toBe('es6');
        expect(result.imports.quotes).toBeUndefined();
        expect(result.imports.grouping).toBeUndefined();
      });
    });
  });

  describe('Quote Style Detection', () => {
    it('should detect single quotes preference', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const singleQuotesCode = `
import React from 'react';
import { useState, useEffect } from 'react-dom';
import utils from './utils';
import api from '../api/client';
const fs = require('fs');
const path = require('path');
`;

      await fs.writeFile(join(srcDir, 'single-quotes.js'), singleQuotesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.quotes).toBe('single');
    });

    it('should detect double quotes preference', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const doubleQuotesCode = `
import React from "react";
import { useState, useEffect } from "react-dom";
import utils from "./utils";
import api from "../api/client";
const fs = require("fs");
const path = require("path");
`;

      await fs.writeFile(join(srcDir, 'double-quotes.js'), doubleQuotesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.quotes).toBe('double');
    });

    it('should detect mixed quotes usage', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedQuotesCode = `
import React from 'react';
import { useState } from "react-dom";
import utils from './utils';
const fs = require("fs");
const path = require('path');
import api from "../api/client";
`;

      await fs.writeFile(join(srcDir, 'mixed-quotes.js'), mixedQuotesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.quotes).toBe('mixed');
    });

    it('should handle quote style detection with template literals in paths', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const templateLiteralCode = `
import React from 'react';
import { Component } from "react";

// Template literals in code (shouldn't affect import quote detection)
const template = \`Hello \${name}\`;
const path = \`/api/\${version}/users\`;

const dynamicImport = () => import(\`./components/\${componentName}\`);
`;

      await fs.writeFile(join(srcDir, 'template-literals.js'), templateLiteralCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(['single', 'double', 'mixed']).toContain(result.imports.quotes || 'single');
    });
  });

  describe('Import Grouping Pattern Detection', () => {
    describe('Type-Separate Grouping', () => {
      it('should detect type imports separated from value imports', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const typeSeparateCode = `
import type { User, Product, Category } from './types';
import type { APIResponse } from '../api/types';
import type { Config } from '../../config/types';

import React from 'react';
import { useState, useEffect } from 'react';
import { userService } from './services/userService';
import { productService } from './services/productService';
import { validateInput } from './utils/validation';

export const UserComponent: React.FC<{ user: User }> = ({ user }) => {
  return <div>{user.name}</div>;
};
`;

        await fs.writeFile(join(srcDir, 'type-separate.tsx'), typeSeparateCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('type-separate');
      });

      it('should detect type imports with inline type syntax', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const inlineTypeImportsCode = `
import { type User, type Product, createUser } from './user-service';
import { type Config, loadConfig } from './config';

import React from 'react';
import { Component } from 'react';
import utils from './utils';

class UserManager extends Component {
  render() {
    return <div>User Manager</div>;
  }
}
`;

        await fs.writeFile(join(srcDir, 'inline-types.tsx'), inlineTypeImportsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('type-separate');
      });

      it('should detect value imports first, then type imports', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const valueFirstCode = `
import React from 'react';
import { useState, useCallback } from 'react';
import { userService } from './services/userService';
import { formatDate } from './utils/date';

import type { User, UserProfile } from './types/user';
import type { ServiceConfig } from './types/config';
import type { DateFormat } from './utils/types';

const UserProfile = ({ user }: { user: User }) => {
  return <div>{user.name}</div>;
};
`;

        await fs.writeFile(join(srcDir, 'value-first.tsx'), valueFirstCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('type-separate');
      });
    });

    describe('Source-Separate Grouping', () => {
      it('should detect external packages separated from internal imports', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const sourceSeparateCode = `
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';

import { userService } from './services/userService';
import { authMiddleware } from './middleware/auth';
import { logger } from './utils/logger';
import { validateInput } from '../utils/validation';
import config from '../config/app';

const app = express();
app.use(cors());
app.use(helmet());
`;

        await fs.writeFile(join(srcDir, 'source-separate.ts'), sourceSeparateCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('source-separate');
      });

      it('should detect relative imports separated from absolute imports', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const relativeAbsoluteCode = `
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router-dom';
import axios from 'axios';

import { App } from './components/App';
import { Router } from './router';
import { store } from './store';
import { theme } from './theme';
import { GlobalStyles } from './styles/global';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
`;

        await fs.writeFile(join(srcDir, 'relative-absolute.tsx'), relativeAbsoluteCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('source-separate');
      });
    });

    describe('Alphabetical Grouping', () => {
      it('should detect alphabetically sorted imports', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const alphabeticalCode = `
import axios from 'axios';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';

import { authMiddleware } from './middleware/auth';
import { logger } from './utils/logger';
import { userService } from './services/userService';
import { validateInput } from './utils/validation';

const app = express();
`;

        await fs.writeFile(join(srcDir, 'alphabetical.ts'), alphabeticalCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('alphabetical');
      });

      it('should detect alphabetical sorting within groups', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const alphabeticalGroupsCode = `
import axios from 'axios';
import express from 'express';
import mongoose from 'mongoose';
import react from 'react';

import { auth } from './auth';
import { config } from './config';
import { utils } from './utils';
import { validator } from './validator';

const app = express();
`;

        await fs.writeFile(join(srcDir, 'alphabetical-groups.ts'), alphabeticalGroupsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('alphabetical');
      });
    });

    describe('Custom Grouping', () => {
      it('should detect custom grouping with blank line separators', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const customGroupingCode = `
import React from 'react';
import { Component } from 'react';

import express from 'express';
import cors from 'cors';

import { userService } from './services/user';

import { logger } from './utils/logger';
import { validator } from './utils/validator';

import config from './config';

const app = express();
`;

        await fs.writeFile(join(srcDir, 'custom-grouping.tsx'), customGroupingCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('custom');
      });

      it('should detect intentional grouping by functionality', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const functionalGroupingCode = `
// React and UI libraries
import React from 'react';
import ReactDOM from 'react-dom';
import { ThemeProvider } from 'styled-components';

// Routing
import { BrowserRouter, Route, Routes } from 'react-router-dom';

// State management
import { Provider } from 'react-redux';
import { store } from './store';

// Components
import { App } from './components/App';
import { Layout } from './components/Layout';

// Utilities
import { logger } from './utils/logger';
import { config } from './config';

const root = ReactDOM.createRoot(document.getElementById('root'));
`;

        await fs.writeFile(join(srcDir, 'functional-grouping.tsx'), functionalGroupingCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('custom');
      });
    });

    describe('No Grouping', () => {
      it('should detect random/unorganized import order', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const noGroupingCode = `
import { userService } from './services/user';
import express from 'express';
import { validateInput } from './utils/validation';
import React from 'react';
import cors from 'cors';
import { logger } from './utils/logger';
import axios from 'axios';
import { Component } from 'react';

const app = express();
`;

        await fs.writeFile(join(srcDir, 'no-grouping.tsx'), noGroupingCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('none');
      });

      it('should handle files with very few imports as no grouping', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const fewImportsCode = `
import React from 'react';

export const SimpleComponent = () => {
  return <div>Simple</div>;
};
`;

        await fs.writeFile(join(srcDir, 'few-imports.tsx'), fewImportsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBeUndefined();
      });
    });

    describe('Grouping Pattern Edge Cases', () => {
      it('should handle imports with comments between them', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const commentsCode = `
import React from 'react';
// This is a comment
import { useState } from 'react';

/* Block comment */
import express from 'express';
// Another comment
import cors from 'cors';

import { userService } from './services/user';
/*
 * Multi-line comment
 */
import { logger } from './utils/logger';
`;

        await fs.writeFile(join(srcDir, 'with-comments.tsx'), commentsCode);
        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(['source-separate', 'custom', 'none']).toContain(result.imports.grouping || 'none');
      });

      it('should detect consistent patterns across multiple files', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const file1Code = `
import type { User } from './types';

import React from 'react';
import { userService } from './services/user';
`;

        const file2Code = `
import type { Product } from './types';

import { Component } from 'react';
import { productService } from './services/product';
`;

        const file3Code = `
import type { Order } from './types';

import axios from 'axios';
import { orderService } from './services/order';
`;

        await fs.writeFile(join(srcDir, 'file1.tsx'), file1Code);
        await fs.writeFile(join(srcDir, 'file2.tsx'), file2Code);
        await fs.writeFile(join(srcDir, 'file3.tsx'), file3Code);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('type-separate');
      });

      it('should handle inconsistent patterns across files as none', async () => {
        const srcDir = join(testDir, 'src');
        await fs.mkdir(srcDir, { recursive: true });

        const inconsistent1Code = `
import type { User } from './types';
import React from 'react';
import { userService } from './services/user';
`;

        const inconsistent2Code = `
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
`;

        const inconsistent3Code = `
import { Component } from 'react';
import axios from 'axios';
import type { Product } from './types';
`;

        await fs.writeFile(join(srcDir, 'inconsistent1.tsx'), inconsistent1Code);
        await fs.writeFile(join(srcDir, 'inconsistent2.ts'), inconsistent2Code);
        await fs.writeFile(join(srcDir, 'inconsistent3.tsx'), inconsistent3Code);

        const result = await analyzer.analyze(testDir);

        expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
        expect(result.imports.grouping).toBe('none');
      });
    });
  });

  describe('Complex Import Scenarios', () => {
    it('should handle mixed import styles with different grouping patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedComplexCode = `
// ES6 imports with type separation
import type { Config } from './types';
import React from 'react';
import { Component } from 'react';

// CommonJS mixed in
const fs = require('fs');
const path = require('path');

// AMD module
define(['jquery'], function($) {
  return {
    init: function() {
      console.log('AMD module loaded');
    }
  };
});

// More ES6 imports
import { userService } from './services/user';
import utils from './utils';

const app = {
  initialize: () => {
    console.log('App initialized');
  }
};
`;

      await fs.writeFile(join(srcDir, 'mixed-complex.js'), mixedComplexCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('mixed');
      expect(['type-separate', 'none', 'custom']).toContain(result.imports.grouping || 'none');
    });

    it('should handle dynamic imports correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const dynamicImportsCode = `
import React from 'react';
import { Suspense } from 'react';

// Dynamic imports (should not affect static import analysis)
const LazyComponent = React.lazy(() => import('./components/LazyComponent'));
const loadUtils = () => import('./utils');

// Regular imports continue
import { userService } from './services/user';
import type { User } from './types';

const App = () => {
  const handleLoadModule = async () => {
    const module = await import('./dynamic-module');
    module.initialize();
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyComponent />
    </Suspense>
  );
};
`;

      await fs.writeFile(join(srcDir, 'dynamic-imports.tsx'), dynamicImportsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(['type-separate', 'none']).toContain(result.imports.grouping || 'none');
    });

    it('should handle side-effect imports correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const sideEffectImportsCode = `
// Side-effect imports (CSS, polyfills, etc.)
import './styles/global.css';
import 'normalize.css';
import '@babel/polyfill';

// Regular library imports
import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';

// Local imports
import { App } from './components/App';
import { initializeApp } from './utils/init';

// More side-effects
import './analytics';
import './error-reporting';

ReactDOM.render(<App />, document.getElementById('root'));
`;

      await fs.writeFile(join(srcDir, 'side-effects.tsx'), sideEffectImportsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(['custom', 'source-separate', 'none']).toContain(result.imports.grouping || 'none');
    });

    it('should validate all enum values are properly handled', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      // Create a minimal file to ensure we get some result
      await fs.writeFile(join(srcDir, 'minimal.js'), `
import React from 'react';
import { Component } from 'react';
const utils = require('./utils');
`);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Validate style enum
      expect(['es6', 'commonjs', 'amd', 'umd', 'mixed']).toContain(result.imports.style);

      // Validate quotes enum (if defined)
      if (result.imports.quotes !== undefined) {
        expect(['single', 'double', 'mixed']).toContain(result.imports.quotes);
      }

      // Validate grouping enum (if defined)
      if (result.imports.grouping !== undefined) {
        expect(['none', 'type-separate', 'source-separate', 'alphabetical', 'custom']).toContain(result.imports.grouping);
      }
    });
  });

  describe('Schema Compliance and Integration', () => {
    it('should return complete ConventionAnalysis with proper import analysis', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const completeCode = `
import type { User, Config } from './types';
import React, { useState, useEffect } from 'react';
import axios from 'axios';

import { userService } from './services/userService';
import { validateInput } from './utils/validation';
import './styles.css';

/**
 * User management component with proper imports
 */
export const UserManager: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const userData = await userService.getAll();
    setUsers(userData);
  };

  return (
    <div className="user-manager">
      {users.map(user => (
        <div key={user.id}>{user.name}</div>
      ))}
    </div>
  );
};
`;

      await fs.writeFile(join(srcDir, 'user-manager.tsx'), completeCode);
      const result = await analyzer.analyze(testDir);

      // Should not throw when parsing with schema
      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();

      // Verify all required import fields are present and valid
      expect(result.imports).toHaveProperty('style');
      expect(result.imports.style).toBe('es6');

      if (result.imports.quotes !== undefined) {
        expect(['single', 'double', 'mixed']).toContain(result.imports.quotes);
      }

      if (result.imports.grouping !== undefined) {
        expect(['none', 'type-separate', 'source-separate', 'alphabetical', 'custom']).toContain(result.imports.grouping);
      }

      // Verify other analysis sections are present
      expect(result).toHaveProperty('fileNaming');
      expect(result).toHaveProperty('functionNaming');
      expect(result).toHaveProperty('variableNaming');
      expect(result).toHaveProperty('indentation');
      expect(result).toHaveProperty('documentation');
    });
  });
});