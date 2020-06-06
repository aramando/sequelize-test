const { Image, Tag } = require('../models');
const { getSearchQueryOpts } = require("../models/helpers");


// GET/images?path=path/to&albumId=1&order=-rating
const index = async (req, res) => {
  const opts = await getSearchQueryOpts(req.query, 'images', true);    
  console.dir(opts, {depth: 6});
  const { count: total, rows: images } = await Image.findAndCountAll(opts);
  res.json([images, total]);
};

const read = async (req, res) => {
  const image = await Image.findByPk(req.params.id);
  if (!image) return res.sendStatus(404);
  try {
    res.json(image);
  }
  catch (err) {
    console.error(err);
    res.status(400).send(err.message);
  }
};

const update = async (req, res) => {
  const image = await Image.findByPk(req.params.id);
  if (!image) return res.sendStatus(404);
  try {
    await image.update(req.body);
    res.status(200).json(image.toJSON());
  } catch (error) {
    console.error(error);    
    res.status(400).send(error.message);
  }
};

const destroy = async (req, res) => {
  const image = await Image.findByPk(req.params.id);
  if (!image) return res.sendStatus(404);
  try {
    await image.destroy();
    return res.sendStatus(204);
  } catch (error) {
    console.error(error);    
    res.status(400).send(error.message);
  }
};

const addTag = async (req, res) => {
  const [image, tag] = await Promise.all([
    Image.findByPk(req.params.id),
    Tag.findByPk(req.params.tagId)
  ]);
  if (!image || !tag) {
    return res.sendStatus(404);
  }
  await image.addTag(tag);
  res.sendStatus(204);
};

const removeTag = async (req, res) => {
  const [image, tag] = await Promise.all([
    Image.findByPk(req.params.id),
    Tag.findByPk(req.params.tagId)
  ]);
  await image.removeTag(tag);
  res.sendStatus(204);
};

module.exports = {
  index,
  read,
  update,
  destroy,
  addTag,
  removeTag
};
