/**
 * ConventionAnalyzer Import Pattern Tests
 * Tests for import style detection including AMD, UMD, CommonJS, and ES6 patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConventionAnalyzer } from '../convention-analyzer.js';
import { ConventionAnalysisSchema } from '@apexcli/core';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConventionAnalyzer - Import Pattern Detection', () => {
  let analyzer: ConventionAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new ConventionAnalyzer();
    testDir = join(tmpdir(), `convention-imports-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('AMD Pattern Detection', () => {
    it('should detect simple AMD patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const simpleAmdCode = `
define(['jquery', 'lodash'], function($, _) {
  return {
    init: function() {
      console.log('AMD module initialized');
    }
  };
});
`;

      await fs.writeFile(join(srcDir, 'simple-amd.js'), simpleAmdCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('amd');
    });

    it('should detect AMD with no dependencies', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const noDepsAmdCode = `
define(function() {
  return {
    value: 42,
    getValue: function() {
      return this.value;
    }
  };
});

define(function() {
  return 'simple string module';
});
`;

      await fs.writeFile(join(srcDir, 'no-deps-amd.js'), noDepsAmdCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('amd');
    });

    it('should detect AMD with complex dependency arrays', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexAmdCode = `
define([
  'jquery',
  'lodash',
  'backbone',
  'marionette',
  './utils/helper',
  '../config/settings',
  'text!./templates/main.html'
], function($, _, Backbone, Marionette, helper, settings, template) {

  var MainView = Marionette.View.extend({
    template: template,
    initialize: function() {
      this.model = new Backbone.Model(settings);
    }
  });

  return MainView;
});
`;

      await fs.writeFile(join(srcDir, 'complex-amd.js'), complexAmdCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('amd');
    });

    it('should detect named AMD modules', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const namedAmdCode = `
define('myModule', ['jquery'], function($) {
  return {
    doSomething: function() {
      $('body').append('<p>Hello from named AMD module</p>');
    }
  };
});

define('anotherModule', function() {
  return 'another module';
});
`;

      await fs.writeFile(join(srcDir, 'named-amd.js'), namedAmdCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('amd');
    });
  });

  describe('UMD Pattern Detection', () => {
    it('should detect standard UMD pattern', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const standardUmdCode = `
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        // Node.js
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else {
        // Browser globals
        root.myLibrary = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function MyLibrary() {
        this.version = '1.0.0';
    }

    MyLibrary.prototype.hello = function() {
        return 'Hello from UMD module!';
    };

    return MyLibrary;
}));
`;

      await fs.writeFile(join(srcDir, 'standard-umd.js'), standardUmdCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('umd');
    });

    it('should detect UMD with dependencies', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const umdWithDepsCode = `
(function (root, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        // CommonJS
        module.exports = factory(require('jquery'), require('lodash'));
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define(['jquery', 'lodash'], factory);
    } else {
        // Browser globals
        root.MyPlugin = factory(root.jQuery, root._);
    }
}(typeof self !== 'undefined' ? self : this, function ($, _) {
    'use strict';

    function MyPlugin(options) {
        this.options = _.extend({}, this.defaults, options);
        this.element = $(options.element);
    }

    MyPlugin.prototype.defaults = {
        theme: 'default'
    };

    MyPlugin.prototype.init = function() {
        this.element.addClass(this.options.theme);
    };

    return MyPlugin;
}));
`;

      await fs.writeFile(join(srcDir, 'umd-with-deps.js'), umdWithDepsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('umd');
    });

    it('should detect simplified UMD patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const simplifiedUmdCode = `
(function (root, factory) {
    'use strict';
    if (typeof exports === 'object') {
        factory(exports);
    } else if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else {
        factory((root.commonJsStrict = {}));
    }
}(this, function (exports) {
    'use strict';

    exports.name = 'UMD Module';
    exports.version = '2.0.0';

    exports.greet = function(name) {
        return 'Hello, ' + name + '!';
    };
}));
`;

      await fs.writeFile(join(srcDir, 'simplified-umd.js'), simplifiedUmdCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('umd');
    });
  });

  describe('CommonJS Pattern Detection', () => {
    it('should detect standard CommonJS requires', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const commonjsCode = `
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const express = require('express');

const readFile = promisify(fs.readFile);

module.exports = {
  readConfig: async function(configPath) {
    const fullPath = path.resolve(configPath);
    const content = await readFile(fullPath, 'utf8');
    return JSON.parse(content);
  }
};
`;

      await fs.writeFile(join(srcDir, 'commonjs.js'), commonjsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('commonjs');
    });

    it('should detect various CommonJS require patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const variousRequiresCode = `
// Standard require
const lodash = require('lodash');

// Destructured require
const { join, dirname } = require('path');

// Require with different variable declarations
let express = require('express');
var http = require('http');

// Require in assignments
const app = require('express')();

// Nested require
const config = require(require('path').join(__dirname, 'config.json'));

// Conditional require
if (process.env.NODE_ENV === 'development') {
  const debug = require('debug');
}

// Dynamic require
const moduleName = 'fs';
const fs = require(moduleName);

module.exports = function(options) {
  return options;
};
`;

      await fs.writeFile(join(srcDir, 'various-requires.js'), variousRequiresCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('commonjs');
    });
  });

  describe('ES6 Import Pattern Detection', () => {
    it('should detect various ES6 import patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const es6ImportsCode = `
// Default imports
import React from 'react';
import express from 'express';

// Named imports
import { Component } from 'react';
import { Router, Route } from 'react-router';

// Mixed imports
import Router, { Route, Switch } from 'react-router-dom';

// Namespace imports
import * as fs from 'fs';
import * as path from 'path';

// Side-effect imports
import 'babel-polyfill';
import './styles.css';

// Type imports
import type { User } from './types';
import type { Config } from '../config/types';

// Dynamic imports (not detected by current regex, but part of ES6+)
const module = await import('./dynamic-module.js');

export default function MyComponent() {
  return React.createElement('div', null, 'Hello World');
}
`;

      await fs.writeFile(join(srcDir, 'es6-imports.js'), es6ImportsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
    });

    it('should detect ES6 imports with different quote styles', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const quotesCode = `
import singleQuote from 'single-quote-module';
import doubleQuote from "double-quote-module";
import backtick from \`backtick-module\`;

import { named } from 'single';
import { other } from "double";
import { another } from \`backtick\`;

export { singleQuote, doubleQuote, backtick };
`;

      await fs.writeFile(join(srcDir, 'quote-styles.js'), quotesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.quotes).toBe('mixed'); // Mixed quote styles
    });
  });

  describe('Mixed Import Styles', () => {
    it('should detect mixed import styles when no single style dominates', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const mixedStylesCode = `
// CommonJS requires
const fs = require('fs');
const path = require('path');

// ES6 imports
import React from 'react';
import { Component } from 'react';

// More CommonJS
const express = require('express');
const http = require('http');

// More ES6
import axios from 'axios';
import './styles.css';

export default class MixedModule extends Component {
  render() {
    return React.createElement('div');
  }
}

module.exports = MixedModule;
`;

      await fs.writeFile(join(srcDir, 'mixed-styles.js'), mixedStylesCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('mixed');
    });

    it('should handle projects with different files using different import styles', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const commonjsFile = `
const lodash = require('lodash');
const express = require('express');
module.exports = { lodash, express };
`;

      const es6File = `
import React from 'react';
import { useState } from 'react';
export { React, useState };
`;

      const amdFile = `
define(['jquery'], function($) {
  return { $: $ };
});
`;

      await fs.writeFile(join(srcDir, 'commonjs-file.js'), commonjsFile);
      await fs.writeFile(join(srcDir, 'es6-file.js'), es6File);
      await fs.writeFile(join(srcDir, 'amd-file.js'), amdFile);

      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('mixed');
    });
  });

  describe('Import Grouping Detection', () => {
    it('should detect type-separate grouping correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const typeSeparateCode = `
import type { User, Product } from './types';
import type { APIResponse } from '../api/types';
import type { Config } from '../../config';

import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';

function MyComponent() {
  return React.createElement('div');
}
`;

      await fs.writeFile(join(srcDir, 'type-separate.ts'), typeSeparateCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('type-separate');
    });

    it('should detect source-separate grouping correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const sourceSeparateCode = `
import React from 'react';
import axios from 'axios';
import lodash from 'lodash';

import { userService } from './services/user';
import { authService } from './services/auth';
import { Component } from './components/base';

function MyApp() {
  return React.createElement('div');
}
`;

      await fs.writeFile(join(srcDir, 'source-separate.ts'), sourceSeparateCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('source-separate');
    });

    it('should detect alphabetical grouping correctly', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const alphabeticalCode = `
import axios from 'axios';
import lodash from 'lodash';
import react from 'react';

import { authService } from './services/auth';
import { userService } from './services/user';
import { validator } from './utils/validator';

function MyApp() {
  return react.createElement('div');
}
`;

      await fs.writeFile(join(srcDir, 'alphabetical.ts'), alphabeticalCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('alphabetical');
    });

    it('should detect custom grouping with blank line separators', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const customGroupingCode = `
import React from 'react';
import axios from 'axios';

import { userService } from './services/user';

import { Component } from './components/base';
import { Button } from './components/button';

import { validator } from './utils/validator';

function MyApp() {
  return React.createElement('div');
}
`;

      await fs.writeFile(join(srcDir, 'custom-grouping.ts'), customGroupingCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('custom');
    });

    it('should detect no grouping pattern for unorganized imports', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const noGroupingCode = `
import { userService } from './services/user';
import React from 'react';
import { validator } from './utils/validator';
import axios from 'axios';
import { Component } from './components/base';
import lodash from 'lodash';

function MyApp() {
  return React.createElement('div');
}
`;

      await fs.writeFile(join(srcDir, 'no-grouping.ts'), noGroupingCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.grouping).toBe('none');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle files with no imports', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const noImportsCode = `
function pureFunction(a, b) {
  return a + b;
}

const constants = {
  PI: 3.14159,
  E: 2.71828
};

export { pureFunction, constants };
`;

      await fs.writeFile(join(srcDir, 'no-imports.js'), noImportsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6'); // Default to ES6 when no imports found
      expect(result.imports.grouping).toBeUndefined();
    });

    it('should handle malformed import statements', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const malformedImportsCode = `
// Valid imports
import React from 'react';
const fs = require('fs');

// Malformed imports that shouldn't crash the analyzer
import { from 'broken-import';
const incomplete = require(
import missing from
const another = require('valid-module');

// These should still be detected
import lodash from 'lodash';
const path = require('path');

export default function() {
  return 'test';
}
`;

      await fs.writeFile(join(srcDir, 'malformed-imports.js'), malformedImportsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('mixed'); // Should detect both ES6 and CommonJS
    });

    it('should handle imports with complex string patterns', async () => {
      const srcDir = join(testDir, 'src');
      await fs.mkdir(srcDir, { recursive: true });

      const complexStringsCode = `
// Imports with various quote patterns
import module1 from "module-with-double-quotes";
import module2 from 'module-with-single-quotes';
import module3 from \`module-with-backticks\`;

// Imports with escaped quotes
import module4 from 'module-with-\\'escaped\\'-quotes';
import module5 from "module-with-\\"escaped\\"-quotes";

// Imports with special characters
import module6 from '@scoped/package';
import module7 from './relative-path';
import module8 from '../parent-directory';
import module9 from '/absolute-path';
import module10 from '~/home-relative';

// Imports with version specifiers (in some systems)
import module11 from 'package@1.2.3';
import module12 from 'git+https://github.com/user/repo.git';

export { module1, module2, module3 };
`;

      await fs.writeFile(join(srcDir, 'complex-strings.js'), complexStringsCode);
      const result = await analyzer.analyze(testDir);

      expect(() => ConventionAnalysisSchema.parse(result)).not.toThrow();
      expect(result.imports.style).toBe('es6');
      expect(result.imports.quotes).toBe('mixed');
    });
  });
});