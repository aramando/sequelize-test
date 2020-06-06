const router = require('express').Router();

const imagesRouter = require('./images');
const albumsRouter = require('./albums');

router.use('/images', imagesRouter);
router.use('/albums', albumsRouter);

module.exports = router;
