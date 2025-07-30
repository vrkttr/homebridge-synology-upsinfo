# homebridge-synology-upsinfo

A simple Homebridge plugin to fetch UPS information from a Synology NAS via SSH.

## Features

- Exposes battery charge as a Battery service
- Exposes estimated runtime (battery.runtime)
- Optional: exposes UPS load as a LightSensor service
- Polls data periodically via SSH from Synology's `upsc` output

## Installation

```bash
sudo npm install -g homebridge-synology-upsinfo
```

## Configuration

Add this to your Homebridge `config.json`:

```json
{
  "accessories": [
    {
      "accessory": "SynologyUPSInfo",
      "name": "Synology UPS",
      "host": "your_synology_ip",
      "port": 22,
      "username": "your_ssh_user",
      "password": "your_ssh_password",
      "command": "upsc ups@localhost",
      "pollInterval": 60,
      "includeLoadSensor": true
    }
  ]
}

```

## Notes

- Requires SSH access to your Synology NAS.
- `upsc` must be installed and return values like `battery.charge`, `battery.runtime`, and optionally `ups.load`.

## License

MIT

---

Developed by David Vierkötter
