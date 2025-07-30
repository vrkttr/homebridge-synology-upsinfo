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
    this.username = config.username;
    this.password = config.password;
    this.command = config.command || 'upsc ups@localhost';
    this.pollInterval = config.pollInterval || 60;
    this.includeLoadSensor = config.includeLoadSensor || false;

    this.charge = 100;
    this.runtime = 0;
    this.load = 0;

    this.ssh = new NodeSSH();

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
      this.loadService = new Service.LightSensor(`${this.name} Load`);
      this.loadService
        .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .onGet(() => Math.max(0.0001, this.load));
    }

    this.updateLoop();
  }

  async updateLoop() {
    try {
    await ssh.connect({
      host: this.host,
      port: this.port || 22,
      username: this.username,
      password: this.password
    });

      const result = await this.ssh.execCommand(this.command);
      if (result.stdout) {
        const lines = result.stdout.split('\n');
        lines.forEach(line => {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key === 'battery.charge') this.charge = parseInt(value);
          if (key === 'battery.runtime') this.runtime = parseInt(value);
          if (key === 'ups.load') this.load = parseFloat(value);
        });

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
            Characteristic.CurrentAmbientLightLevel,
            Math.max(0.0001, this.load)
          );
        }
      }
    } catch (err) {
      this.log.error('SSH or parsing error:', err.message);
    }

    setTimeout(() => this.updateLoop(), this.pollInterval * 1000);
  }

  getServices() {
    const services = [this.batteryService];
    if (this.includeLoadSensor && this.loadService) {
      services.push(this.loadService);
    }
    return services;
  }
}
