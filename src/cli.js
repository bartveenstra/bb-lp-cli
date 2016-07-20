
var cliparse = require('cliparse');
var parsers = cliparse.parsers;
var pckJson = require('../package.json');
var colors = require('colors');
var utils = require('../lib/utils');
var config = require('../lib/config');

/*----------------------------------------------------------------*/
/* #TODO parse the commands folder and auto generate commands
/*----------------------------------------------------------------*/
var BBCLI = cliparse.cli({
    name: pckJson.name,
    version: pckJson.version,
    description: 'Barts BackBase CLI tool',

    commands: [

        /*----------------------------------------------------------------*/
        /* Build Widget
        /*----------------------------------------------------------------*/
        cliparse.command('build', {
            description: 'Bundles pacakge resources.',
            args: [
                // cliparse.argument('config', {
                //     description: 'path to config file for components management',
                //     default: ''
                // }),
                // cliparse.argument('excludes', {
                //     description: 'array of components to exclude',
                //     default: ''
                // }),
                // cliparse.argument('destination', {
                //     description: 'name of target file',
                //     default: ''
                // })
            ],
            options: [
                cliparse.flag('all', { aliases: ['a'], description: 'Include all external dependencies'}),
                cliparse.flag('withTemplates', { aliases: ['t'], description: 'Bundle HTML templates into build file (for widgets)'}),
                cliparse.flag('withModuleId', {
                    aliases: ['m'],
                    description: 'Build with AMD module ID in definition',
                    default: false
                }),
                cliparse.flag('withPerformance', { aliases: ['p'], description: 'Parse performance annotations'}),
                cliparse.flag('expand', { aliases: ['e'], description: 'Do not minify files.'}),
                cliparse.option('webpackconfig', {
                    description: 'Build with a different webpack config'
                }),
                cliparse.option('moduleDirectories', { description: 'A comma separated list of the shared components'})
            ]
        }, require('../lib/commands/common/build') ),
         /*----------------------------------------------------------------*/
        /* Clean Package
        /*----------------------------------------------------------------*/
        cliparse.command('clean', {
            description: 'Clean the package generated folders',
            args: [],
            options: []
        }, require('../lib/commands/common/clean') ),
    ]
});

cliparse.parse(BBCLI);
