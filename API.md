# ESP8266 IoT Device / Relay API

Base URL:
`https://iot-flame-chi.vercel.app`

## 1. User authentication

All dashboard/device-management requests use:
`Authorization: Bearer <JWT>`

## 2. Create ESP device

`POST /api/devices`

Body:
```json
{"name":"My ESP8266"}
```

Response contains:
- `device.deviceId` -> ESP device ID
- `device.token` -> ESP device token
- `device.pins` -> D0, D1, D2, D5, D6, D7

## 3. List devices

`GET /api/devices`

## 4. Get one device

`GET /api/devices/ESP-XXXXXXXX`

## 5. Turn one relay ON/OFF

`PUT /api/devices/ESP-XXXXXXXX/pin/D0`

Body:
```json
{"state":true}
```

OFF:
```json
{"state":false}
```

Supported pins:
`D0, D1, D2, D5, D6, D7`

## 6. Toggle one relay

`POST /api/devices/ESP-XXXXXXXX/pin/D0/toggle`

## 7. Set multiple relays

`PUT /api/devices/ESP-XXXXXXXX/pins`

Body:
```json
{
  "pins": [
    {"pin":"D0","state":true},
    {"pin":"D1","state":false},
    {"pin":"D2","state":true}
  ]
}
```

## 8. ESP8266 reads relay commands

`GET /api/devices/device/commands`

Header:
`X-Device-Token: <DEVICE_TOKEN>`

Response:
```json
{
  "success": true,
  "deviceId": "ESP-XXXXXXXX",
  "status": "online",
  "pins": [
    {"pin":"D0","state":true},
    {"pin":"D1","state":false},
    {"pin":"D2","state":false},
    {"pin":"D5","state":false},
    {"pin":"D6","state":false},
    {"pin":"D7","state":false}
  ]
}
```

ESP should poll this endpoint every 1-3 seconds and write the returned states to the physical relays.

## 9. ESP8266 heartbeat

`POST /api/devices/device/heartbeat`

Header:
`X-Device-Token: <DEVICE_TOKEN>`

Body:
```json
{
  "pins": [
    {"pin":"D0","state":true},
    {"pin":"D1","state":false}
  ]
}
```

This marks the device online and updates the server with the ESP's actual relay states.

## 10. ESP device status

`GET /api/devices/device/status`

Header:
`X-Device-Token: <DEVICE_TOKEN>`

## Health check

`GET /api/health`
