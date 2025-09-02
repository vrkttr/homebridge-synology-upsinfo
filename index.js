const { NodeSSH } = require('node-ssh');

let Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory(
    'homebridge-synology-upsinfo',
    'SynologyUPSInfo',
    SynologyUPSInfo
  );
};

class SynologyUPSInfo {
  constructor(log, config) {
    this.log = log;
    this.name = config.name || 'Synology UPS';
    this.host = config.host;
    this.port = config.port || 22;
    this.username = config.username;
    this.password = config.password;
    this.command = config.command || 'upsc ups@localhost';
    this.pollInterval = Math.max(1, config.pollInterval || 60);
    this.includeLoadSensor = config.includeLoadSensor || false;
    this.readyTimeout = config.readyTimeout || 5000;

    this.charge = 100;
    this.runtime = 0;
    this.load = 0;

    this.batteryService = new Service.Battery(this.name);

    this.batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
      .onGet(() => this.charge);

    this.batteryService
      .getCharacteristic(Characteristic.StatusLowBattery)
      .onGet(() => (this.charge < 20 ? 1 : 0));

    this.batteryService
      .getCharacteristic(Characteristic.ChargingState)
      .onGet(() => 0);

    if (this.includeLoadSensor) {
      this.loadService = new Service.HumiditySensor('UPS Load');
      this.loadService
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .onGet(() => Math.max(0.0001, this.load));
    }

    this.updateLoop();
  }

  async updateLoop() {
    let ssh = null;
    try {
      ssh = new NodeSSH();
      await ssh.connect({
        host: this.host,
        port: this.port,
        username: this.username,
        password: this.password,
        readyTimeout: this.readyTimeout
      });

      const result = await ssh.execCommand(this.command);

      if (result.stderr && !result.stdout) {
        this.log.warn('UPS command stderr:', result.stderr.trim());
      }

      if (result.stdout) {
        const lines = result.stdout.split('\n');
        for (const raw of lines) {
          const line = raw.trim();
          if (!line || !line.includes(':')) continue;
          const [k, vRaw] = line.split(':');
          const key = k.trim();
          const value = vRaw.trim();

          if (key === 'battery.charge') {
            const num = parseInt(value, 10);
            if (!Number.isNaN(num)) this.charge = num;
          }
          if (key === 'battery.runtime') {
            const num = parseInt(value, 10);
            if (!Number.isNaN(num)) this.runtime = num;
          }
          if (key === 'ups.load') {
            const num = parseFloat(value);
            if (!Number.isNaN(num)) this.load = num;
          }
        }

        this.batteryService.updateCharacteristic(
          Characteristic.BatteryLevel,
          this.charge
        );

        this.batteryService.updateCharacteristic(
          Characteristic.StatusLowBattery,
          this.charge < 20 ? 1 : 0
        );

        if (this.includeLoadSensor && this.loadService) {
          this.loadService.updateCharacteristic(
            Characteristic.CurrentRelativeHumidity,
            Math.max(0.0001, this.load)
          );
        }
      }
    } catch (err) {
      this.log.error('SSH or parsing error:', err?.message || String(err));
    } finally {
      if (ssh) {
        try {
          ssh.dispose();
        } catch (e) {
        }
      }
      setTimeout(() => this.updateLoop(), this.pollInterval * 1000);
    }
  }

  getServices() {
    const services = [this.batteryService];
    if (this.includeLoadSensor && this.loadService) {
      services.push(this.loadService);
    }
    return services;
  }
}
