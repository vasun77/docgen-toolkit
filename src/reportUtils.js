const cloneNodeWithoutChildren = (node) => { 
  if (node._fTextNode) {
    return {
      _children: [],
      _fTextNode: true,
      _text: node._text,
    };
  }
  return {
    _children: [],
    _fTextNode: true,
    _tag: node._tag,
    _attrs: node._attrs,
  };
};

const insertTextSiblingAfter = (textNode) => {
  const tNode = textNode._parent;
  if (!(tNode && !tNode._fTextNode && tNode._tag === 'w:t')) {
    throw console.error ('Template syntax error: text not within w:t');
  }
  const tNodeParent = tNode._parent;
  if (tNodeParent === null) {
    throw console.error ('Template syntax error: w:t node has no parent');
  }
  const idx = tNodeParent._children.indexOf(tNode);
  if (idx < 0) {
    throw console.error ('Template syntax error');
  }
  const newTNode = cloneNodeWithoutChildren(tNode);
  newTNode._parent = tNodeParent;
  const newTextNode = {
    _parent: newTNode,
    _children: [],
    _fTextNode: true,
    _text: '',
  };
  newTNode._children = [newTextNode];
  tNodeParent._children.splice(idx + 1, 0, newTNode);
  return newTextNode;
};

const getNextSibling = (node) => {
  const parent = node._parent;
  if (parent === null ) {
    return null;
  }
  const sibling = parent._children;
  const idx = sibling.indexOf(node);
  if (idx < 0 || idx >= siblings.length - 1) {
    return null;
  }
  return sibling[idx + 1];
};

export {
  getNextSibling,
  insertTextSiblingAfter
};