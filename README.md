# Backbase Launchpad
=========

Stripped CLI build tool for widgets / modules

## Information

| Name       |  bbb-lp-cli |
|------------|---|
| Bundle     | tools |
| Status     | node >=0.12.x < 5.0.x |


## Requirements

General

- git
- nodejs
- curl

Dev - Server

- python
- gcc / visual c++


## Install

```
npm i bartveenstra/bbb-lp-cli -g
```

## Usage

Using **bbblp** as binary.


### Help

Check all the available commands that you can use.

```bash
bbblp
```

or

```bash
bbblp --help
```

Check command help

```bash
bbblp <command> --help
```


### Build:
Bundle the widget/module.

arguments:

- **NONE**


options:

- **- f --fulltest** with unit tests and linting
- **- t --withTemplates** Bundle HTML templates into build file (for widgets)
- **- m --withModuleId** Build with AMD module ID in definition. Default **false**

- **- p --withPerformance** Build with performance annotations converted into performance module API calls
- **--moduleDirectories** A comma separated list of the shared components
    + `--moduleDirectories 'target/bower_components'`
- **--webpackconfig** Build with custom webpack config

```bash
bbblp build
```

with moduleDirectories

```bash
bbblp build --moduleDirectories '../../portal/myportal/statics/dist/itemRoot/static/features/[BBHOST]','target/bower_components'
```


