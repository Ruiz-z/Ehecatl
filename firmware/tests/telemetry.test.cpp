#include "../ehecatl-esp32/telemetry.h"
#include <cassert>
#include <iostream>
#include <limits>
#include <string>

const char* id = "00112233-4455-4677-8899-aabbccddeeff";
const char* date = "2026-11-15T12:30:00Z";

std::string reading(int soil, int gas, float temperature, float humidity) {
  char output[384]{};
  const size_t size = ehecatl::encodeReading(output, sizeof(output), id, date, soil, gas, temperature, humidity);
  assert(size > 0 && size < 384);
  return output;
}

int main() {
  using namespace ehecatl;
  const float nan = std::numeric_limits<float>::quiet_NaN();
  const float inf = std::numeric_limits<float>::infinity();
  uint8_t bytes[] = {0x00,0x11,0x22,0x33,0x44,0x55,0xff,0x77,0xff,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff};
  char uuid[37]; uuidV4(bytes, uuid);
  assert(std::strcmp(uuid, "00112233-4455-4f77-bf99-aabbccddeeff") == 0);

  const auto complete = reading(1800, 300, 24.5f, 60);
  assert(complete.find("\"soilMoistureRaw\":1800") != std::string::npos);
  assert(complete.find("\"airTemperature\":24.5") != std::string::npos);
  assert(complete.find("\"airHumidity\":60.0") != std::string::npos);
  const auto noAir = reading(0, 4095, nan, inf);
  assert(noAir.find("airTemperature") == std::string::npos && noAir.find("airHumidity") == std::string::npos);
  assert(reading(4095, 0, 81, 101).find("airTemperature") == std::string::npos);
  assert(reading(1800, 300, nan, 100).find("\"airHumidity\":100.0") != std::string::npos);
  assert(reading(1800, 300, -50, nan).find("\"airTemperature\":-50.0") != std::string::npos);
  char small[20];
  assert(encodeReading(small, sizeof(small), id, date, 0, 0, 20, 50) == 0);
  assert(encodeReading(small, sizeof(small), id, date, -1, 0, 20, 50) == 0);
  assert(encodeReading(small, sizeof(small), id, date, 0, 4096, 20, 50) == 0);

  for (int code : {-11, -1, 408, 425, 429, 500, 503}) assert(delivery(code) == Delivery::retry);
  for (int code : {201, 204, 301, 307, 400, 404, 409, 413}) assert(delivery(code) == Delivery::rejected);
  assert(delivery(200) == Delivery::accepted);
  assert(delivery(401) == Delivery::unauthorized && delivery(403) == Delivery::unauthorized);
  assert(retryDelay(0) == 5000 && retryDelay(1) == 10000 && retryDelay(3) == 40000);
  assert(retryDelay(4) == 60000 && retryDelay(255) == 60000);
  assert(elapsed(20, UINT32_MAX - 29, 50));
  assert(!elapsed(19, UINT32_MAX - 29, 50));

  Button button;
  assert(!button.pressed(true, 100));
  assert(!button.pressed(false, 110)); // rebote
  assert(!button.pressed(true, 120));
  assert(!button.pressed(true, 159));
  assert(button.pressed(true, 160));
  assert(!button.pressed(true, 5000)); // mantener pulsado no vuelve a alternar
  assert(!button.pressed(false, 5010));
  assert(!button.pressed(false, 5050));
  assert(!button.pressed(true, 5100));
  assert(button.pressed(true, 5140));

  for (const char* url : {"http://192.168.1.100:3001", "http://10.0.0.2", "http://172.16.0.1:80", "http://172.31.255.255"}) assert(privateHttpUrl(url));
  for (const char* url : {"http://8.8.8.8", "http://172.32.0.1", "http://localhost:3001", "http://192.168.1.300", "http://192.168.1.1:0", "http://192.168.1.1:65536", "http://192.168.1.1@public.test", "http://192.168.1.1/readings", "https://192.168.1.1"}) assert(!privateHttpUrl(url));
  for (const char* url : {"http://4294967306.0.0.1", "http://010.0.0.1", "http://+10.0.0.1", "http://10.0.0.1:999999999999999999999", "http://10.0"}) assert(!privateHttpUrl(url));

  // Esta salida se compara con el fixture consumido por las pruebas de la API.
  std::cout << "[" << complete << "," << noAir << ","
            << reading(1800, 300, nan, 100) << "," << reading(1800, 300, -50, nan) << "]\n";
  std::cerr << "Firmware: UUID, JSON, DHT ausente, ADC, HTTP, reintentos, boton, rollover y LAN correctos.\n";
}
