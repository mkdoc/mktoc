var through = require('through3')
  , mkast = require('mkast')
  , Node = mkast.Node
  , collect = mkast.NodeWalker.collect;

function Toc(opts) {

  // document to hold the TOC list
  this.doc = Node.createDocument();

  // nodes to push() between document and EOF
  this.nodes = [];

  // if user specifed a title then append it to the beginning
  if(opts.title) {
    var title = Node.createNode(Node.HEADING, {level: opts.level || 1});
    title.appendChild(Node.createNode(Node.TEXT, {literal: opts.title}));
    this.nodes.push(title);
    //this.doc.appendChild(title);
  }

  // root list for the hierarchy
  this.list = Node.createNode(Node.LIST, this.getListData());
  this.nodes.push(this.list);
  //this.doc.appendChild(this.list);

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

  item = Node.createNode(Node.ITEM, this.getListData());

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
      target = this.current || this.list;

      if(Node.is(target, Node.ITEM)) {
        list = Node.createNode(Node.LIST, this.getListData());
        target.appendChild(list);
        target = this.current = list;
      }

      target.appendChild(item);
    }

    // store current level
    this.level = chunk.level;
  }

  cb();
}

function flush(cb) {
  this.push(this.doc);
  for(var i = 0;i < this.nodes.length;i++) {
    this.push(this.nodes[i]);
  }
  this.push(Node.createNode(Node.EOF));
  cb();
}

function getListData(type, padding, bulletChar) {
  return {
    _listData: {
      type: type || 'bullet',
      tight: true,
      bulletChar: bulletChar || '-',
      padding: padding || 1,
      markerOffset: 0
    }
  }
}

Toc.prototype.getListData = getListData;

module.exports = through.transform(transform, flush, {ctor: Toc});
