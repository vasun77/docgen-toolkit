import { fragment } from "xmlbuilder2";
import VNode from "virtual-dom/vnode/vnode";
import VText from "virtual-dom/vnode/vtext";
import isVNode from "virtual-dom/vnode/is-vnode";
import isVText from "virtual-dom/vnode/is-vtext";
import escape from 'escape-html';
import * as xmlBuilder from './htmlToXmlBuilder';
import namespaces from "./xmlNamespaces";
import { buildList, createNumbering } from "./buildList";


//const HTMLToVDOM = HTMLToVDOM_;
const getTreeFromHTML = require('html-to-vdom')({
  VNode,
  VText,
});

function findXMLEquivalent(vNode, xmlFragment, prepped_secondaries, ctx) {
  if (
    vNode.tagName === 'div' &&
    (vNode.properties.attributes.class === 'page-break' ||
      (vNode.properties.style && vNode.properties.style['page-break-after']))
  ) {
    const paragraphFragment = fragment({
      namespaceAlias: { w: namespaces.w },
    })
      .ele('@w', 'p')
      .ele('@w', 'r')
      .ele('@w', 'br')
      .att('@w', 'type', 'page')
      .up()
      .up()
      .up();

    xmlFragment.import(paragraphFragment);
    return;
  }

  switch (vNode.tagName) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      const headingFragment = xmlBuilder.buildParagraph(
        vNode,
        {
          paragraphStyle: `Heading${vNode.tagName[1]}`,
        },
        ctx
      );
      xmlFragment.import(headingFragment);
      return;
    case 'span':
    case 'strong':
    case 'b':
    case 'em':
    case 'i':
    case 'u':
    case 'ins':
    case 'strike':
    case 'del':
    case 's':
    case 'sub':
    case 'sup':
    case 'mark':
    case 'p':
    case 'a':
    case 'blockquote':
    case 'code':
    case 'pre':
      const paragraphFragment = xmlBuilder.buildParagraph(vNode, {}, ctx);
      xmlFragment.import(paragraphFragment);
      return;
    case 'ol':
    case 'ul':
      const listElements = buildList(vNode);
      const numberingId = createNumbering(listElements, prepped_secondaries);
      // eslint-disable-next-line no-plusplus
      for (let index = 0; index < listElements.length; index++) {
        const listElement = listElements[index];
        // eslint-disable-next-line no-shadow
        const paragraphFragment = xmlBuilder.buildParagraph(
          listElement.node,
          {
            numbering: { levelId: listElement.level, numberingId },
          },
          ctx
        );
        xmlFragment.import(paragraphFragment);
      }
      return;
    case 'br':
      const linebreakFragment = xmlBuilder.buildParagraph(null, {}, ctx);
      xmlFragment.import(linebreakFragment);
      return;
    default:
      break;
  }
  if (vNode.children && Array.isArray(vNode.children) && vNode.children.length) {
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < vNode.children.length; index++) {
      const childVNode = vNode.children[index];
      // eslint-disable-next-line no-use-before-define
      convertVTreeToXML(childVNode, xmlFragment);
    }
  }
}

// eslint-disable-next-line consistent-return
export function convertVTreeToXML(vTree, xmlFragment, prepped_secondaries, ctx) {
  if (!vTree) {
    // eslint-disable-next-line no-useless-return
    return '';
  }
  if (Array.isArray(vTree) && vTree.length) {
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < vTree.length; index++) {
      const vNode = vTree[index];
      convertVTreeToXML(vNode, xmlFragment, prepped_secondaries, ctx);
    }
  } else if (isVNode(vTree)) {
    findXMLEquivalent(vTree, xmlFragment, prepped_secondaries, ctx);
  } else if (isVText(vTree)) {
    let textFragment = xmlBuilder.buildTextElement(escape(String(vTree.text)));
    xmlFragment.import(textFragment);
  }
  return xmlFragment;
}

const sanitizeHtml = (htmlStr) => {
  return htmlStr.replace(/[\r\n]+/gm, "<br>");
}

const convertHtml = (htmlStr, prepped_secondaries,ctx) =>  {
  let san = sanitizeHtml(htmlStr);
  const vTree = getTreeFromHTML(san);
  const xmlFragment = fragment({
    namespaceAlias: {w: namespaces.w},
  });

  const populatedXmlFragment = convertVTreeToXML(vTree, xmlFragment, prepped_secondaries, ctx);
  return populatedXmlFragment.toObject();
}

export default convertHtml;