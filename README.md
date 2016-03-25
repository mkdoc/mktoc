# Table of Contents

[![Build Status](https://travis-ci.org/mkdoc/mktoc.svg?v=3)](https://travis-ci.org/mkdoc/mktoc)
[![npm version](http://img.shields.io/npm/v/mktoc.svg?v=3)](https://npmjs.org/package/mktoc)
[![Coverage Status](https://coveralls.io/repos/mkdoc/mktoc/badge.svg?branch=master&service=github&v=3)](https://coveralls.io/github/mkdoc/mktoc?branch=master)

> Generate a table of contents index

## Install

```
npm i mktoc --save
```

For the command line interface install [mkdoc][] globally (`npm i -g mkdoc`).

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

## Help

```
mktoc [options]

Generates a table of contents index.

  -h, --help  Display this help and exit
  --version   Print the version and exit

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

## License

MIT

---

*Created by [mkdoc](https://github.com/mkdoc/mkdoc) on March 25, 2016*

[mkdoc]: https://github.com/mkdoc/mkdoc
[commonmark]: http://commonmark.org
[jshint]: http://jshint.com
[jscs]: http://jscs.info

