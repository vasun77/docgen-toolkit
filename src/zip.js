import JSZip from 'jszip';
import {logger} from './debug';

const zipLoad = (inputFile) => JSZip.loadAsync(inputFile);

const zipGetText = (zip, filename) => {
  const file_in_zip = zip.file(filename);
  if (!file_in_zip) {
    return null;
  }
  return file_in_zip.async('text');

}

const zipSetText = (zip, filename, data) => {
  zip.file(filename, data);
}

const zipSave = (zip) =>
  zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  });

export {zipLoad, zipGetText, zipSetText, zipSave };