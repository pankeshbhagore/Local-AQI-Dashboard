'use strict';
const Joi = require('joi');

const schemas = {
  login: Joi.object({
    email:    Joi.string().email().required(),
    password: Joi.string().min(1).required(),
  }),

  register: Joi.object({
    email:    Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name:     Joi.string().max(100).optional().allow(''),
    phone:    Joi.string().max(20).optional().allow(''),
    role:     Joi.string().valid('admin','officer','citizen','superuser').optional(),
    wardId:   Joi.alternatives().try(
      Joi.number().integer().min(1),
      Joi.string().regex(/^\d+$/)
    ).optional().allow(null,''),
  }),

  submitReport: Joi.object({
    wardId:        Joi.alternatives().try(Joi.number(), Joi.string()).required(),
    pollutionType: Joi.string().valid('garbage_burning','construction_dust','vehicle_smoke','industrial_emission','dust_storm','other').required(),
    severity:      Joi.string().valid('low','medium','high','emergency').optional().allow(''),
    description:   Joi.string().max(1000).optional().allow(''),
    lat:           Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(''),
    lng:           Joi.alternatives().try(Joi.number(), Joi.string()).optional().allow(''),
    address:       Joi.string().max(200).optional().allow(''),
  }),

  manualAlert: Joi.object({
    wardId:          Joi.number().integer().optional().allow(null),
    wardName:        Joi.string().max(100).optional().allow(''),
    message:         Joi.string().max(500).required(),
    severity:        Joi.string().valid('moderate','high','critical').required(),
    recommendations: Joi.array().items(Joi.string()).optional(),
  }),
};

function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next();
    const { error, value } = schema.validate(req.body, {
      abortEarly:   false,
      stripUnknown: true,
      convert:      true,
    });
    if (error) {
      return res.status(422).json({
        error:   'Validation failed',
        details: error.details.map(d => ({ field: d.path.join('.'), message: d.message.replace(/['"]/g,'') })),
      });
    }
    req.body = value;
    next();
  };
}

module.exports = { validate, schemas };
