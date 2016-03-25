var through = require('through3')
  , mkast = require('mkast')
  , Node = mkast.Node
  , collect = mkast.NodeWalker.collect;

function Toc(opts) {

  // when standalone all other data apart from the generated TOC
  // document is removed from the stream
  this.standalone = opts.standalone !== undefined 
    ? opts.standalone : false;

  this.type = opts.type === 'ordered' || opts.type === 'bullet'
    ? opts.type : 'bullet';

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
    , target;

  item = Node.createNode(Node.ITEM, this.getListData(this.type));

  if(Node.is(chunk, Node.HEADING)) {

    // preserve headings that are already links
    if(Node.is(chunk.firstChild, Node.LINK)) {
      item.appendChild(Node.deserialize(chunk.firstChild));
      return cb();
    }

    text = collect(chunk, Node.TEXT);

    text.forEach(function(txt) {
      para.appendChild(Node.deserialize(txt));
    })

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
      //console.error('level: %s', chunk.level);
      target = this.current || this.list;

      //if(Node.is(target, Node.ITEM)) {
      if(chunk.level !== this.level) {
        list = Node.createNode(Node.LIST, this.getListData());
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
        && ~chunk.literal.indexOf('@toc')) {

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
