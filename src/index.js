import createReport from './main';
import { setDebugLogSink } from './debug';

setDebugLogSink(console.log);

export { createReport };
export default createReport;

