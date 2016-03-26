var expect = require('chai').expect
  , fs = require('fs')
  , ast = require('mkast')
  , Node = ast.Node
  , mktoc = require('../../index')
  , utils = require('../util');

describe('mktoc:', function() {

  it('should create toc for basic headings', function(done) {
    var source = 'test/fixtures/basic.md'
      , target = 'target/basic.json.log'
      , data = ast.parse('' + fs.readFileSync(source))

    // mock file for correct relative path
    // mkcat normally injects this info
    data.file = source;

    var input = ast.serialize(data)
      , output = fs.createWriteStream(target)
      , opts = {
          input: input,
          output: output,
          standalone: true,
          type: 'ordered'
      };
    
    mktoc(opts);

    output.once('finish', function() {
      var result = utils.result(target);

      //console.dir(result)

      // open document
      expect(result[0].type).to.eql(Node.DOCUMENT);

      // list data
      expect(result[1].type).to.eql(Node.LIST);
      expect(result[1].lastLineBlank).to.eql(true);

      var h1 = result[1].firstChild
        , h1Link = h1.firstChild
        , h1Text = h1Link.firstChild;

      expect(h1.type).to.eql(Node.ITEM);
      expect(h1Link.type).to.eql(Node.LINK);
      expect(h1Link.destination).to.eql('#heading-1');
      expect(h1Text.literal).to.eql('Heading 1')

      var h2 = h1Link.next
        , h2Item = h2.firstChild
        , h2Link = h2Item.firstChild
        , h2Text = h2Link.firstChild;

      expect(h2.type).to.eql(Node.LIST);
      expect(h2Item.type).to.eql(Node.ITEM);
      expect(h2Link.type).to.eql(Node.LINK);
      expect(h2Link.destination).to.eql('#heading-2');
      expect(h2Text.literal).to.eql('Heading 2');

      var h3 = h2Item.next
        , h3Item = h3.firstChild
        , h3Link = h3Item.firstChild
        , h3Text = h3Link.firstChild;

      expect(h3.type).to.eql(Node.LIST);
      expect(h3Link.type).to.eql(Node.LINK);
      expect(h3Link.destination).to.eql('#heading-3');
      expect(h3Text.literal).to.eql('Heading 3');

      var h4 = h3Item.next
        , h4Item = h4.firstChild
        , h4Link = h4Item.firstChild
        , h4Text = h4Link.firstChild;

      expect(h4.type).to.eql(Node.LIST);
      expect(h4Link.type).to.eql(Node.LINK);
      expect(h4Link.destination).to.eql('#heading-4');
      expect(h4Text.literal).to.eql('Heading 4');

      var h5 = h4Item.next
        , h5Item = h5.firstChild
        , h5Link = h5Item.firstChild
        , h5Text = h5Link.firstChild;

      expect(h5.type).to.eql(Node.LIST);
      expect(h5Link.type).to.eql(Node.LINK);
      expect(h5Link.destination).to.eql('#heading-5');
      expect(h5Text.literal).to.eql('Heading 5');

      var h6 = h5Item.next
        , h6Item = h6.firstChild
        , h6Link = h6Item.firstChild
        , h6Text = h6Link.firstChild;

      expect(h6.type).to.eql(Node.LIST);
      expect(h6Link.type).to.eql(Node.LINK);
      expect(h6Link.destination).to.eql('#heading-6');
      expect(h6Text.literal).to.eql('Heading 6');

      // eof
      expect(result[2].type).to.eql(Node.EOF);

      done();
    })
  });

});