import VNode from "virtual-dom/vnode/vnode";
import isVNode from "virtual-dom/vnode/is-vnode";
import isVText from "virtual-dom/vnode/is-vtext";

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
    //console.log(`-----------level = ${level} and type is ${type}`);
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
        /*'w:val': type === 'ol' ? `%${level + 1}` : '',*/
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
      //console.log(`checking secondary numbering file`, prepped_secondaries[i][0]);
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

export { buildList, createNumbering };