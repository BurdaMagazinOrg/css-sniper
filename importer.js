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
      console.log(contents);
      return { contents: contents};
    }

    return { file: url };
  };

}

function parseImportString(string) {
  let [file, definitionString] = string.split(' remove ').map(val => val.trim());
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
 * Usage: @import "@seven/css/base/elements.css remove { body,
 * .thunder-details, .apple: [color] }";
 *
 */
function parseFile(file, definitions){
  let contents = fs.readFileSync(file, 'utf-8');

  // https://astexplorer.net
  let ast = csstree.parse(contents, {
    filename: file,
    tolerant: true,
    onParseError: function (error) {
      console.log(error.message);
    }
  });

  csstree.walkRulesRight(ast, function(rule, item, list) {

    if (rule.type !== 'Rule') {
      return;
    }
    let remove = {};
    rule.prelude.children.each(function (node, item, list) {
      let name = csstree.translate(item.data);
      let definition = definitions.find(function (def) {
        return def.selector === name;
      });
      if (definition) {
        if (definition.declarations.length) {
          remove.selector = list.remove(item);
          remove.declarations = definition.declarations;
        }
        else {
          list.remove(item);
        }
      }
    });

    // Handle removal of declarations by creating a new rule.
    if (remove.selector) {
      let block = new csstree.List()
      rule.block.children.each(function(node, item, list) {
        if (node.type === 'Declaration') {
          if (!remove.declarations.includes(node.property)) {
            block.insertData(node);
          }
        }
      });

      if(!block.isEmpty()) {
        let newRule = {
          type: 'Rule',
          loc: null,    // not required, but better keep the shape of nodes
          prelude: {
            loc: null,
            type: 'SelectorList',
            children: new csstree.List().append(remove.selector)
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