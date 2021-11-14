import sax from 'sax';
import { cloneNodeForLogging } from './reportUtils';
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
};

const buildXml = (node, options, indent = '') => {
  let xml = indent.length ? '' : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
   
  //logger.debug(`buildXml ${indent}...`,{
  //  attach: cloneNodeForLogging(node)
  //});

  if (node._fTextNode) {
    xml += sanitizeText(node._text, options);
  } else {
    let attrs = '';
    const nodeAttrs = node._attrs;
    Object.keys(nodeAttrs).forEach(key => {
      attrs += ` ${key}="${sanitizeAttr(nodeAttrs[key])}"`;
    });
    const fHasChildren = node._children.length > 0;
    const suffix = fHasChildren ? '' : '/';
    xml += `\n${indent}<${node._tag}${attrs}${suffix}>`;
    let fLastChildIsNode = false;
    node._children.forEach(child => {
      xml += buildXml(child, options, `${indent} `);
      fLastChildIsNode = !child._fTextNode;
    });
    if (fHasChildren) {
      const indent2 = fLastChildIsNode ? `\n${indent}` : '';
      xml += `${indent2}</${node._tag}>`;
    }
  }
  return xml;
};

const sanitizeText = (str, options) => {
  //logger.debug(`SanitizeText str => ${str}, and options => ${JSON.stringify(options)}`);
  let out = '';
  const segments = str.split(options.literalXmlDelimiter);
  let fLiteral = false;
  for (let i = 0; i < segments.length; i++) {
    let processedSegment = segments[i];
    if (!fLiteral) {
      processedSegment = processedSegment.replace(/&/g, '&amp;'); // must be the first one
      processedSegment = processedSegment.replace(/</g, '&lt;');
      processedSegment = processedSegment.replace(/>/g, '&gt;');
    }
    out += processedSegment;
    fLiteral = !fLiteral;
  }
  if (segments.length > 2) {
    out = processLiteralXml(out)
  }
  return out;
};

const sanitizeAttr = (attr) => {
  let out = typeof attr === 'string' ? attr : attr.value;
  out = out.replace(/&/g, '&amp;'); // must be the first one
  out = out.replace(/</g, '&lt;');
  out = out.replace(/>/g, '&gt;');
  out = out.replace(/'/g, '&apos;');
  out = out.replace(/"/g, '&quot;');
  return out;
};

const processLiteralXml = (str) => {
  let base = `</w:t></w:r></w:p>`;
  let out = `<w:p><w:r><w:t>`;
  return `${base}${str}${out}`;
}


export { parseXml, buildXml };