/* eslint-disable no-console */
const { runExportFeedback } = require('./export_feedback');

module.exports = function (callback) {
  console.warn('export_metrics.js is deprecated. Use export_feedback.js instead.');
  runExportFeedback()
    .then(() => callback())
    .catch((err) => callback(err));
};

module.exports.runExportFeedback = runExportFeedback;
