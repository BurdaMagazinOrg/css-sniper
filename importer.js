const fs = require('fs');
const csstree = require('css-tree');

function resolveSevenDirectory() {
  return '../../../core/themes/seven';
}

function sevenImporter() {
  return function(url, prev, done) {
    if (url.startsWith('@seven')) {
      const [ definitions, fileUrl] = parseImportString(url);
      const file = fileUrl.replace('@seven', resolveSevenDirectory());
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
 * Usage: @import "@seven/css/base/elements.css remove { body, .thunder-details, .apple: [color] }";
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

  csstree.walkUp(ast, function(node, item, list) {
    if (node.type === 'Rule') {
      let prelude = node.prelude;
      prelude.children.each(function(selector, item, list) {

        let remove = false;
        csstree.walk(selector, function(node) {
          // ignore nodes in nested selectors
          if (this.selector === null || this.selector === prelude) {
            let name = csstree.translate(item.data);
            let definition = definitions.find(function(def) { return def.selector === name; });
            if (definition) {
              if (definition.declarations.length) {
                // do something;
              } else {
                remove = true;
              }
            }
          }
        });

        if (remove) {
          list.remove(item);
        }
      });

      if (node.prelude.children.isEmpty() ||
        node.block.children.isEmpty()) {
        list.remove(item);
      }

    }
  });
  return csstree.translate(ast);
}

module.exports = {
  sevenImporter
};