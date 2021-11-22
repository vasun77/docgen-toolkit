import { fragment } from "xmlbuilder2";
import VNode from "virtual-dom/vnode/vnode";
import VText from "virtual-dom/vnode/vtext";
import isVNode from "virtual-dom/vnode/is-vnode";
import isVText from "virtual-dom/vnode/is-vtext";
import escape from 'escape-html';
import * as xmlBuilder from './htmlToXmlBuilder';
import namespaces from "./xmlNamespaces";
//import { buildList, createNumbering } from "./buildList";


//const HTMLToVDOM = HTMLToVDOM_;
const getTreeFromHTML = require('html-to-vdom')({
  VNode,
  VText,
});

const createNumberingNode = (listElements, id) => {
  let arr = [];
  let ab = {
    _children: [],
    _fTextNode: false,
    _attrs: {
      'w:abstractNumId': String(id + 1)
    },
    _tag: 'w:abstractNum'
  }
  let mlt = {
    _parent: ab,
    _children: [],
    _fTextNode: false,
    _attrs: {
      'w:val': 'hybridMultilevel'
    },
    _tag: 'w:multiLevelType'
  }
  ab._children.push(mlt);
  listElements.filter((value, index, self) => {
    return self.findIndex((v) => v.level === value.level) === index;
  }).forEach(({level, type}) => {
    let lvl = {
      _parent: ab,
      _children: [],
      _fTextNode: false,
      _attrs: {
        'w:ilvl': String(level)
      },
      _tag: 'w:lvl'
    }
    let lvlStart = {
      _parent: lvl,
      _children:[],
      _fTextNode: false,
      _attrs: {
        'w:val': '1'
      },
      _tag: 'w:start'
    };
    lvl._children.push(lvlStart);
    arr.push(lvl)
    let numFmt = {
      _parent: lvl,
      _children:[],
      _fTextNode: false,
      _attrs:{
        'w:val': type === 'ol' ? 'decimal' : 'bullet',
      },
      _tag: 'w:numFmt'
    }
    lvl._children.push(numFmt);
    let lvlText = {
      _parent: lvl,
      _children:[],
      _fTextNode: false,
      _attrs:{
        //'w:val': type === 'ol' ? `%${level + 1}` : '',
        'w:val': type === 'ol' ? `%${level + 1}` : '\u2022',
      },
      _tag: 'w:lvlText'
    }
    lvl._children.push(lvlText);
    let lvlJc = {
      _parent: lvl,
      _children:[],
      _fTextNode: false,
      _attrs:{
        'w:val': 'left',
      },
      _tag: 'w:lvlJc'
    }
    lvl._children.push(lvlJc);
    let ppr = {
      _parent: lvl,
      _children:[],
      _fTextNode: false,
      _attrs: {},
      _tag: 'w:pPr'
    }
    lvl._children.push(ppr);
    let tabs = {
      _parent: ppr,
      _fTextNode: false,
      _children:[],
      _attrs: {},
      _tag: 'w:tabs'
    };
    ppr._children.push(tabs);
    let tab = {
      _parent: tabs,
      _fTextNode: false,
      _children:[],
      _attrs: {
        'w:val': 'num',
        'w:pos': String((level + 1) * 720),
      },
      _tag: 'w:tabs'
    }
    tabs._children.push(tab);
    let ind = {
      _parent: ppr,
      _children: [],
      _fTextNode: false,
      _attrs: {
        'w:left': String((level + 1) * 720),
        'w:hanging': "360"
      },
      _tag: 'w:ind'
    }
    ppr._children.push(ind);

    if (type === 'ul') {
      let rpr = {
        _parent: lvl,
        _children: [],
        _fTextNode: false,
        _attrs: {
          'w:ascii': 'Wingdings',
          'w:hAnsi': 'Wingdings',
          'w:hint': 'default'
        },
        _tag: 'w:rPr'
      }
      let rFront = {
        _parent: rpr,
        _fTextNode: false,
        _attrs: {},
        _tag: 'w:rFront',
        _children: []

      }
      rpr._children.push(rFront);
      lvl._children.push(rpr);
    }
    ab._children.push(lvl);
  });
  return ab;
}

const createNumbering = (listElements, prepped_secondaries) => {
  let numbering = null;
  let numberId = 0;
  let numberEl;
  let parent = null;
  for (let i = 0; i < prepped_secondaries.length; i++) {
    let len = prepped_secondaries[i].length - 1; //get last element
    let filename = prepped_secondaries[i][len]
    if (filename === 'word/numbering.xml') {
      numbering = prepped_secondaries[i];
      if (prepped_secondaries[i][0]._children.length) {
        numberEl = prepped_secondaries[i][0]._children;
        for (let k = 0; k < prepped_secondaries[i][0]._children.length; k++) {
          //console.log('all childs', prepped_secondaries[i][0]._children[k])
          if (prepped_secondaries[i][0]._children[k]._tag === 'w:abstractNum') {
            numberId++;
          }
        }
        parent = prepped_secondaries[i][0]._children[numberId]._parent;
      }
      break;
    }
  }
  // propcess numbering here
  if (!numbering) {
    numbering = {
      _parent: null,
      _children: [],
      _fTextNode: false,
      _attrs: {
        'xmlns:w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'xmlns:o': 'urn:schemas-microsoft-com:office:office',
        'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'xmlns:v': 'urn:schemas-microsoft-com:vml'
      },
      _tag: 'w:numbering'
    }
    numberEl = numbering._children;
  }

  let listNodes = createNumberingNode(listElements, numberId);
  listNodes["_parent"] = parent;
  numberEl.splice(numberId, 0, listNodes);
  console.log('listNodes => ', listNodes);
  let numNode = {
    _parent: parent,
    _children: [],
    _fTextNode: false,
    _attrs: {
      'w:numId': String(numberId + 1),
    },
    _tag: 'w:num'
  }
  let abNumId = {
    _parent: numNode,
    _children: [],
    _fTextNode: false,
    _attrs: {
      'w:val': String(numberId + 1)
    },
    _tag: 'w:abstractNumId'
  }
  numNode._children.push(abNumId);
  numberEl.push(numNode);
  return numberId + 1;
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

function findXMLEquivalent(vNode, xmlFragment, prepped_secondaries) {
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
      const paragraphFragment = xmlBuilder.buildParagraph(vNode, {}, prepped_secondaries);
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
export function convertVTreeToXML(vTree, xmlFragment, prepped_secondaries) {
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
    findXMLEquivalent(vTree, xmlFragment, prepped_secondaries);
  } else if (isVText(vTree)) {
    xmlBuilder.buildTextElement(xmlFragment, escape(String(vTree.text)));
  }
  return xmlFragment;
}

const convertHtml = (htmlStr, prepped_secondaries) =>  {
  const vTree = getTreeFromHTML(htmlStr);
  const xmlFragment = fragment({
    namespaceAlias: {w: namespaces.w},
  });

  const populatedXmlFragment = convertVTreeToXML(vTree, xmlFragment, prepped_secondaries);
  return populatedXmlFragment.toObject();
}

export default convertHtml;