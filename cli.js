const program = require('commander');
const { execSync } = require('child_process');

program
  .version(require('./package.json').version)
  .usage('[options] <files ...>')
  .option('--include-path <value>', 'Paths to look for imported files ', val => val.split(','), [])
  .option('--config [value]', 'Path to config file')
  .option('-o, --output [value]', 'Output directory')
  .option('--output-style [value]', 'Available output formats: nested, expanded, compact, compressed', 'uncompressed' )
  .parse(process.argv);

if (!program.args.length) program.help();

program.includePath = program.includePath.length ? program.includePath : ['sass-includes'];

module.exports = program;