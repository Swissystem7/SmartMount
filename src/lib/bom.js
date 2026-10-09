'use strict';

// The electronics firmware/smart_mount.ino actually drives — the rows that
// spec/index.html tags as present in the firmware. Mechanics that are not
// designed yet (gearbox, VESA arm, self-locking actuator, endstops) are not
// parts list items; they are open problems, listed on the spec page.
const BOM_ITEMS = Object.freeze([
  Object.freeze({
    id: 'mcu-esp32-devkit',
    name: 'ESP32 DevKit',
    specification: 'ESP32-WROOM-32 DevKit, WiFi, I2C on GPIO 21/22, STEP/DIR on GPIO 18/19',
    quantity: 1,
    suppliers: Object.freeze([
      'Espressif',
      'DOIT',
      'AZ-Delivery',
      'Generic ESP32 Supplier',
    ]),
  }),
  Object.freeze({
    id: 'light-sensor-bh1750',
    name: 'BH1750 Ambient Light Sensor',
    specification: 'BH1750 I2C lux sensor module with ADDR pin (one at 0x23, one at 0x5C)',
    quantity: 2,
    suppliers: Object.freeze([
      'Adafruit Industries',
      'DFRobot',
      'Generic GY-302 Module Supplier',
    ]),
  }),
  Object.freeze({
    id: 'stepper-driver-a4988',
    name: 'A4988 / DRV8825 Stepper Driver',
    specification: 'A4988 or DRV8825 STEP/DIR stepper driver carrier (AccelStepper::DRIVER)',
    quantity: 1,
    suppliers: Object.freeze([
      'Pololu',
      'BigTreeTech',
      'Generic RepRap Supplier',
    ]),
  }),
  Object.freeze({
    id: 'stepper-motor-nema17',
    name: 'NEMA 17 Stepper Motor',
    specification: 'NEMA 17 bipolar stepper, 1.8 deg (200 steps/rev), 17HS4401-class 1.5 A',
    quantity: 1,
    suppliers: Object.freeze([
      'OpenBuilds',
      'Pololu',
      'LDO Motors',
    ]),
  }),
  Object.freeze({
    id: 'power-supply-12v',
    name: '12V DC Power Supply + 5V/3.3V Regulator',
    specification: '12V >=2A regulated DC supply for driver VMOT, plus a buck regulator for logic',
    quantity: 1,
    suppliers: Object.freeze([
      'Mean Well',
      'CUI Inc',
      'Generic OSH Certified Supplier',
    ]),
  }),
]);

function getBomItems() {
  return BOM_ITEMS.map((item) => ({
    id: item.id,
    name: item.name,
    specification: item.specification,
    quantity: item.quantity,
    suppliers: [...item.suppliers],
  }));
}

module.exports = getBomItems;
module.exports.getBomItems = getBomItems;
module.exports.BOM_ITEMS = BOM_ITEMS;
