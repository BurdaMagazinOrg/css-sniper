const fs = require('fs');
const csstree = require('css-tree');
const config = require('./css-sniper.conf');

function sniperImporter() {
  return function(url, prev, done) {
    if (url.startsWith('@')) {
      const [definitions, fileBase, fileUrl] = parseImportString(url);

      const baseUrl = getCachedOrigin(fileBase);
      if (!baseUrl || baseUrl === fileBase) return new Error('Couldn\'t resolve path');

      const file = `${baseUrl}/${fileUrl}`;
      let contents;

      if (definitions.length === 0) {
        // Importing .css files has been deprecated in libsass:
        // https://github.com/sass/libsass/pull/2613
        // (rationale in https://github.com/sass/libsass/issues/2611)
        contents = fs.readFileSync(file, 'utf-8');
      }
      else {
        contents = parseFile(file, definitions);
      }

      return { contents: contents };
    }
    return { file: url };
  };

}

function getCachedOrigin(base) {
  getCachedOrigin.cache = getCachedOrigin.cache || [];

  if (getCachedOrigin.cache[base]) return getCachedOrigin.cache[base];

  const origin = getOrigin(base);
  getCachedOrigin.cache[base] = origin;
  return origin;
}

function getOrigin(base) {
  return config.resolver(base);
}

/**
 * Parse an import string.
 *
 * Syntax: @import "@seven/css/base/elements.css remove { body,
 * .thunder-details, .apple { color; font-size } }";
 *
 */
function parseImportString(string) {
  let [file, definitionString] = string.replace(/\n/g, ' ' ).split(' remove ').map(val => val.trim());
  const [, fileBase, filePath] = file.split(/@(.+?)\//);

  if (definitionString) {
    let selectorMatches = definitionString.match(/{([\s\S]+)}/);

    if (selectorMatches) {
      // Parse import string into ast.
      let definition = csstree.parse(selectorMatches[1]);

      return [ definition, fileBase, filePath ];
    }
  }

  return [ [], fileBase, filePath];
}


/**
 *
 */
function parseFile(file, definition){
  let contents = fs.readFileSync(file, 'utf-8');

  // Parse css into ast, see https://astexplorer.net
  let ast = csstree.parse(contents, {
    filename: file,
    tolerant: true,
    onParseError: function (error) {
      console.log(error.message);
    }
  });

  removeSelectors(ast, definition);
  return csstree.generate(ast);
}

function removeSelectors(ast, definition) {

  csstree.walk(ast, function (rule, item, list) {

    // Handle removal of @-rules.
    if (rule.type === 'Atrule') {
      let atRule = rule;
      csstree.walk(definition, function (defRule) {
        if ( defRule.type !== 'Atrule' && defRule.type !== 'Rule') {
          return;
        }
        // Remove the whole rule when there are no selectors.
        if (defRule.block.children.getSize() === 0) {
          if (checkAtruleIsSame(atRule, defRule)) {
            list.remove(item);
          }
        }
      });
    }

    // Ignore all other types.
    if (rule.type !== 'Rule') {
      return;
    }

    // Render selector from ast for comparison.
    let selector = csstree.generate(rule.prelude);
    // this.atrule corresponds to the stylesheet context.
    let atRule = this.atrule;

    // Context changes to the definition tree here.
    csstree.walk(definition, function (defRule) {
      if ( defRule.type !== 'Atrule' && defRule.type !== 'Rule') {
        return;
      }
      let defSelector = csstree.generate(defRule.prelude);

      if (selector === defSelector) {
        if (checkAtruleIsSame(atRule, this.atrule)) {

          // Remove declarations or the whole rule.
          if (defRule.block.children.getSize()) {
            removeDeclarations(rule, item, list, defRule.block.children);
          }
          else {
            list.remove(item);
          }
        }
      }
    });

    // Remove rule if there are no declarations.
    if (rule.block.children.isEmpty()) {
      list.remove(item);
    }
  });
}

function removeDeclarations(rule, ruleitem, rulelist, declarations) {
  let warn = false;
  // Traverse csstree Lists
  rule.block.children.each(function(node, item, list) {
    if (node.type === 'Declaration') {
      declarations.each(function(currentNode) {
        if (node.property === currentNode.value.replace(/;/g , '')) {
          list.remove(item);
        }
        else if (currentNode.type === 'Raw') {
          // Handle comma separated declarations.
          currentNode.value.split(',').forEach(function (value) {
            if (node.property === value.trim()) {
              list.remove(item);
              warn = true;
            }
          });
        }
      });
    }
  });
  if (warn) console.log('WARNING: Use of commas in remove definition is deprecated and will be removed, use semi-colon instead.');
}

function checkAtruleIsSame(atRule, defAtRule) {
  if (!atRule && !defAtRule) {
    // no @-rule
    return true;
    // Check if css rule is also in @-rule and compare type. e.g. @media
  } else if (atRule && defAtRule && atRule.name === defAtRule.name) {
    let prelude = csstree.generate(atRule.prelude);
    let defPrelude = csstree.generate(defAtRule.prelude);
    // Compare selector, e.g. screen and width()
    if (prelude === defPrelude) {
      return true;
    }
  }
  return false;
}

module.exports = {
  sniperImporter,
};