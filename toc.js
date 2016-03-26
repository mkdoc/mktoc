var through = require('through3')
  , ast = require('mkast')
  , Node = ast.Node
  , collect = ast.NodeWalker.collect
  , MARKER = '@toc'
  , ORDERED = 'ordered'
  , BULLET = 'bullet'
  , BULLET_HYPHEN = '-'
  , BULLET_PLUS = '+'
  , BULLET_STAR = '*'
  , HASH = '#'
  , DELIMITER_PAREN = ')'
  , DELIMITER_DOT = '.';

/**
 *  Create a table of contents index stream.
 *
 *  Note that in order to build a complete index all data must be read so this 
 *  implementation buffers incoming nodes and flushes them when the stream 
 *  is ended writing the index nodes where necessary.
 *
 *  When the first child of a heading is a link it is preserved and no 
 *  automatic link is created, otherwise when creating links inline markup 
 *  in the heading is discarded.
 *
 *  If the `standalone` option is given then the incoming data is discarded 
 *  and the document representing the index is flushed.
 *
 *  When a `destination` function is specified it is passed a string 
 *  literal of the heading text and should return a URL, the function is 
 *  invoked in the scope of this stream.
 *
 *  Typically `prefix` will be either a `/`, `#` or the empty string 
 *  depending upon whether you want absolute, anchor or relative links. The 
 *  default is to use `#` for anchor links on the same page.
 *
 *  If the `bullet` option is given it must be one of `-`, `+` or `*`.
 *
 *  If the `delimiter` option is given it must a period `.` or right 
 *  parenthesis `)`.
 *
 *  @constructor Toc
 *  @param {Object} [opts] processing options.
 *
 *  @option {Boolean} [standalone] discard incoming data.
 *  @option {String=bullet} [type] list output type, `bullet` or `ordered`.
 *  @option {Boolean=true} [link] whether to create links in the output lists.
 *  @option {Number=1} [depth] ignore headings below this level.
 *  @option {Number=6} [max] ignore headings above this level.
 *  @option {Function} [destination] builds the link URLs.
 *  @option {String=#} [prefix] default link prefix.
 *  @option {String} [base] a base path for absolute links.
 *  @option {String=-} [bullet] character for bullet lists.
 *  @option {String=)} [delimiter] delimiter for ordered lists.
 */
function Toc(opts) {

  // when standalone all other data apart from the generated TOC
  // document is removed from the stream
  this.standalone = opts.standalone !== undefined 
    ? opts.standalone : false;

  this.type = opts.type === ORDERED || opts.type === BULLET
    ? opts.type : BULLET;

  // do we create links, calls destination()
  this.link = opts.link !== undefined ? opts.link : true;

  // initial depth, headings below this depth are ignored
  this.depth = typeof opts.depth === 'number' && opts.depth > 0
    ? opts.depth : 1;

  // maximum depth, headings above this depth are ignored
  this.max = typeof opts.max === 'number' && opts.max > 0
    ? opts.max : 6;

  var dest = typeof opts.destination === 'function'
    ? opts.destination : destination;
  this.destination = dest.bind(this);

  this.prefix = typeof opts.prefix === 'string' ? opts.prefix : HASH;
  this.base = typeof opts.base === 'string' ? opts.base : '';

  this.bulletChar = 
    opts.bullet === BULLET_HYPHEN
    || opts.bullet === BULLET_PLUS
    || opts.bullet === BULLET_STAR ? opts.bullet : BULLET_HYPHEN;

  this.delimiter = 
    opts.delimiter === DELIMITER_DOT
    || opts.delimiter === DELIMITER_PAREN ? opts.delimiter : DELIMITER_PAREN;


  // document to hold the TOC list
  this.doc = Node.createDocument();

  // input chunks we received
  this.input = [];

  // nodes to push() between document and EOF
  this.nodes = [];

  // if user specifed a title then append it to the beginning
  if(opts.title) {
    var title = Node.createNode(Node.HEADING, {level: opts.level || 1});
    title.appendChild(Node.createNode(Node.TEXT, {literal: opts.title}));
    this.nodes.push(title);
  }

  // current list of item
  this.current = null;

  // current level
  this.level = 0;

  if(this.type === ORDERED) {
    this.counters = []; 
  }

  // root list for the hierarchy - should come after `counters`
  // so that the ordered list data is correct
  this.list = Node.createNode(Node.LIST, this.getListData(1, 0));
  this.nodes.push(this.list);
}

/**
 *  Stream transform.
 *
 *  @private
 */
function transform(chunk, encoding, cb) {

  // new list
  var list
    // list item
    , item
    // container element: paragraph or link
    , container
    // collection of child text nodes
    , text
    // current target item or list
    , target
    // literal string of all text nodes
    , literal = '';

  if(!this.standalone) {
    this.input.push(chunk); 
  }

  if(Node.is(chunk, Node.HEADING)) {

    // ignore these levels
    if(chunk.level < this.depth || chunk.level > this.max) {
      return cb(); 
    }

    if(this.counters) {
      this.counters[chunk.level] = this.counters[chunk.level] || 0;
      this.counters[chunk.level]++;
    }

    if(this.counters && chunk.level > this.level) {
      this.counters[chunk.level] = 1;
    }

    item = Node.createNode(
        Node.ITEM,
        this.getListData(chunk.level, chunk.level === this.depth ? 0 : 2));

    // preserve headings that are already links
    if(Node.is(chunk.firstChild, Node.LINK)) {
      item.appendChild(Node.deserialize(chunk.firstChild));
    }else{
      text = collect(chunk, Node.TEXT);

      if(this.link) {
        container = Node.createNode(Node.LINK);
      }else{
        container = Node.createNode(Node.PARAGRAPH);
      }

      text.forEach(function(txt) {
        literal += txt.literal;
        container.appendChild(Node.deserialize(txt));
      })

      if(this.link) {
        container.destination = this.destination(literal);
      }

      item.appendChild(container);
    }

    // level 1 headings go into primary list
    if(chunk.level === this.depth) {
      // coming back from deeper - create a new list
      if(this.level > this.depth) {
        this.list = Node.createNode(Node.LIST, this.getListData(chunk.level));
        this.nodes.push(this.list);
      }
      this.list.appendChild(item);
      this.current = item;
    // other headings look for parents
    }else{
      target = this.current || this.list;

      //if(Node.is(target, Node.ITEM)) {
      if(chunk.level !== this.level) {


        list = Node.createNode(Node.LIST, this.getListData(chunk.level));
        // descending into a nested level
        if(chunk.level > this.level) {
          target.appendChild(list);
          target = this.current = list;
        // ascending back up level(s)
        }else{
          var diff = this.level - chunk.level;
          target = this.current.parent;
          while(--diff) {
            target = target.parent; 
          }
          target.appendChild(list);
          this.current = target;

        }
      }

      target.appendChild(item);
    }


    // store current level
    this.level = chunk.level;
  }

  cb();
}

/**
 *  Print the index document to the stream.
 */
function print() {

  // nothing to do
  if(!this.nodes.length) {
    return; 
  }

  // document
  this.push(this.doc);

  // list nodes
  for(var i = 0;i < this.nodes.length;i++) {
    this.push(this.nodes[i]);
  }

  // eof
  this.push(Node.createNode(Node.EOF));
}

function flush(cb) {
  var i
    , chunk
    , node
    , j = this.nodes.length;

  while(j--) {
    chunk = this.nodes[j];
    if(Node.is(chunk, Node.LIST)) {
      chunk._lastLineBlank = true; 
      break;
    }
  }

  if(this.standalone) {
    this.print();
  }else{
    // pass through input chunks
    for(i = 0;i < this.input.length;i++) {
      chunk = this.input[i];
      if(Node.is(chunk, Node.HTML_BLOCK)
        && (chunk.htmlBlockType === 2 || chunk._htmlBlockType === 2)
        && chunk.literal
        && ~chunk.literal.indexOf(MARKER)) {
        // consume the TOC nodes so nothing is printed at the end
        while((node = this.nodes.shift())) {
          this.push(node);
        }

        // skip the injection marker
        continue;
      }
      this.push(chunk);
    }
    // apppend TOC document
    this.print();
  }
  cb();
}

/**
 *  Get a list data object.
 *
 *  @private
 */
function getListData(level, padding, markerOffset) {
  var data = {
    _listData: {
      type: this.type,
      tight: true,
      padding: padding !== undefined ? padding : 2,
      markerOffset: markerOffset || 0
    }
  }

  if(this.counters) {
    data._listData.start = this.counters[level]; 
    data._listData.delimiter = this.delimiter;

    if(this.counters[level] !== undefined) {
      // the +1 accounts for the single space
      data._listData.padding = 
        (this.counters[level] + this.delimiter).length + 1;
    }
  }else{
    data._listData.bulletChar = this.bulletChar;
  }

  return data;
}

/**
 *  Github style automatic header identifiers.
 *
 *  @private
 */
function gh(text) {
  text = text.toLowerCase();
  text = text.replace(/[^A-Z0-9a-z _-]/g, '');
  text = text.replace(/ /g, '-');
  text = text.replace(/-{2,}/g, '-');
  return text;
}

/**
 *  Default destination function.
 *
 *  @private
 */
function destination(literal) {
  if(!this.seen) {
    this.seen = {}; 
  }
  var str = gh(literal);
  if(this.seen[str]) {
    str += '-' + this.seen[str];
  }
  if(!this.seen[str]) {
    this.seen[str] = 1; 
  }else{
    this.seen[str]++;
  }
  return this.base + this.prefix + str;
}

Toc.prototype.print = print;
Toc.prototype.getListData = getListData;

module.exports = through.transform(transform, flush, {ctor: Toc});
