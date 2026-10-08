const express = require('express');
const ctrl = require('../controllers/voitures.controller');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

router.get('/', asyncHandler(ctrl.lister));
router.get('/stats', asyncHandler(ctrl.stats)); // avant /:id
router.post('/', asyncHandler(ctrl.creer));
router.get('/:id', asyncHandler(ctrl.lire));
router.put('/:id', asyncHandler(ctrl.remplacer));
router.patch('/:id', asyncHandler(ctrl.modifier));
router.delete('/:id', asyncHandler(ctrl.supprimer));

module.exports = router;
