const fs = require('fs');
const path = require('path');

let configPath = null;
let config = null;

const DEFAULT_CONFIG = {
  geminiApiKey: '',
  geminiModel: 'gemini-flash-latest',
};

function init(userDataPath) {
  configPath = path.join(userDataPath, 'config.json');
  if (fs.existsSync(configPath)) {
    config = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
  } else {
    config = { ...DEFAULT_CONFIG };
    save();
  }
}

function save() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function get() {
  return config;
}

function setApiKey(key) {
  config.geminiApiKey = key.trim();
  save();
}

function hasApiKey() {
  return !!(config.geminiApiKey && config.geminiApiKey.length > 0);
}

module.exports = { init, get, setApiKey, hasApiKey };
