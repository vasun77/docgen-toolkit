import { omit } from 'timm';
import { logger } from "./debug";

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
    _fTextNode: false,
    _tag: node._tag,
    _attrs: node._attrs,
  };
};

const cloneNodeForLogging = (node) => omit(node, ['_parent', '_childrend']);

const insertTextSiblingAfter = (textNode) => {
  const tNode = textNode._parent;
  if (!(tNode && !tNode._fTextNode && tNode._tag === 'w:t')) {
    throw new Error('Template syntax error: text not within w:t');
  }
  const tNodeParent = tNode._parent;
  if (tNodeParent === null) {
    throw new Error('Template syntax error: w:t node has no parent');
  }
  const idx = tNodeParent._children.indexOf(tNode);
  if (idx < 0) {
    throw new Error('Template syntax error');
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
  const siblings = parent._children;
  const idx = siblings.indexOf(node);
  if (idx < 0 || idx >= siblings.length - 1) {
    return null;
  }
  return siblings[idx + 1];
};

const getCurLoop = (ctx) => {
  if(!ctx.loops.length) {
    return null;
  }
  return ctx.loops[ctx.loops.length - 1];
}


const isLoopExploring = (ctx) => {
  const curLoop = getCurLoop(ctx);
  return curLoop != null && curLoop.idx < 0;
};

const logLoop = (loops) => {
  if (!loops.length) return;
  const level = loops.length - 1;
  const { varName, idx, loopOver, isIf } = loops[level];
  const idxStr = idx >= 0 ? idx + 1 : 'EXPLORATION';
  logger.debug(
    `${isIf ? 'IF' : 'FOR'} loop ` +
      `on ${level} : ${varName} ` +
      `${idxStr}/${loopOver.length}`
  );
};

const createNewNode = (tag, isTextNode, attrs, text) => {
  if (isTextNode) {
    return {
      _children: [],
      _fTextNode: true,
      _attrs: attrs,
      _text: text,
      _tag: tag
    }
  }
  return {
      _children: [],
      _fTextNode: false,
      _attrs: attrs,
      _tag: tag
  }
}

const newNonTextNode = (
  tag, attrs = {}, children = []
 ) => {
  const node = {
    _fTextNode: false,
    _tag: tag,
    _attrs: attrs,
    _children: children,
  };
  node._children.forEach(child => {
    child._parent = node;
  });
  return node;
};

const newTextNode = (text) => {
  const node = { _children: [], _fTextNode: true, _text: text };
  return node;
};

const addChild = (parent, child) => {
  parent._children.push(child);
  child._parent = parent;
  return child;
};


export {
  cloneNodeWithoutChildren,
  cloneNodeForLogging,
  getNextSibling,
  insertTextSiblingAfter,
  getCurLoop,
  isLoopExploring,
  logLoop,
  addChild,
  newNonTextNode,
  newTextNode,
  createNewNode
};