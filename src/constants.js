export const CONTENT_TYPES_PATH = '[Content_Types].xml';
export const TEMPLATE_PATH = 'word';
export const DEFAULT_LITERAL_XML_DELIMITER = '||';
export const DEFAULT_CMD_DELIMITER = '+++';
export const BUILT_IN_COMMANDS = [
  'QUERY',
  'CMD_NODE',
  'ALIAS',
  'FOR',
  'END-FOR',
  'IF',
  'END-IF',
  'INS',
  'EXEC',
  'IMAGE',
  'LINK',
  'HTML',
];
export const XML_FILE_REGEX = new RegExp(`${TEMPLATE_PATH}\\/[^\\/]+\\.xml`);