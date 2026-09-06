# ESP8266 IoT 6 Relay

## Pins
D0, D1, D2, D5, D6, D7

## Before upload
Open `ESP8266_IOT_6Relay.ino` and change:
- `WIFI_SSID`
- `WIFI_PASSWORD`
- `DEVICE_TOKEN`

Server:
`https://iot-flame-chi.vercel.app`

This sketch does NOT require ArduinoJson.

If the relay works in reverse, change:
`RELAY_ON LOW` to `RELAY_ON HIGH`
and
`RELAY_OFF HIGH` to `RELAY_OFF LOW`.

Open Serial Monitor at 115200 baud.
