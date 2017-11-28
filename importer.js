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
 * .thunder-details, .apple { color } }";
 *
 */
function parseImportString(string) {
  let [file, definitionString] = string.replace(/\n/g, ' ' ).split(' remove ').map(val => val.trim());
  const [, fileBase, filePath] = file.split(/@(.+?)\//);

  if (definitionString) {
    let selectorMatches = definitionString.match(/{([\s\S]+)}/);

    if (selectorMatches) {
      let definition = selectorMatches[1].match(/.+?}/g).map(
        getSelectorAndDeclarations
      );

      return [ definition, fileBase, filePath ];
    }
  }

  return [ [], fileBase, filePath];
}

function getSelectorAndDeclarations(string) {
  let [selector, declarations] = string.split(/[{}]/);
  selector = csstree.translate(csstree.parse(selector, { context: 'selectorList' }));

  if (declarations) {
    declarations = declarations.split(',').map(val => val.trim());
  }
  else {
    declarations = [];
  }

  return { selector: selector, declarations: declarations };
}


/**
 *
 */
function parseFile(file, definitions){
  let contents = fs.readFileSync(file, 'utf-8');

  // Parse css into ast, see https://astexplorer.net
  let ast = csstree.parse(contents, {
    filename: file,
    tolerant: true,
    onParseError: function (error) {
      console.log(error.message);
    }
  });

  // Use walkRulesRight: added rules are not parsed.
  csstree.walkRulesRight(ast, function(rule, item, list) {
    // Ignore all other types.
    if (rule.type !== 'Rule') {
      return;
    }

    // Render selector from ast for comparison.
    let selector = csstree.translate(rule.prelude)
    let definition = definitions.find(function (def) {
      return def.selector === selector;
    });

    if (definition) {
      if (definition.declarations.length) {
        removeDeclarations(rule, item, list, definition.declarations);
      }
      else {
        list.remove(item);
      }
    }

    // Remove rule if there is no declaration.
    if (rule.block.children.isEmpty()) {
      list.remove(item);
    }
  });

  return csstree.translate(ast);
}

function removeDeclarations(rule, item, list, declarations) {
  rule.block.children.each(function(node, item, list) {
    if (node.type === 'Declaration') {
      if (declarations.includes(node.property)) {
        list.remove(item);
      }
    }
  });
}

module.exports = {
  sniperImporter,
};