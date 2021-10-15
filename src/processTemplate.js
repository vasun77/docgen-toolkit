import { getNextSibling, getCurLoop, logLoop, isLoopExploring, cloneNodeWithoutChildren, cloneNodeForLogging } from './reportUtils';
import { runUserJsAndGetRaw } from './jsSandbox';
import { logger } from './debug';
import { BUILT_IN_COMMANDS } from './constants';
import convertHtml from './convertHtml';

export function newContext(options, imageId = 0) {
  return {
    gCntIf: 0,
    level: 1,
    fCmd: false,
    cmd: '',
    fSeekQuery: false,
    buffers: {
      'w:p': { text: '', cmds: '', fInsertedText: false },
      'w:tr': { text: '', cmds: '', fInsertedText: false },
    },
    imageId,
    images: {},
    linkId: 0,
    links: {},
    htmlId: 0,
    htmls: {},
    vars: {},
    loops: [],
    fJump: false,
    shorthands: {},
    options,
  };
}

export async function extractQuery(template, createOptions) {
  const ctx = newContext(createOptions);

  // ensure no command will be processed, except QUERY
  ctx.fSeekQuery = true;

  let nodeIn = template;
  while (true) {
    // Move down
    if (nodeIn._children.length) nodeIn = nodeIn._children[0];
    else {
      // Move sideways or up
      let fFound = false;
      while (nodeIn._parent != null) {
        const parent = nodeIn._parent;
        const nextSibling = getNextSibling(nodeIn);
        if (nextSibling) {
          nodeIn = nextSibling;
          fFound = true;
          break;
        }
        nodeIn = parent;
      }
      if (!fFound) break;
    }

    if (!nodeIn) break;
    const parent = nodeIn._parent;
    if (
      nodeIn._fTextNode &&
      parent &&
      !parent._fTextNode && // Flow, don't complain
      parent._tag === 'w:t'
    ) {
      await processText(null, nodeIn, ctx, processCmd);
    }
    if (ctx.query != null) break;
  }
  return ctx.query;
}

const processForIf = async(data, node, ctx, cmd, cmdName, cmdRest) => {
  const isIf = cmdName === 'IF';
  // Identify FOR/IF loop
  let forMatch; 
  let varName;
  if (isIf) {
    if (!node._ifName) {
      node._ifName = `__if_${ctx.gCntIf}`;
      ctx.gCntIf += 1;
    }
    varName = node._ifName;
  } else {
    forMatch = /^(\S+)\s+IN\s+(.+)/i.exec(cmdRest);
    if (!forMatch) throw new Error(`Invalid FOR command => ${cmd}`);
    varName = forMatch[1];
  }

  // New FOR? If not, discard
  const curLoop = getCurLoop(ctx);
  if (!(curLoop && curLoop.varName === varName)) {
    const parentLoopLevel = ctx.loops.length - 1;
    const fParentIsExploring =
      parentLoopLevel >= 0 && ctx.loops[parentLoopLevel].idx === -1;
    let loopOver;
    if (fParentIsExploring) {
      loopOver = [];
    } else if (isIf) {
      const shouldRun = !!(await runUserJsAndGetRaw(data, cmdRest, ctx));
      loopOver = shouldRun ? [1] : [];
    } else {
      if (!forMatch) throw new Error(`Invalid FOR command => ${cmd}`);
      loopOver = await runUserJsAndGetRaw(data, forMatch[2], ctx);
      if (!Array.isArray(loopOver)){
        throw new Error(`Invalid FOR command (can only iterate over Array) => ${cmd}`);
      }
    }
    ctx.loops.push({
      refNode: node,
      refNodeLevel: ctx.level,
      varName,
      loopOver,
      isIf,
      // run through the loop once first, without outputting anything
      // (if we don't do it like this, we could not run empty loops!)
      idx: -1,
    });
  }
  logLoop(ctx.loops);

};
const appendTextToTagBuffers = (text, ctx, options) => {
  if (ctx.fSeekQuery) {
    return;
  }
  const BufferKeys = ['w:p', 'w:tr'];
  const { fCmd, fInsertedText } = options;
  const type = fCmd ? 'cmds' : 'text';
  BufferKeys.forEach(key => {
    const buf = ctx.buffers[key];
    buf[type] += text;
    if (fInsertedText) buf.fInsertedText = true;
  });
};

const getNextItem = (items, curIdx0) => {
  let nextItem = null;
  let curIdx = curIdx0 !== null ? curIdx0 : -1;
  while (nextItem === null) {
    curIdx += 1;
    if (curIdx >= items.length) {
      break;
    }
    const tempItem = items[curIdx];
    if (typeof tempItem === 'object' && tempItem.isDeleted) {
      continue;
    }
    nextItem = tempItem;
  }
  return { nextItem, curIdx };
};

const processEndForIf = async ( node, ctx, cmd, cmdName, cmdRest) => {
  const curLoop = getCurLoop(ctx);
  if (!curLoop) {
    throw new Error(`Invalid command => ${cmd}`);
  }
  const isIf = cmdName === 'END-IF';

  // First time we visit an END-IF node, we assign it the arbitrary name
  // generated when the IF was processed
  if (isIf && !node._ifName) node._ifName = curLoop.varName;

  // Check if this is the expected END-IF/END-FOR. If not:
  // - If it's one of the nested varNames, throw
  // - If it's not one of the nested varNames, ignore it; we find
  //   cases in which an END-IF/FOR is found that belongs to a previous
  //   part of the paragraph of the current loop.
  const varName = isIf ? node._ifName : cmdRest;
  if (curLoop.varName !== varName) {
    if (ctx.loops.find(o => o.varName === varName) == null) {
      logger.debug(
        `Ignoring ${cmd} (${varName}, but we're expecting ${curLoop.varName})`
      );
      return;
    }
    throw new Error(`Invalid command => ${cmd}`);
  }
  const { loopOver, idx } = curLoop;
  const { nextItem, curIdx } = getNextItem(loopOver, idx);
  if (nextItem != null) {
    // next iteration
    ctx.vars[varName] = nextItem;
    ctx.fJump = true;
    curLoop.idx = curIdx;
  } else {
    // loop finished
    ctx.loops.pop();
  }

};

export function splitCommand(cmd) {
  // Extract command name
  const cmdNameMatch = /^(\S+)\s*/.exec(cmd);
  let cmdName;
  let cmdRest = '';
  if (cmdNameMatch != null) {
    cmdName = cmdNameMatch[1].toUpperCase();
    cmdRest = cmd.slice(cmdName.length).trim();
  }

  return { cmdName, cmdRest };
}

const processCmd = async (data, node, ctx) => {
  const cmd = getCommand(ctx.cmd, ctx.shorthands, ctx.options.fixSmartQuotes);
  ctx.cmd = ''; // flush the context
  logger.debug(`Processing cmd: ${cmd}`);
  try {
    const { cmdName, cmdRest } = splitCommand(cmd);

    // Seeking query?
    if (ctx.fSeekQuery) {
      if (cmdName === 'QUERY') ctx.query = cmdRest;
      return;
    }

    // Process command
    if (cmdName === 'QUERY' || cmdName === 'CMD_NODE') {
      // logger.debug(`Ignoring ${cmdName} command`);
      // ...
      // ALIAS name ANYTHING ELSE THAT MIGHT BE PART OF THE COMMAND...
    } else if (cmdName === 'ALIAS') {
      const aliasMatch = /^(\S+)\s+(.+)/.exec(cmdRest);
      if (!aliasMatch)
        throw new Error(`Invalid ALIAS command => ${cmd}`);
      const aliasName = aliasMatch[1];
      const fullCmd = aliasMatch[2];
      ctx.shorthands[aliasName] = fullCmd;
      logger.debug(`Defined alias '${aliasName}' for: ${fullCmd}`);

      // FOR <varName> IN <expression>
      // IF <expression>
    } else if (cmdName === 'FOR' || cmdName === 'IF') {
      await processForIf(data, node, ctx, cmd, cmdName, cmdRest);

      // END-FOR
      // END-IF
    } else if (cmdName === 'END-FOR' || cmdName === 'END-IF') {
      processEndForIf(node, ctx, cmd, cmdName, cmdRest);

      // INS <expression>
    } else if (cmdName === 'INS') {
      if (!isLoopExploring(ctx)) {
        let result = await runUserJsAndGetRaw(data, cmdRest, ctx);
        if (result == null) {
          return '';
        }
        if (typeof result === 'object' && !Array.isArray(result)) {
          const nerr = new Error (`Result of command '${cmdRest}' is an object`);
          if (ctx.options.errorHandler != null) {
            result = await ctx.options.errorHandler(nerr, cmdRest);
          } else {
            throw nerr;
          }
        }
        //check string for html
        const isHTML = RegExp.prototype.test.bind(/(<([^>]+)>)/i)
        if(isHTML(result)) {
          let convertedHtml = convertHtml(result)
          logger.debug('****************************************************************************************************');
          logger.debug(convertHtml(result));
          logger.debug('****************************************************************************************************');
          return convertedHtml;
        }

        // If the `processLineBreaks` flag is set,
        // newlines are replaced with a `w:br` tag (protected by
        // the `literalXmlDelimiter` separators)
        let str = String(result);
        if (ctx.options.processLineBreaks) {
          const { literalXmlDelimiter } = ctx.options;
          str = str.replace(
            /\n/g,
            `${literalXmlDelimiter}<w:br/>${literalXmlDelimiter}`
          );
        }
        return str;
      }

      // EXEC <code>
    } else if (cmdName === 'EXEC') {
      if (!isLoopExploring(ctx)) await runUserJsAndGetRaw(data, cmdRest, ctx);

      // Invalid command
    } else throw new Error(`Invalid command => ${cmd}`);
    return;
  } catch (err) {
    if (!(err instanceof Error)) throw err;
    if (ctx.options.errorHandler != null) {
      return ctx.options.errorHandler(err);
    }
    return err;
  }
};

const builtInRegexes = BUILT_IN_COMMANDS.map(word => new RegExp(`^${word}\\b`));
const notBuiltIns = (cmd) => !builtInRegexes.some(r => r.test(cmd.toUpperCase()));

export function getCommand(command, shorthands, fixSmartQuotes) {
  // Get a cleaned version of the command

  let cmd = command.trim();
  if (cmd[0] === '*') {
    const aliasName = cmd.slice(1).trim();
    if (!shorthands[aliasName])
      throw new Error(`Unknown alias => ${cmd}`);
    cmd = shorthands[aliasName];
    logger.debug(`Alias for: ${cmd}`);
  } else if (cmd[0] === '=') {
    cmd = `INS ${cmd.slice(1).trim()}`;
  } else if (cmd[0] === '!') {
    cmd = `EXEC ${cmd.slice(1).trim()}`;
  } else if (notBuiltIns(cmd)) {
    cmd = `INS ${cmd.trim()}`;
  }

  //replace 'smart' quotes with straight quotes
  if (fixSmartQuotes) {
    cmd = cmd
      .replace(/[\u201C\u201D\u201E]/g, '"')
      .replace(/[\u2018\u2019\u201A]/g, "'");
  }

  return cmd.trim();
};

export async function produceJsReport(data, template, ctx) {
  return walkTemplate(data, template, ctx, processCmd); 
}

export async function walkTemplate(data, template, ctx, processor) {

  const out = cloneNodeWithoutChildren(template);
  let nodeIn = template;
  let nodeOut = out;
  let move;
  let deltaJump = 0;
  const errors = [];

  while (true) {
    const curLoop = getCurLoop(ctx);
    let nextSibling;

    if (ctx.fJump) {
      if (!curLoop) {
        throw new Error (`Jumping while curLooping is null`);
      }
      const { refNode, refNodeLevel } = curLoop;
      
      logger.debug(`Jumping to level ${refNodeLevel}...`,{
        attach: cloneNodeForLogging(refNode)
      });
      deltaJump = ctx.level - refNodeLevel;
      nodeIn = refNode;
      ctx.level = refNodeLevel;
      ctx.fJump = false;
      move = 'JUMP';

      // Down (only if he haven't just moved up)
    } else if (nodeIn._children.length && move !== 'UP') {
      nodeIn = nodeIn._children[0];
      ctx.level += 1;
      move = 'DOWN';

      //Sideways
    } else if (nextSibling = getNextSibling(nodeIn)) {
      nodeIn = nextSibling;
      move = 'SIDE';

      // UP
    } else {
      const parent = nodeIn._parent;
      if (parent === null) {
        break; 
      }
      nodeIn = parent;
      ctx.level -= 1;
      move = 'UP';
    }

    /*
    * Process input node
    * Delete the last generated output node in several special cases
    */
    if (move !== 'DOWN') {
      const tag = nodeOut._fTextNode ? null : nodeOut._tag;
      let fRemoveNode = false;
      // delete last generated output node if we're skipping nodes due to an empty FOR loop
      if ((tag === 'w:p' || tag === 'w:tbl' || tag === 'w:tr') && isLoopExploring(ctx)) {
        fRemoveNode = true;
        //delete last generated output node if the user inserted a paragraph
        // (or table row) with just a command
      } else if (tag === 'w:p' || tag === 'w:tr') {
        const buffers = ctx.buffers[tag];
        fRemoveNode = buffers.text === '' && buffers.cmds !== '' && !buffers.fInsertedText;
      }
      // Execute removal, if needed. The node will no longer be part of the output, but
      // the parent will be accessible from the child (so that we can still move up the tree)
      if (fRemoveNode && nodeOut._parent !== null) {
        nodeOut._parent._children.pop();
      }
    }

    //Handle an UP movement
    if (move === 'UP') {
      // Loop exploring? Update the reference node for the current loop
      if (
        isLoopExploring(ctx) &&
        curLoop && // Flow, don't complain
        nodeIn === curLoop.refNode._parent
      ) {
        curLoop.refNode = nodeIn;
        curLoop.refNodeLevel -= 1;
      }
      const nodeOutParent = nodeOut._parent;
      if (nodeOutParent == null) throw new InternalError('node parent is null');
      
      // Execute the move in the output tree
      nodeOut = nodeOutParent;
      
      // If an image was generated, replace the parent `w:t` node with
      // the image node
      if (
        ctx.pendingImageNode &&
        !nodeOut._fTextNode && // Flow-prevention
        nodeOut._tag === 'w:t'
      ) {
        const imgNode = ctx.pendingImageNode;
        const parent = nodeOut._parent;
        if (parent) {
          imgNode._parent = parent;
          parent._children.pop();
          parent._children.push(imgNode);
          // Prevent containing paragraph or table row from being removed
          ctx.buffers['w:p'].fInsertedText = true;
          ctx.buffers['w:tr'].fInsertedText = true;
        }
        delete ctx.pendingImageNode;
      }
      
      // If a link was generated, replace the parent `w:r` node with
      // the link node
      if (
        ctx.pendingLinkNode &&
        !nodeOut._fTextNode && // Flow-prevention
        nodeOut._tag === 'w:r'
      ) {
        const linkNode = ctx.pendingLinkNode;
        const parent = nodeOut._parent;
        if (parent) {
          linkNode._parent = parent;
          parent._children.pop();
          parent._children.push(linkNode);
          // Prevent containing paragraph or table row from being removed
          ctx.buffers['w:p'].fInsertedText = true;
          ctx.buffers['w:tr'].fInsertedText = true;
        }
        delete ctx.pendingLinkNode;
      }
      
      // If a html page was generated, replace the parent `w:p` node with
      // the html node
      if (
        ctx.pendingHtmlNode &&
        !nodeOut._fTextNode && // Flow-prevention
        nodeOut._tag === 'w:p'
      ) {
        const htmlNode = ctx.pendingHtmlNode;
        const parent = nodeOut._parent;
        if (parent) {
          htmlNode._parent = parent;
          parent._children.pop();
          parent._children.push(htmlNode);
          // Prevent containing paragraph or table row from being removed
          ctx.buffers['w:p'].fInsertedText = true;
          ctx.buffers['w:tr'].fInsertedText = true;
        }
        delete ctx.pendingHtmlNode;
      }
      
      // `w:tc` nodes shouldn't be left with no `w:p` or 'w:altChunk' children; if that's the
      // case, add an empty `w:p` inside
      if (
        !nodeOut._fTextNode && // Flow-prevention
        nodeOut._tag === 'w:tc' &&
        !nodeOut._children.filter(
          o => !o._fTextNode && (o._tag === 'w:p' || o._tag === 'w:altChunk')
        ).length
      ) {
        nodeOut._children.push({
          _parent: nodeOut,
          _children: [],
          _fTextNode: false,
          _tag: 'w:p',
          _attrs: {},
        });
      }
      
      // Save latest `w:rPr` node that was visited (for LINK properties)
      if (!nodeOut._fTextNode && nodeOut._tag === 'w:rPr') {
        ctx.textRunPropsNode = nodeOut;
      }
      if (!nodeIn._fTextNode && nodeIn._tag === 'w:r') {
        delete ctx.textRunPropsNode;
      }
    }

    // Node creation: DOWN | SIDE
    // --------------------------
    // Note that nodes are copied to the new tree, but that doesn't mean they will be kept.
    // In some cases, they will be removed later on; for example, when a paragraph only
    // contained a command -- it will be deleted.
    if (move === 'DOWN' || move === 'SIDE') {
      // Move nodeOut to point to the new node's parent
      if (move === 'SIDE') {
        if (nodeOut._parent == null)
          throw new Error('node parent is null');
        nodeOut = nodeOut._parent;
      }

      // Reset node buffers as needed if a `w:p` or `w:tr` is encountered
      const tag = nodeIn._fTextNode ? null : nodeIn._tag;
      if (tag === 'w:p' || tag === 'w:tr') {
        ctx.buffers[tag] = { text: '', cmds: '', fInsertedText: false };
      }

      // Clone input node and append to output tree
      const newNode = cloneNodeWithoutChildren(nodeIn);
      newNode._parent = nodeOut;
      nodeOut._children.push(newNode);
      const parent = nodeIn._parent;

      // If it's a text node inside a w:t, process it
      if (
        nodeIn._fTextNode &&
        parent &&
        !parent._fTextNode &&
        parent._tag === 'w:t'
      ) {
        const result = await processText(data, nodeIn, ctx, processor);
        if (typeof result === 'string') {
          // TODO: use a discriminated union here instead of a type assertion to distinguish TextNodes from NonTextNodes.
          const newNodeAsTextNode = newNode;
          newNodeAsTextNode._text = result;
        } else {
          errors.push(...result);
        }
      }

      // Execute the move in the output tree
      nodeOut = newNode;
    }

    // Correct output tree level in case of a JUMP
    // -------------------------------------------
    if (move === 'JUMP') {
      while (deltaJump > 0) {
        if (nodeOut._parent == null)
          throw new Error('node parent is null');
        nodeOut = nodeOut._parent;
        deltaJump -= 1;
      }
    }
  }

  if (errors.length) {
    return {
      status: 'errors',
      errors
    };
  }

  return {
    status: 'success',
    report: out,
    images: ctx.images,
    links: ctx.links,
    htmls: ctx.html,
  };
};

const processText = async (data, node, ctx, onCommand) => {
  const { cmdDelimiter, failFast } = ctx.options;
  const text = node._text;
  if (text === null || text === '') {
    return '';
  }
  const segments = text.split(cmdDelimiter[0])
                      .map(s => s.split(cmdDelimiter[1]))
                      .reduce((x, y) => x.concat(y));

  let outText = '';
  const errors = [];
  for (let idx = 0; idx < segments.length; idx++) {
    // Include the separators in the `buffers` field (used fro deleted paragraphs if appropriate)
    if (idx > 0) {
      appendTextToTagBuffers(cmdDelimiter[0], ctx, {fCmd: true});
    }
    // Append segment either to the `ctx.cmd` buffer (to be executed), if we are in "command mode",
    // or to the output text
    const segment = segments[idx];
    // logger.debug(`Token: '${segment}' (${ctx.fCmd})`);
    if (ctx.fCmd) {
      ctx.cmd += segment;
    } else if (!isLoopExploring(ctx)) {
      outText += segment;
    }
    appendTextToTagBuffers(segment, ctx, { fCmd: ctx.fCmd });

    // If there are more segments, execute the command (if we are in "command mode"),
    // and toggle "command mode"
    if (idx < segments.length - 1) {
      if (ctx.fCmd) {
        const cmdResultText = await onCommand(data, node, ctx);
        if (cmdResultText != null) {
          if (typeof cmdResultText === 'string') {
            outText += cmdResultText;
            appendTextToTagBuffers(cmdResultText, ctx, {
              fCmd: false,
              fInsertedText: true,
            });
          } else {
            if (failFast) throw cmdResultText;
            errors.push(cmdResultText);
          }
        }
      }
      ctx.fCmd = !ctx.fCmd;
    }
  }
  if (errors.length) {
    return errors;
  }
  return outText;
}

export function findHighestImgId(mainDoc) {
  const doc_ids = [];
  const search = (n) => {
    for (const c of n._children) {
      const tag = c._fTextNode ? null : c._tag;
      if (tag == null) continue;
      if (tag === 'wp:docPr') {
        if (c._fTextNode) continue;
        const raw = c._attrs.id;
        if (typeof raw !== 'string') continue;
        const id = Number.parseInt(raw, 10);
        if (Number.isSafeInteger(id)) doc_ids.push(id);
      }
      if (c._children.length > 0) search(c);
    }
  };
  search(mainDoc);
  if (doc_ids.length > 0) return Math.max(...doc_ids);
  return 0;
}