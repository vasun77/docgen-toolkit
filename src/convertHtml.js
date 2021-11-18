import { fragment } from "xmlbuilder2";
import VNode from "virtual-dom/vnode/vnode";
import VText from "virtual-dom/vnode/vtext";
import isVNode from "virtual-dom/vnode/is-vnode";
import isVText from "virtual-dom/vnode/is-vtext";
import escape from 'escape-html';
import * as xmlBuilder from './htmlToXmlBuilder';
import namespaces from "./xmlNamespaces";


//const HTMLToVDOM = HTMLToVDOM_;
const getTreeFromHTML = require('html-to-vdom')({
  VNode,
  VText,
});

const createNumbering = (listElements) => {
  return 1;
}

const buildList = (vNode) => {
  const listElements = [];

  let vNodeObjects = [{ node: vNode, level: 0, type: vNode.tagName }];
  while (vNodeObjects.length) {
    const tempVNodeObject = vNodeObjects.shift();
    if (
      isVText(tempVNodeObject.node) ||
      (isVNode(tempVNodeObject.node) && !['ul', 'ol', 'li'].includes(tempVNodeObject.node.tagName))
    ) {
      listElements.push({
        node: tempVNodeObject.node,
        level: tempVNodeObject.level,
        type: tempVNodeObject.type,
      });
    }

    if (
      tempVNodeObject.node.children &&
      tempVNodeObject.node.children.length &&
      ['ul', 'ol', 'li'].includes(tempVNodeObject.node.tagName)
    ) {
      const tempVNodeObjects = tempVNodeObject.node.children.reduce((accumulator, childVNode) => {
        if (['ul', 'ol'].includes(childVNode.tagName)) {
          accumulator.push({
            node: childVNode,
            level: tempVNodeObject.level + 1,
            type: childVNode.tagName,
          });
        } else {
          // eslint-disable-next-line no-lonely-if
          if (
            accumulator.length > 0 &&
            isVNode(accumulator[accumulator.length - 1].node) &&
            accumulator[accumulator.length - 1].node.tagName.toLowerCase() === 'p'
          ) {
            accumulator[accumulator.length - 1].node.children.push(childVNode);
          } else {
            const paragraphVNode = new VNode(
              'p',
              null,
              // eslint-disable-next-line no-nested-ternary
              isVText(childVNode)
                ? [childVNode]
                : // eslint-disable-next-line no-nested-ternary
                isVNode(childVNode)
                ? childVNode.tagName.toLowerCase() === 'li'
                  ? [...childVNode.children]
                  : [childVNode]
                : []
            );
            accumulator.push({
              // eslint-disable-next-line prettier/prettier, no-nested-ternary
              node: isVNode(childVNode)
                ? // eslint-disable-next-line prettier/prettier, no-nested-ternary
                  childVNode.tagName.toLowerCase() === 'li'
                  ? childVNode
                  : childVNode.tagName.toLowerCase() !== 'p'
                  ? paragraphVNode
                  : childVNode
                : // eslint-disable-next-line prettier/prettier
                  paragraphVNode,
              level: tempVNodeObject.level,
              type: tempVNodeObject.type,
            });
          }
        }

        return accumulator;
      }, []);
      vNodeObjects = tempVNodeObjects.concat(vNodeObjects);
    }
  }

  return listElements;
};

function findXMLEquivalent(vNode, xmlFragment) {
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
      const paragraphFragment = xmlBuilder.buildParagraph(vNode, {});
      xmlFragment.import(paragraphFragment);
      return;
    case 'ol':
    case 'ul':
      const listElements = buildList(vNode);
      const numberingId = createNumbering(listElements);
      // eslint-disable-next-line no-plusplus
      for (let index = 0; index < listElements.length; index++) {
        const listElement = listElements[index];
        // eslint-disable-next-line no-shadow
        const paragraphFragment = xmlBuilder.buildParagraph(
          listElement.node,
          {
            numbering: { levelId: listElement.level, numberingId },
          }
        );
        xmlFragment.import(paragraphFragment);
      }
      return;
    case 'br':
      const linebreakFragment = xmlBuilder.buildParagraph(null, {});
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
export function convertVTreeToXML(vTree, xmlFragment) {
  if (!vTree) {
    // eslint-disable-next-line no-useless-return
    return '';
  }
  if (Array.isArray(vTree) && vTree.length) {
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < vTree.length; index++) {
      const vNode = vTree[index];
      convertVTreeToXML(vNode, xmlFragment);
    }
  } else if (isVNode(vTree)) {
    findXMLEquivalent(vTree, xmlFragment);
  } else if (isVText(vTree)) {
    xmlBuilder.buildTextElement(xmlFragment, escape(String(vTree.text)));
  }
  return xmlFragment;
}

const convertHtml = (htmlStr) =>  {
  const vTree = getTreeFromHTML(htmlStr);
  const xmlFragment = fragment({
    namespaceAlias: {w: namespaces.w},
  });

  const populatedXmlFragment = convertVTreeToXML(vTree, xmlFragment);
  return populatedXmlFragment.toObject();
}

export default convertHtml;