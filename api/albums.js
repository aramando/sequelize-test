const router = require('express').Router();
const handleError = require('../lib/asyncErrorHandler');
const controller = require('../controllers/albums');

router.get('/', handleError(controller.index));
router.get('/root', handleError(controller.indexRoot));
router.get('/update', handleError(controller.syncRoot));

router.get('/:id', handleError(controller.read));
router.put('/:id', handleError(controller.update));
router.delete('/:id', handleError(controller.destroy));

router.get('/:id/update', handleError(controller.syncAlbum));
router.get('/:id/albums', handleError(controller.listAlbums));
router.get('/:id/images', handleError(controller.listImages));

router.post('/:id/albums/rename', handleError(controller.renameAlbums));
router.post('/:id/albums/move', handleError(controller.moveAlbums));
router.post('/:id/images/rename', handleError(controller.renameImages));
router.post('/:id/images/move', handleError(controller.moveImages));
// router.get('/:id/contents', handleError(controller.listContents));

// other images
router.post('/:id/images/:imageId', handleError(controller.addImage));
router.delete('/:id/images/:imageId', handleError(controller.removeImage));

// tags
router.put('/:id/tag/:tagId', handleError(controller.addTag));
router.delete('/:id/tag/:tagId', handleError(controller.removeTag));

router.post('/:id/related/:relatedId/:relationType', handleError(controller.addRelatedAlbum));

module.exports = router;
