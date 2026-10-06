'use strict';

const BOM_ITEMS = Object.freeze([
  Object.freeze({
    id: 'stepper-motor-nema17',
    name: 'NEMA 17 Stepper Motor',
    specification: 'NEMA 17 Bipolar Stepper Motor 1.8 deg 40mm 1.5A',
    quantity: 2,
    suppliers: Object.freeze([
      'OpenBuilds',
      'Pololu',
      'LDO Motors',
    ]),
  }),
  Object.freeze({
    id: 'mcu-board-rp2040',
    name: 'RP2040 Microcontroller Board',
    specification: 'RP2040 32-bit Dual ARM Cortex-M0+ Development Board with USB-C',
    quantity: 1,
    suppliers: Object.freeze([
      'Raspberry Pi Foundation',
      'Waveshare',
      'Adafruit Industries',
    ]),
  }),
  Object.freeze({
    id: 'stepper-driver-tmc2209',
    name: 'TMC2209 Stepper Driver',
    specification: 'TMC2209 Ultra-silent Stepper Motor Driver Module with Heat Sink',
    quantity: 2,
    suppliers: Object.freeze([
      'BigTreeTech',
      'Watterott electronic',
      'Makerbase',
    ]),
  }),
  Object.freeze({
    id: 'aluminum-extrusion-2020',
    name: '2020 Aluminum Extrusion',
    specification: '2020 V-Slot Aluminum Extrusion Profile 500mm Clear Anodized',
    quantity: 4,
    suppliers: Object.freeze([
      'OpenBuilds',
      'Rat Rig',
      'Misumi',
    ]),
  }),
  Object.freeze({
    id: 'power-supply-12v',
    name: '12V 5A DC Power Supply',
    specification: '12V 5A 60W Regulated DC Switching Power Supply Adapter 5.5x2.1mm',
    quantity: 1,
    suppliers: Object.freeze([
      'Mean Well',
      'CUI Inc',
      'Generic OSH Certified Supplier',
    ]),
  }),
  Object.freeze({
    id: 'optical-endstop-tcst2103',
    name: 'Optical Endstop Switch',
    specification: 'TCST2103 / TCST2000 Transmissive Optical Sensor Endstop Module',
    quantity: 2,
    suppliers: Object.freeze([
      'RobotDyn',
      'Makerbase',
      'Generic RepRap Supplier',
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
