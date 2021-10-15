import { zipLoad, zipGetText } from './zip';
import { logger } from './debug';
import { extractQuery, produceJsReport, findHighestImgId, newContext } from './processTemplate';


import { 
    CONTENT_TYPES_PATH, 
    TEMPLATE_PATH, 
    DEFAULT_LITERAL_XML_DELIMITER, 
    DEFAULT_CMD_DELIMITER,
    XML_FILE_REGEX
 } from './constants';
import { parseXml, buildXml } from './xml';
import preprocessTemplate from './preprocessTemplate';

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
    logger.debug('**** START PARSE TEMPLATE ****');
    logger.debug('Unzipping...');
    const zip = await zipLoad(template);

    logger.debug('finding main template file ...');
    //The main template file is document.xml file
    //Office 365 files may name the main template file as document2.xml or something else
    //So we'll have to parse the content-types 'manifest' file first and retrieve the template file's name first.
    const contentTypes = await readContentTypes(zip);
    const mainDocument = getMainDoc(contentTypes);

    logger.debug('Reading Template file...')
    const templateXml = await zipGetText(zip, `${TEMPLATE_PATH}/${mainDocument}`);
    if (templateXml === null) {
        throw console.error(`${mainDocument} could not be found`);
    }
    logger.debug(`Template file length: ${templateXml.length}`);
    logger.debug('Parsing XML ....');
    console.time('xmlParse');
    const parseResult = await parseXml(templateXml);
    const jsTemplate = parseResult;
    logger.debug(`File parsed in ${console.timeEnd('xmlParse')} ms`, {
        attach: jsTemplate,
        attachLevel: 'trace'
    });
    logger.debug('**** END PARSE TEMPLATE ****');

    return {
        jsTemplate,
        mainDocument,
        zip,
        contentTypes
    };
}

async function createReport (options,_probe) {
    logger.debug('Create Report...');
    const { data, template, queryVars} = options;
    const literalXmlDelimiter = options.literalXmlDelimiter || DEFAULT_LITERAL_XML_DELIMITER;
    const createOptions = {
        literalXmlDelimiter,
        processLineBreaks: options.processLineBreaks !== null ? options.processLineBreaks : true,
        cmdDelimiter: getCmdDelimiter(options.cmdDelimiter),
        noSandox: options.noSandox || false,
        runJs: options.runJs,
        additionalJsContext: options.additionalJsContext || {},
        failFast: options.failFast == null ? true : options.failFast,
        rejectNullish: options.rejectNullish == null ? false : options.rejectNullish,
        errorHandler: typeof options.errorHandler === 'function' ? options.errorHandler : null,
        fixSmartQuotes: options.fixSmartQuotes == null ? false : options.fixSmartQuotes,
    };
    const xmlOptions = { literalXmlDelimiter };
    const { jsTemplate, mainDocument, zip, contentTypes } = await parseTemplate(
        template
    );

    logger.debug('Preprocessing template...');
    const prepped_template = preprocessTemplate(
        jsTemplate,
        createOptions.cmdDelimiter
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
    logger.debug(`check parsed data => ${JSON.stringify(queryResult)}`)

    const prepped_secondaries = await prepSecondaryXMLs(
        zip,
        mainDocument,
        createOptions
    );

    // Find the highest image IDs by scanning the main document and all secondary XMLs.
    const highest_img_id = Math.max(
        ...prepped_secondaries.map(([s, _]) => findHighestImgId(s)),
        findHighestImgId(prepped_template)
    );

    // Process document.xml:
    // - Generate the report
    // - Build output XML and write it to disk
    // - Images
    logger.debug('Generating report...');
    let ctx = newContext(createOptions, highest_img_id);
    const result = await produceJsReport(queryResult, prepped_template, ctx);
    if (result.status === 'errors') {
        throw result.errors;
    }
    const {
        report: report1,
        images: images1,
        links: links1,
        htmls: htmls1
    } = result;

    if (_probe === 'JS') {
        return report1;
    }

    logger.debug(`Converting report to XML....`)
    const reportXml = buildXml(report1, xmlOptions);
    if (_probe === 'XML') {
        return reportXml;
    }

}


async function prepSecondaryXMLs(zip, main_doc_path, options) {
    // Find all non-main XML files containing the headers, footers, etc.
    const secondary_xml_files = [];
    zip.forEach(async filePath => {
      if (
        XML_FILE_REGEX.test(filePath) &&
        filePath !== `${TEMPLATE_PATH}/${main_doc_path}` &&
        filePath.indexOf(`${TEMPLATE_PATH}/template`) !== 0
      ) {
        secondary_xml_files.push(filePath);
      }
    });
  
    const prepped_secondaries = [];
    for (const f of secondary_xml_files) {
      const raw = await zipGetText(zip, f);
      if (raw == null) throw new Error(`${f} could not be read`);
      const js0 = await parseXml(raw);
      const js = preprocessTemplate(js0, options.cmdDelimiter);
      prepped_secondaries.push([js, f]);
    }
    return prepped_secondaries;
  }

const getCmdDelimiter = (cmdDelimiter) => {
    if (!cmdDelimiter) {
        return [DEFAULT_CMD_DELIMITER, DEFAULT_CMD_DELIMITER];
    }
    if (typeof cmdDelimiter === 'string') {
        return [cmdDelimiter, cmdDelimiter]
    }
    return cmdDelimiter;
}

export default createReport;