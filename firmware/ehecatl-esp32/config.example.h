#pragma once

// Copiar a config.h (ignorado por Git). No reutilizar claves de SmartRiego.
#define EHECATL_WIFI_SSID ""
#define EHECATL_WIFI_PASSWORD ""
#define EHECATL_DEVICE_API_KEY ""

// IP LAN de la computadora que ejecuta Ehécatl; sin /readings ni barra final.
#define EHECATL_API_BASE_URL "http://192.168.1.100:3001"
// Activar únicamente para la prueba en la misma red privada.
#define EHECATL_ALLOW_PRIVATE_HTTP false
// Para HTTPS, pegar aquí el certificado raíz PEM correspondiente al servidor.
#define EHECATL_ROOT_CA ""

#define EHECATL_SEND_INTERVAL_SECONDS 300
#define EHECATL_NTP_SERVER_1 "pool.ntp.org"
#define EHECATL_NTP_SERVER_2 "time.cloudflare.com"

// Pines del montaje recibido: ESP32 clásico. Confirmar para otras placas.
#define EHECATL_DHT_PIN 27
#define EHECATL_SOIL_PIN 35
#define EHECATL_MQ2_PIN 33
#define EHECATL_BUTTON_PIN 12
#define EHECATL_UNUSED_PUMP_PIN 18
