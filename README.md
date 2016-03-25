# Contents Index

[![Build Status](https://travis-ci.org/mkdoc/mktoc.svg?v=3)](https://travis-ci.org/mkdoc/mktoc)
[![npm version](http://img.shields.io/npm/v/mktoc.svg?v=3)](https://npmjs.org/package/mktoc)
[![Coverage Status](https://coveralls.io/repos/mkdoc/mktoc/badge.svg?branch=master&service=github&v=3)](https://coveralls.io/github/mkdoc/mktoc?branch=master)

> Generate a table of contents index

## Install

```
npm i mktoc --save
```

For the command line interface install [mkdoc][] globally (`npm i -g mkdoc`).

---

- [Install](#install)
- [Usage](#usage)
- [Example](#example)
- [Help](#help)
- [API](#api)
   - [toc](#toc)
     - [Options](#options)
   - [Toc](#toc-1)
     - [Options](#options-1)
- [License](#license)

---

## Usage

Create the stream and write a [commonmark][] document:

```javascript
var toc = require('mktoc')
  , ast = require('mkast');
ast.src('# Heading\n\n## Sub Heading\n\n')
  .pipe(toc())
  .pipe(ast.stringify({indent: 2}))
  .pipe(process.stdout);
```

## Example

Create a standalone table of contents:

```shell
mkcat README.md | mktoc -s | mkout > TOC.md
```

Inject the table of contents into a document containing the `<!-- @toc -->` marker:

```shell
mkcat readme.md | mktoc | mkout > README.md
```

Set an initial heading with the specified level:

```shell
mkcat readme.md | mktoc --title 'Table of Contents' --level 2 | mkout > README.md
```

## Help

```
mktoc [options]

Generates a table of contents index.

  -t, --title=[TITLE]  Set initial heading
  -l, --level=[NUM]    Set initial heading level
  -d, --depth=[NUM]    Ignore headings below a depth
  -s, --standalone     Create standalone index
  -h, --help           Display this help and exit
  --version            Print the version and exit

Report bugs to https://github.com/mkdoc/mktoc/issues
```

## API

### toc

```javascript
toc([opts][, cb])
```

Generate a document containing a table of contents list.

Returns an output stream.

* `opts` Object processing options.
* `cb` Function callback function.

#### Options

* `input` Readable input stream.
* `output` Writable output stream.

### Toc

```javascript
new Toc([opts])
```

Create a table of contents index stream.

* `opts` Object processing options.

#### Options

* `standalone` Boolean discard incoming data.
* `type` String=bullet list output type, `bullet` or `ordered`.
* `link` Booleani=true whether to create links in the output lists.

## License

MIT

---

*Created by [mkdoc](https://github.com/mkdoc/mkdoc) on March 25, 2016*

[mkdoc]: https://github.com/mkdoc/mkdoc
[commonmark]: http://commonmark.org
[jshint]: http://jshint.com
[jscs]: http://jscs.info

