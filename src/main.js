import { logger } from './debug';

async function createReport (options) {
    logger.debug('Create Report...');
    const { data, template} = options;
    const { jsTemplate, mainDocument, zip, contentTypes } = await parseTemplate(
        template
    );

    let queryResult = null;
    if (typeof data === 'function') {
        logger.debug('Looking for the query in the template...');
        //const query = await extractQuery(prepped_template, createOptions);
        logger.debug(`Query: ${query || 'no query found'}`);
    }
}

export default createReport;