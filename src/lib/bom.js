'use strict';

const BOM_ITEMS = [
  {
    id: 'stepper-motor-nema17',
    name: 'NEMA 17 Stepper Motor',
    specification: 'NEMA 17 Bipolar Stepper Motor 1.8 deg 40mm 1.5A',
    quantity: 2,
    suppliers: [
      'OpenBuilds',
      'Pololu',
      'LDO Motors'
    ]
  },
  {
    id: 'mcu-board-rp2040',
    name: 'RP2040 Microcontroller Board',
    specification: 'RP2040 32-bit Dual ARM Cortex-M0+ Development Board with USB-C',
    quantity: 1,
    suppliers: [
      'Raspberry Pi Foundation',
      'Waveshare',
      'Adafruit Industries'
    ]
  },
  {
    id: 'stepper-driver-tmc2209',
    name: 'TMC2209 Stepper Driver',
    specification: 'TMC2209 Ultra-silent Stepper Motor Driver Module with Heat Sink',
    quantity: 2,
    suppliers: [
      'BigTreeTech',
      'Watterott electronic',
      'Makerbase'
    ]
  },
  {
    id: 'aluminum-extrusion-2020',
    name: '2020 Aluminum Extrusion',
    specification: '2020 V-Slot Aluminum Extrusion Profile 500mm Clear Anodized',
    quantity: 4,
    suppliers: [
      'OpenBuilds',
      'Rat Rig',
      'Misumi'
    ]
  },
  {
    id: 'power-supply-12v',
    name: '12V 5A DC Power Supply',
    specification: '12V 5A 60W Regulated DC Switching Power Supply Adapter 5.5x2.1mm',
    quantity: 1,
    suppliers: [
      'Mean Well',
      'CUI Inc',
      'Generic OSH Certified Supplier'
    ]
  },
  {
    id: 'optical-endstop-tcst2103',
    name: 'Optical Endstop Switch',
    specification: 'TCST2103 / TCST2000 Transmissive Optical Sensor Endstop Module',
    quantity: 2,
    suppliers: [
      'RobotDyn',
      'Makerbase',
      'Generic RepRap Supplier'
    ]
  }
];

function getBomItems() {
  return BOM_ITEMS.map(item => ({
    id: item.id,
    name: item.name,
    specification: item.specification,
    genericSpecification: item.specification,
    spec: item.specification,
    quantity: item.quantity,
    qty: item.quantity,
    suppliers: [...item.suppliers],
    alternativeSuppliers: [...item.suppliers],
    alternatives: [...item.suppliers]
  }));
}

getBomItems.getBomItems = getBomItems;
getBomItems.BOM_ITEMS = BOM_ITEMS;

module.exports = getBomItems;
module.exports.getBomItems = getBomItems;
module.exports.BOM_ITEMS = BOM_ITEMS;
