const Model = require('../Model');

const SystemConfig = new Model('system_config', {});

SystemConfig.isSetupComplete = async function() {
    const cfg = this.findOne();
    return cfg && cfg.setupComplete;
};

module.exports = SystemConfig;
