var through = require('through3')
  , mkast = require('mkast')
  , Node = mkast.Node
  , collect = mkast.NodeWalker.collect
  , MARKER = '@toc'
  , ORDERED = 'ordered'
  , BULLET = 'bullet'
  , BULLET_HYPHEN = '-'
  , BULLET_PLUS = '+'
  , BULLET_STAR = '*'
  , HASH = '#';

/**
 *  Create a table of contents index stream.
 *
 *  Note that in order to build a complete index all data must be read so this 
 *  implementation buffers incoming nodes and flushes them when the stream 
 *  is ended writing the index nodes where necessary.
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

  this.bulletChar = opts.bullet === BULLET_HYPHEN
    || opts.bullet === BULLET_PLUS
    || opts.bullet === BULLET_STAR ? opts.bullet : BULLET_HYPHEN;

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

  // root list for the hierarchy
  this.list = Node.createNode(Node.LIST, this.getListData(this.type, 0));
  this.nodes.push(this.list);

  // current list of item
  this.current = null;

  // current level
  this.level = 0;
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
    , literal = ''
    // encapsulating link when `link` option is set
    , link;

  if(!this.standalone) {
    this.input.push(chunk); 
  }

  if(Node.is(chunk, Node.HEADING)) {

    // ignore these levels
    if(chunk.level < this.depth || chunk.level > this.max) {
      return cb(); 
    }

    item = Node.createNode(
        Node.ITEM,
        this.getListData(this.type, chunk.level === this.depth ? 0 : 2));

    // preserve headings that are already links
    if(Node.is(chunk.firstChild, Node.LINK)) {
      item.appendChild(Node.deserialize(chunk.firstChild));
      return cb();
    }

    container = Node.createNode(Node.PARAGRAPH);

    text = collect(chunk, Node.TEXT);

    if(this.link) {
      link = Node.createNode(Node.LINK);
      container = link;
    }

    text.forEach(function(txt) {
      literal += txt.literal;
      container.appendChild(Node.deserialize(txt));
    })

    if(link) {
      link.destination = this.destination(literal);
    }

    item.appendChild(container);

    // level 1 headings go into primary list
    if(chunk.level === this.depth) {
      // coming back from deeper - create a new list
      if(this.level > this.depth) {
        this.list = Node.createNode(Node.LIST, this.getListData());
        this.nodes.push(this.list);
      }
      this.list.appendChild(item);
      this.current = item;
    // other headings look for parents
    }else{
      target = this.current || this.list;

      //if(Node.is(target, Node.ITEM)) {
      if(chunk.level !== this.level) {
        list = Node.createNode(Node.LIST, this.getListData());
        // descending into a nested level
        if(chunk.level > this.level) {
          //console.error('descending: ' + literal);
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

function print(suppress) {

  // nothing to do
  if(!this.nodes.length) {
    return; 
  }

  if(!suppress) {
    this.push(this.doc);
  }

  for(var i = 0;i < this.nodes.length;i++) {
    this.push(this.nodes[i]);
  }

  if(!suppress) {
    this.push(Node.createNode(Node.EOF));
  }
}

function flush(cb) {
  var i
    , chunk
    , node
    , j = this.nodes.length;

  //console.error(j)

  while(j--) {
    chunk = this.nodes[j];
    //console.error(chunk.type);
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

function getListData(type, padding) {
  return {
    _listData: {
      type: type || BULLET,
      tight: true,
      bulletChar: this.bulletChar,
      padding: padding || 2,
      markerOffset: 0
    }
  }
}

// github style automatic header identifiers
function gh(text) {
  text = text.toLowerCase();
  text = text.replace(/[^A-Z0-9a-z _-]/g, '');
  text = text.replace(/( )/g, '-');
  text = text.replace(/-{2,}/g, '-');
  return text;
}

// default destination function
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
