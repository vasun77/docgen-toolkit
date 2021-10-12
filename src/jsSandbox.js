import vm from 'vm';
import { merge, omit } from 'timm';
import { getCurLoop } from './reportUtils';
import { logger } from './debug';

// Runs a user snippet in a sandbox, and returns the result.
// The snippet can return a Promise, which is then awaited.
// The sandbox is kept for the execution of snippets later on
// in the template. Sandboxing can also be disabled via
// ctx.options.noSandbox.
export async function runUserJsAndGetRaw(data, code, ctx) {
  // Retrieve the current JS sandbox contents (if any) and add
  // the code to be run, and a placeholder for the result,
  // as well as all data defined by the user
  const sandbox = merge(
    ctx.jsSandbox || {},
    {
      __code__: code,
      __result__: undefined,
    },
    data,
    ctx.options.additionalJsContext
  );

  // Add currently defined vars, including loop vars and the index
  // of the innermost loop
  const curLoop = getCurLoop(ctx);
  if (curLoop) sandbox.$idx = curLoop.idx;
  Object.keys(ctx.vars).forEach(varName => {
    sandbox[`$${varName}`] = ctx.vars[varName];
  });

  // Run the JS snippet and extract the result
  let context;
  let result;
  try {
    if (ctx.options.runJs) {
      const temp = ctx.options.runJs({ sandbox, ctx });
      context = temp.modifiedSandbox;
      result = await temp.result;
    } else if (ctx.options.noSandbox) {
      context = sandbox;
      const wrapper = new Function('with(this) { return eval(__code__); }');
      result = await wrapper.call(context);
    } else {
      const script = new vm.Script(
        `
      __result__ = eval(__code__);
      `,
        {}
      );
      context = vm.createContext(sandbox);
      script.runInContext(context);
      result = await context.__result__;
    }
  } catch (err) {
    const e = err instanceof Error ? err : new Error(`${err}`);
    if (ctx.options.errorHandler != null) {
      context = sandbox;
      result = await ctx.options.errorHandler(e, code);
    } else {
      throw new Error(e, code);
    }
  }

  if (ctx.options.rejectNullish && result == null) {
    const nerr = new Error(code);
    if (ctx.options.errorHandler != null) {
      result = await ctx.options.errorHandler(nerr, code);
    } else {
      throw nerr;
    }
  }

  // Save the sandbox for later use
  ctx.jsSandbox = omit(context, ['__code__', '__result__']);
  logger.debug('JS result', { attach: result });
  return result;
}