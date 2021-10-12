import { getNextSibling, getCurLoop, logLoop, isLoopExploring } from './reportUtils';
import { runUserJsAndGetRaw } from './jsSandbox';
import { logger } from './debug';
import { BUILT_IN_COMMANDS } from './constants';

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

const processText = async (data, node, ctx, onCommand) => {
  const { cmdDelimiter, failFast } = ctx.options;
  const text = node._text;
  if (text == null || text === '') return '';
  const segments = text
    .split(cmdDelimiter[0])
    .map(s => s.split(cmdDelimiter[1]))
    .reduce((x, y) => x.concat(y));
  let outText = '';
  const errors = [];
  for (let idx = 0; idx < segments.length; idx++) {
    // Include the separators in the `buffers` field (used for deleting paragraphs if appropriate)
    if (idx > 0) appendTextToTagBuffers(cmdDelimiter[0], ctx, { fCmd: true });

    // Append segment either to the `ctx.cmd` buffer (to be executed), if we are in "command mode",
    // or to the output text
    const segment = segments[idx];
    // logger.debug(`Token: '${segment}' (${ctx.fCmd})`);
    if (ctx.fCmd) ctx.cmd += segment;
    else if (!isLoopExploring(ctx)) outText += segment;
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
  if (errors.length > 0) return errors;
  return outText;
};

const processForIf = async(data, node, ctx, cmd, cmdName, cmdRest) => {
  const isIF = cmdName === 'IF';
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
  //TODO
  // walk the template
}