import { zipLoad, zipGetText } from './zip';
import { logger } from './debug';


import { CONTENT_TYPES_PATH, TEMPLETE_PATH } from './constants';
import { parseXml } from './xml';

async function parsePath(zip, xml_path) {
    const xmlFile = await zipGetText(zip, xml_path);
    if (xmlFile === null) {
        throw console.error(`${xml_path} could not be read`);
    }
    const node = await parseXml(xmlFile);
    if (node._fTextNode) {
        throw console.error(`${xml_path} is a text node when parsed`);
    }
    return node;
}

async function readContentTypes(zip) {
    return await parsePath(zip, CONTENT_TYPES_PATH);
}

function getMainDoc(contentTypes) {
    const MAIN_DOC_MIMES = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
        'application/vnd.ms-word.document.macroEnabled.main+xml',
    ];
    for (const t of contentTypes._children) {
        if (!t._fTextNode) {
            if (
                t._attrs.ContentType !== null && MAIN_DOC_MIMES.includes(t._attrs.ContentType)
            ) {
                const path = t._attrs.PartName;
                if (path) {
                    return path.replace('/word/', '');
                }
            }
        }
    }
    throw console.error(
        `Could not find main document (e.g. document.ml) in ${CONTENT_TYPES_PATH}`
    );
}

async function parseTemplate(template) {
    logger.debug('**** START PARSE TEMPLETE ****');
    logger.debug('Unzipping...');
    const zip = await zipLoad(template);

    logger.debug('finding main template file ...');
    //The main template file is document.xml file
    //Office 365 files may name the main template file as document2.xml or something else
    //So we'll have to parse the content-types 'manifest' file first and retrieve the template file's name first.
    const contentTypes = await readContentTypes(zip);
    const mainDocument = getMainDoc(contentTypes);

    logger.debug('Reading Template file...')
    const templateXml = await zipGetText(zip, `${TEMPLETE_PATH}/${mainDocument}`);
    if (templateXml === null) {
        throw console.error(`${mainDocument} could not be found`);
    }
    logger.debug(`Template file length: ${templateXml.length}`);
    logger.debug('Parsing XML ....');
    console.time('xmlParse');
    const parseResult = await parseXml(templateXml);
    const jsTemplate = parseResult;
    console.timeEnd('xmlParse');
    logger.debug(`File parsed in ${console.timeLog('xmlParse')} ms`, {
        attach: jsTemplate,
        attachLevel: 'trace'
    });
    logger.debug('**** END PARSE TEMPLETE ****');

    return {
        jsTemplate,
        mainDocument,
        zip,
        contentTypes
    };
}

async function createReport (options) {
    logger.debug('Create Report...');
    const { data, template, queryVars} = options;
    const literalXmlDelimiter = options.literalXmlDelimiter || DEFAULT_LITERAL_XML_DELIMITER;
    const createOptions = {
        literalXmlDelimiter,
        processLineBreaks: options.processLineBreaks !== null ? options.processLineBreaks : true,
    }
    const { jsTemplate, mainDocument, zip, contentTypes } = await parseTemplate(
        template
    );

    let queryResult = null;
    if  (typeof data === 'function') {
        logger.debug('Looking for the query in the template');
        const query = await extractQuery(prepped_template, createOptions);
        logger.debug(`Query: ${query || 'no query found'}`);
        queryResult = await data(query, queryVars);
    } else {
        queryResult = data;
    }
    logger.debug(`check parsed data => ${data}`)
}

export default createReport;