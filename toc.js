var through = require('through3')
  , mkast = require('mkast')
  , Node = mkast.Node
  , collect = mkast.NodeWalker.collect
  , MARKER = '@toc';

function gfm(text) {
  text = text.toLowerCase();
  text = text.replace(/[^A-Z0-9a-z _-]/g, '');
  text = text.replace(/( )/g, '-');
  text = text.replace(/-{2,}/g, '-');
  return text;
}

function destination(literal) {
  if(!this.seen) {
    this.seen = {}; 
  }

  var str = gfm(literal);

  if(this.seen[str]) {
    str += '-' + this.seen[str];
  }

  if(!this.seen[str]) {
    this.seen[str] = 1; 
  }else{
    this.seen[str]++;
  }

  return '#' + str;
}

/**
 *  Create a table of contents index stream.
 *
 *  @constructor Toc
 *  @param {Object} [opts] processing options.
 *
 *  @option {Boolean} [standalone] discard incoming data.
 *  @option {String=bullet} [type] list output type, `bullet` or `ordered`.
 *  @option {Booleani=true} [link] whether to create links in the output lists.
 */
function Toc(opts) {

  // when standalone all other data apart from the generated TOC
  // document is removed from the stream
  this.standalone = opts.standalone !== undefined 
    ? opts.standalone : false;

  this.type = opts.type === 'ordered' || opts.type === 'bullet'
    ? opts.type : 'bullet';

  // do we create links, calls destination()
  this.link = opts.link !== undefined ? opts.link : true;

  // document to hold the TOC list
  this.doc = Node.createDocument();

  // input chunks we received
  this.input = [];

  // nodes to push() between document and EOF
  this.nodes = [];

  var dest = typeof opts.destination === 'function'
    ? opts.destination : destination;
  this.destination = dest.bind(this);

  // if user specifed a title then append it to the beginning
  if(opts.title) {
    var title = Node.createNode(Node.HEADING, {level: opts.level || 1});
    title.appendChild(Node.createNode(Node.TEXT, {literal: opts.title}));
    this.nodes.push(title);
  }

  // root list for the hierarchy
  this.list = Node.createNode(Node.LIST, this.getListData(this.type, 0));
  this.list._lastLineBlank = true;
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
    // paragraph
    , para = Node.createNode(Node.PARAGRAPH)
    // collection of child text nodes
    , text
    // current target item or list
    , target
    // literal string of all text nodes
    , literal = ''
    // encapsulating link when `link` option is set
    , link;

  item = Node.createNode(Node.ITEM, this.getListData(this.type));

  if(Node.is(chunk, Node.HEADING)) {

    // preserve headings that are already links
    if(Node.is(chunk.firstChild, Node.LINK)) {
      item.appendChild(Node.deserialize(chunk.firstChild));
      return cb();
    }

    text = collect(chunk, Node.TEXT);

    if(this.link) {
      link = Node.createNode(Node.LINK);
      //link.appendChild(para);
      para = link;
    }

    text.forEach(function(txt) {
      literal += txt.literal;
      para.appendChild(Node.deserialize(txt));
    })

    //console.error(literal);

    if(link) {
      link.destination = this.destination(literal);
    }

    item.appendChild(para);

    // level 1 headings go into primary list
    if(chunk.level === 1) {
      // coming back from deeper - create a new list
      if(this.level > 1) {
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

  if(!this.standalone) {
    this.input.push(chunk); 
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
    , node;
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

function getListData(type, padding, bulletChar) {
  return {
    _listData: {
      type: type || 'bullet',
      tight: true,
      bulletChar: bulletChar || '-',
      padding: padding || 2,
      markerOffset: 0
    }
  }
}

Toc.prototype.print = print;
Toc.prototype.getListData = getListData;

module.exports = through.transform(transform, flush, {ctor: Toc});
