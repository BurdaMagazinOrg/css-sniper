const fs = require('fs');
const csstree = require('css-tree');
const config = {};

function getOrigin() {
  return config.origin;
}

function sniperImporter() {
  return function(url, prev, done) {
    if (url.startsWith('@origin')) {
      const [ definitions, fileUrl] = parseImportString(url);
      const file = fileUrl.replace('@origin', getOrigin());
      let contents = parseFile(file, definitions);
      return { contents: contents};
    }

    return { file: url };
  };

}

/**
 * Parse an import string.
 *
 * Syntax: @import "@seven/css/base/elements.css remove { body,
 * .thunder-details, .apple { color } }";
 *
 */
function parseImportString(string) {
  let [file, definitionString] = string.replace(/\n/g, " " ).split(' remove ').map(val => val.trim());
  let selectorMatches = definitionString.match(/{([\s\S]+)}/);

  if (selectorMatches) {
    let definition = selectorMatches[1].split(/,(?![^{]*})/).map(function (string) {

      let [selector, declarations] = string.split(/[{}]/);
      selector = selector.trim();

      if (declarations) {
        declarations = declarations.split(',').map(val => val.trim());
      }
      else {
        declarations = [];
      }

      return { selector: selector, declarations: declarations };
    });

    return [ definition, file ];
  }

  return [ null, file];
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

    let reduce = {};
    // Iterate selectors in rule prelude.
    rule.prelude.children.each(function (node, item, list) {

      // Render selector from ast for comparison.
      let name = csstree.translate(item.data);
      let definition = definitions.find(function (def) {
        return def.selector === name;
      });

      if (definition) {
        if (definition.declarations.length) {
          // Remove the selector from the rule, a new rule is created below.
          reduce.selector = list.remove(item);
          reduce.declarations = definition.declarations;
        }
        else {
          list.remove(item);
        }
      }
    });

    // Handle removal of declarations by creating a new rule.
    if (reduce.selector) {
      let block = new csstree.List()
      // Copy declarations which are not removed.
      rule.block.children.each(function(node, item, list) {
        if (node.type === 'Declaration') {
          if (!reduce.declarations.includes(node.property)) {
            block.insertData(node);
          }
        }
      });

      if(!block.isEmpty()) {
        // Build a new rule for inserting.
        let newRule = {
          type: 'Rule',
          loc: null,
          prelude: {
            loc: null,
            type: 'SelectorList',
            children: new csstree.List().append(reduce.selector)
          },
          block: {
            type: 'Block',
            loc: null,
            children: block
          }
        };
        list.insertData(newRule, item.next);
      }
    }
    // Remove rule if there is no selector or declaration.
    if (rule.prelude.children.isEmpty() ||
      rule.block.children.isEmpty()) {
      list.remove(item);
    }
  });

  return csstree.translate(ast);
}

module.exports = {
  sniperImporter,
  sniperConfigure : origin => { config.origin = origin }
};