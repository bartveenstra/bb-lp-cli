'use strict';
/*----------------------------------------------------------------*/
/* Gulp Tasks
 /*----------------------------------------------------------------*/
var utils                       = require('./utils');
var display                     = utils.display();
var gulp                        = require('gulp');
var fs                          = require('fs');
var path                        = require('path');
var Promise                     = require('promise');
var del                         = require('del');
var webpack                     = require('webpack');
var webpackStream               = require('webpack-stream');
var g                           = require('gulp-load-plugins')();
var url                         = require('url');
var runSeq                      = require('run-sequence').use(gulp);
var config                      = require('./config');
var shell                       = utils.shell();
var colors                      = utils.colors();
var CustomLibraryTemplatePlugin = require('./plugins/custom-lib-template.js');
var BowerWebpackPlugin          = require('bower-webpack-plugin');
var NGAnnotatePlugin            = require('ng-annotate-webpack-plugin');
var autoprefixer                = require('autoprefixer');
var named                       = require('vinyl-named');
var through                     = require('through2');
var globalWebpackConf           = require('./configs/webpack.conf.js');
var pkg                         = require('../package.json');
var yaml                        = require('js-yaml');
var gutil                       = require('gulp-util');

function createNewEntry(excludes, mainPath, targetFile) {
    var mainFileContent = fs.readFileSync(mainPath);
    var entryPath       = './' + path.join(config.paths.scripts, path.basename(targetFile));
    var excludesRegExp  = new RegExp(
        '\\s*require\\([\'\"]{1}[\\.\\\/\\\\\\w]+(' + excludes.join('|') + ')[\\\/\\\\\\w]+[\'\"]\\)\\.name,?', 'ig');
    fs.writeFileSync(entryPath, mainFileContent.toString().replace(excludesRegExp, ''), 'utf8');
    return entryPath;
}

function getPerformanceLoaderOptions(enabled) {
    return {
        enabled: enabled,
        events: {
            start: 'cxp.performance.start',
            end: 'cxp.performance.end'
        }
    };
}

var prependBanner = function () {
    return g.header(utils.banner(pkg, config));
};

var gulpEmpty = function () {
    return through.obj(function (file, enc, cb) {
        cb(null, file);
    });
};


gulp.task('build:scripts', [], function () {
    var entry = config.entry;

    if (utils.isUndefined(entry)) {
        return false;
    }
    var webpackConf = utils.deepMerge(globalWebpackConf, {
        entry: entry.path,
        output: {
            path: utils.resolve(config.paths.target),
            filename: entry.name + '.js'
        },
        plugins: [

            new NGAnnotatePlugin({
                add: true,
                sourceMap: true
            }),
            new webpack.SourceMapDevToolPlugin({
                filename: '[file].map',
                moduleFilenameTemplate: 'webpack:///' + config.name + '/[resourcePath]',
                fallbackModuleFilenameTemplate: 'webpack:///' + config.name + '/[resourcePath]?[hash]',
                append: '\n//# sourceMappingURL=[url]',

                module: true,
                columns: true,
                lineToLine: false
            })
        ]
    });
    /**
     * Example patterns exclusions
     * ./internalmodule
     * ./internal-module
     * packagename/module-name
     * package-name/module
     * package-name.module
     * @scope/package-name/module
     *
     * packagename
     * package-name
     * @scope/packagename
     * @scope/package-name
     */

    if (config.build.all !== true) {
        // WARNING: here be dragons. Mess with it at your own peril
        //                  "Erik Blankendaal <erikb@backbase.com>"
        webpackConf.externals.unshift(/^(@[^\/]+\/)?[\w-]+$/);
    } else {
        display.info('Including external dependencies...');
    }
    webpackConf.output.libraryTarget = 'umd';

    webpackConf.output.library        = config.name;
    webpackConf.output.umdNamedDefine = false;

    if (config.build.withModuleId) {
        display.info('Building with named module');
        webpackConf.output.id             = typeof config.build.withModuleId === 'string' ? config.build.withModuleId : config.name;
        webpackConf.output.umdNamedDefine = true;
    }

    if (!config.noMinify) {
        webpackConf.plugins.push(
            new webpack.optimize.UglifyJsPlugin({
                sourceMaps: true,
                mangle: {
                    keepFnames: true,
                    except: ['exports', 'require']
                },
                compress: {
                    drop_debugger: config.isBuild || false
                }
            })
        );
    } else {
        display.info('Building uncompressed ...');
    }
    webpackConf.plugins.push(
        new webpack.BannerPlugin(utils.banner(pkg, config), {
            raw: true,
            entryOnly: true
        })
    );

    if (config.build.webpack) {
        var webpackCustomConfig = path.resolve(config.build.webpack);
        try {
            display.info('Using custom webpack configuration file:', webpackCustomConfig.green);
            webpackConf = require(webpackCustomConfig);
        } catch (err) {
            display.info('Fall-Back to original configuration');
            display.error(err)
            console.error(err.stack)
        }
    }

    return gulp.src(entry.path)
               .pipe(webpackStream(webpackConf))
               .on('error', function (err) {
                   this.emit('end');
                   config.isBuild && process.exit(1);
               })
               .on('end', function () {
                   gutil.log('Webpack Finished');
               })
               .pipe(gulp.dest(config.paths.target));
});


// Build styles
gulp.task('build:styles', ['build:images', 'build:css'], function () {
    return gulp.src(utils.resolve(config.paths.styles, 'base.less'))
               // Use less compiler
               .pipe(g.sourcemaps.init())
               .pipe(g.less({
                   compress: !config.noMinify
               }))
               .pipe(g.postcss([autoprefixer(config.autoprefixer)]))
               .pipe(prependBanner())
               .on('end', function(){ gutil.log('Copied images and css'); })
               .pipe(g.sourcemaps.write('.'))
               .pipe(gulp.dest(path.resolve(config.paths.target, 'styles')));
});

// Copy styles to dist folder
gulp.task('build:css', function () {
    return gulp.src(utils.resolve(config.paths.styles, '*.css'))
               .pipe(g.sourcemaps.init())
               .pipe(g.less({
                   compress: !config.noMinify
               }))
               .pipe(g.postcss([autoprefixer(config.autoprefixer)]))
               .pipe(g.rename(config.name + '.css'))
               .on('end', function(){ gutil.log('Build CSS'); })
               .pipe(g.sourcemaps.write('.'))
               .pipe(gulp.dest(path.resolve(config.paths.target, 'styles')));
});

// Build images
gulp.task('build:images', [], function () {
    var src    = utils.resolve(config.paths.media, '**/*');
    var target = utils.resolve(config.paths.target);
    var base   = config.paths.media.indexOf('src') > 0 ? './src' : './';

    return gulp.src(src, {
        base: base
    })
               .pipe(g.changed(target))
               .pipe(gulp.dest(target));
});

// Bundle HTML templates into JS

gulp.task('build:html', [], function () {

    var src        = utils.resolve(config.paths.templates, '*.html');
    var dest       = utils.resolve(config.paths.target, 'scripts');
    var moduleName = ['launchpad', config.name, 'templates'].join('.');
    var prefix     = path.normalize(config.paths.templates + '/');

    return gulp.src(src)
               .pipe(g.minifyHtml({
                   empty: true,
                   spare: true,
                   quotes: true
               }))
               .pipe(g.debug({
                   title: 'process file:'
               }))
               .pipe(g.ngHtml2js({
                   moduleName: moduleName,
                   prefix: prefix,
                   template: "templateCacheInjector.put('<%= template.url %>', '<%= template.prettyEscapedContent %>');\n"
               }))
               .pipe(g.concat('templates.js'))
               .pipe(g.insert.wrap(
                   "(function(module) {\n" +
                   "  try {\n" +
                   "    module = angular.module('" + moduleName + "');\n" +
                   "  }\n" +
                   "  catch(e) {\n" +
                   "    module = angular.module('" + moduleName + "', []);\n" +
                   "  }\n" +
                   "  module.run(['templateCacheInjector', function(templateCacheInjector) {\n",
                   // ngHtml2js output is wrapped here
                   "  }]);\n" +
                   "})();\n"
               ))
               .pipe(g.uglify())
               .pipe(gulp.dest(dest));

});

gulp.task('build:concat', ['build:html'], function (callback) {

    var src  = [
        utils.resolve(config.paths.target, 'scripts/main.js'),
        utils.resolve(config.paths.target, 'scripts/templates.js')
    ];
    var dest = path.resolve(config.paths.target, 'scripts');

    gulp.src(src)
        .pipe(g.concat('main.js'))
        .pipe(gulp.dest(dest))
        .on('end', del.bind(null, src[1], callback));
});

// Only bundle templates
gulp.task('build:bundleTemplates', ['build:html', 'build:concat'], function (done) {
    done();
});

// Build all
gulp.task('build', ['build:images', 'build:scripts', 'build:styles'], function (done) {
    done();
});

exports.build = function (args) {
    var customConfig = args.config || {};

    config.excludes = customConfig.excludes ? customConfig.excludes : args.excludes ? args.excludes : null;

    config.customTarget = customConfig.entryPoint ? customConfig.entryPoint : args.entryPoint ? args.entryPoint : undefined;

    config.withPerformance = args.withPerformance || false;
    // dirty fix for know to add production plugins for webpack config
    config.isBuild         = true;
    config.noMinify        = config.build.noMinify || false;
    return new Promise(function (resolve) {
        runSeq(['build'], resolve);
    });
};

/*
 * @function createBundle - it creates bundle of widgets with (optional)
 * customised dependencies
 *
 * @param [Object] customConfig - custom build configuration JSON-object
 *
 * @param [String] customConfig.dist - bundles destination folder
 *
 * @param [Array] customConfig.externals - array of [String]s or [Object]s which represents
 * set of modules to exclude from every bundle (frameworks, libs, etc.)
 *
 * @param [Boolean] customConfig.verbose - it turns on/off additional output
 * (including set of modules included into each bundle)
 *
 * @param [String] customConfig.componentsBase - bundle components base path
 *
 * @param [String] customConfig.componentMain - component main script path
 *
 * @param [Object] customConfig.bundles - set of bundle [Object]s. Bundle names are used to
 * define bundle file name ([name]-bundle.js, e.g. my-awesome-bundle.js)
 *
 * @param [Array] customConfig.bundles[name].widgets - set of included widget names
 *
 * @param [Object] customConfig.bundles[name].customComponents - set of modules with
 * custom components under the hood
 *
 * @param [String] customConfig.bundles[name].customComponents[name]
 * [name] of component should be the same as in bower.json
 *
 * @param [Array] customConfig.bundles[name].customComponents[name].excludes-
 * components to exclude (e.g.  require('./components/[COMPONENT]/scripts/main').name)
 * should be similar to nested component path
 *
 * @Example
 *
 * {
 *   "dist": "./bundles",
 *   "bundles": {
 *       "login-page": {
 *           "widgets": ["widget-login-multifactor-engage", "widget-device-dna"],
 *           "customComponents": {
 *               "ui": {
 *                   "excludes": ["timer", "smartsuggest"]
 *               },
 *           }
 *       },
 *       "home-page": {
 *           "widgets": ["widget-home-page", "widget-transactions"]
 *       }
 *   },
 *   "externals": ["angular", {"name": "jquery", "value": "jQuery"}],
 *   "verbose": true
 * }
 */
/**
 * @todo
 * refactor - remove hard-coded bower_components
 */
exports.createBundle = function (customConfig, bundleName, useDist) {
    customConfig      = customConfig || {};
    var componentBase = customConfig.componentBase || 'bower_components';
    var componentMain = customConfig.componentMain || 'scripts/main.js';

    // check if bundle exists & not empty
    var bundle = customConfig.bundles[bundleName];
    if (!bundle.widgets || !bundle.widgets.length) {
        throw new Error('Bundle can`t be empty');
    }

    var sources = [];
    // we have to use core as a default value.
    var entries = bundle.widgets.reduce(function (entries, widget) {
        if (typeof widget === "string") {
            entries[widget] = './' + path.join(componentBase, widget, componentMain);
            sources.push(entries[widget]);
        } else if (typeof widget === "object" && widget.hasOwnProperty('name') && widget.hasOwnProperty('path')) {
            entries[widget.name] = widget.path;
            sources.push(entries[widget.name]);
        }
        return entries;
    }, {
        "core": ["./bower_components/core/scripts/main.js"]
    });

    return new Promise(function (resolve, reject) {
        gulp.src(sources)
            .pipe(named())
            .pipe(webpackStream(createBundleConfig({
                entries: entries,
                verbose: customConfig.verbose,
                externals: customConfig.externals || [],
                bundle: bundle,
                componentBase: componentBase,
                componentMain: componentMain,
                withPerformance: customConfig.withPerformance
            })))
            .pipe(g.ngAnnotate())
            .pipe(useDist ? gulpEmpty() : g.uglify({
                mangle: {
                    except: ['require']
                }
            }))
            .pipe(g.concat(bundleName + '-bundle.js'))

            .pipe(gulp.dest(path.resolve(customConfig.dist || './bundles')));
    });
};

/**
 * @todo refactor to use special webpack-config file
 */
function createBundleConfig(options) {
    var conf = utils.deepMerge(globalWebpackConf, {
        entry: options.entries,
        output: {
            filename: "[name].js",
            id: "[name]"
        },
        verbose: !!options.verbose,
        quiet: !options.verbose,
        externals: options.externals.reduce(function (externals, widget) {
            var widgetIsObject = typeof(widget) === "object";
            if (widgetIsObject && (!widget.name || !widget.value)) return externals;

            externals[widgetIsObject ? widget.name : widget] = widgetIsObject ? widget.value : true;
            return externals;
        }, {}),
        module: {
            loaders: [{
                test: /bower_components(\/|\\)([\w\-\d]+)(\/|\\)scripts(\/|\\)main\.js/,
                loader: "custom-deps-loader"
            }, {
                test: /bower_components(\/|\\)([\w\-\d]+)(\/|\\)scripts(\/|\\)main\.js/,
                loader: "injecting-loader"
            }, {
                test: /\.css$/,
                loader: "style-loader!css-loader"
            }, {
                test: /\.js$/,
                loader: 'performance'
            }]
        },
        customDepsLoader: {
            customComponents: options.bundle.customComponents || [],
            componentBase: options.componentBase,
            componentMain: options.componentMain
        },
        injectingLoader: {
            condition: function () {
                // not a widget-* file
                return !~this.resource.indexOf('widget-');
            },
            injectingDependency: '../dist/styles/base.css'
        },
        performanceLoader: getPerformanceLoaderOptions(options.withPerformance)
    });

    // using custom plugins set
    conf.plugins = [
        new webpack.ResolverPlugin(
            new webpack.ResolverPlugin.DirectoryDescriptionFilePlugin('bower.json', ['main'])
        ),
        new webpack.ProvidePlugin({
            jQuery: 'jQuery'
        }),
        new BowerWebpackPlugin({
            modulesDirectories: [path.resolve("./bower_components"), "bower_components"],
            manifestFiles: "bower.json",
            includes: /\.js$/,
            excludes: [],
            searchResolveModulesDirectories: true
        }),
        new CustomLibraryTemplatePlugin("umd", "[name]"),
        // base should be placed in a chunk
        new webpack.optimize.CommonsChunkPlugin("base", "base.js")
    ];

    return conf;
}

exports.build.bundleTemplates = function () {

    return new Promise(function (resolve) {
        runSeq(['build:bundleTemplates'], resolve);
    });
};


exports.template = function (src, data, options) {
    var paths = [
        src + '/**'
    ];

    var processImages = options && options.processImages;
    if (!processImages) {
        var base = '!' + src + '/**/*.';
        paths    = paths.concat([
            base + 'png',
            base + 'jpg',
            base + 'jpeg',
            base + 'webp',
            base + 'gif',
            base + 'tiff',
            base + 'bmp'
        ]);
    }

    return new Promise(function (resolve, reject) {
        gulp.src(paths)
            .pipe(g.template(data))
            .pipe(gulp.dest(src))
            .on('end', resolve)
            .on('error', reject);
    });
};

/*----------------------------------------------------------------*/
/* Clean up folders
 /*----------------------------------------------------------------*/
exports.clean = function () {
    var paths = [
        config.paths.target
    ];
    return new Promise(function (resolve) {
        del(paths, resolve);
    });
};


/*----------------------------------------------------------------*/
/* Lint
 /*----------------------------------------------------------------*/
exports.lint = function () {
    return new Promise(function (resolve) {
        gulp.start('test:lint', resolve);
    });
};


