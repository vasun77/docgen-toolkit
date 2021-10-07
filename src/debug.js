
export const logger = { debug: () => {}};

export function setDebugLogSink(f) {
    logger.debug = f;
}