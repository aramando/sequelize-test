const router = require('express').Router();
const controller = require('../controllers/images');
const handleError = require('../lib/asyncErrorHandler');

router.get('/', handleError(controller.index));
router.get('/:id', handleError(controller.read));
router.put('/:id', handleError(controller.update));
router.delete('/:id', handleError(controller.destroy));

// tags
router.put('/:id/tag/:tagId', handleError(controller.addTag));
router.delete('/:id/tag/:tagId', handleError(controller.removeTag));

module.exports = router;
