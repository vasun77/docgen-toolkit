import sax from 'sax';
import { logger } from "./debug";

const parseXml = (templateXml) => {
  const parser = sax.parser(true, {
    trim: false,
    normalize: false
  });
  let curNode = null;
  let numXmlElements = 0;
  let template = null;

  return new Promise((resolve, reject) => {
    parser.onopentag = (node) => {
      const newNode = {
        _parent: curNode || null,
        _children: [],
        _fTextNode: false,
        _tag: node.name,
        _attrs: node.attributes,
      };
      if (curNode !== null) {
        curNode._children.push(newNode);
      } else {
        template = newNode;
      }
      curNode = newNode;
      numXmlElements += 1;
    };

    parser.onclosetag = () => {
      curNode = curNode !== null ? curNode._parent : null;
    };

    parser.ontext = (text) => {
      if (curNode === null) {
        return;
      }
      curNode._children.push({
        _parent: curNode,
        _children: [],
        _fTextNode: true,
        _text: text,

      });
    };

    parser.onend = () => {
      logger.debug(`Number of XML elements: ${numXmlElements}`);
      resolve(template);
    };

    parser.onerror = (err) => {
      reject(err);
    };

    parser.write(templateXml);
    parser.end();
  });
}

export { parseXml };