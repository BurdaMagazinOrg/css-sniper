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

      if (definitions.length === 0) return { file: file.substring(0, file.indexOf('.css')) };

      let contents = parseFile(file, definitions);
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
  return csstree.translate(ast);
}

function removeSelectors(ast, definition) {

  csstree.walkRules(ast, function (rule, item, list) {

    // Handle removal of @-rules.
    if (rule.type === 'Atrule') {
      let atRule = rule;
      csstree.walkRules(definition, function (defRule) {

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
    let selector = csstree.translate(rule.prelude);
    // this.atrule corresponds to the stylesheet context.
    let atRule = this.atrule;

    // Context changes to the definition tree here.
    csstree.walkRules(definition, function (defRule) {
      let defSelector = csstree.translate(defRule.prelude);

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

function removeDeclarations(rule, item, list, declarations) {
  // Traverse csstree Lists
  rule.block.children.each(function(node, item, list) {
    if (node.type === 'Declaration') {
      declarations.each(function(currentNode) {
        if (node.property === currentNode.value.replace(/;/g , '')) {
          list.remove(item);
        }
      });
    }
  });
}

function checkAtruleIsSame(atRule, defAtRule) {
  if (!atRule && !defAtRule) {
    // no @-rule
    return true;
    // Check if css rule is also in @-rule and compare type. e.g. @media
  } else if (atRule && defAtRule && atRule.name === defAtRule.name) {
    let prelude = csstree.translate(atRule.prelude);
    let defPrelude = csstree.translate(defAtRule.prelude);
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