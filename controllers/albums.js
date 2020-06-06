const { NotFoundError } = require('../lib/errors');
const { Album, Image, Tag, sequelize } = require('../models');
const { getSearchQueryOpts } = require('../models/helpers');
const { intersection } = require('lodash');


const renameItems = async (itemType, albumId, matchPattern, replacePattern) => {
  if (!itemType.match(/^(Albums|Images)$/)) 
    throw new Error('itemType must be one of: Albums, Images');

  const album = await Album.findByPk(albumId);
  const items = await album[`get${itemType}`]();
  const newPaths = new Set();
  const propName = itemType === 'Albums' ? 'name' : 'filename';
  if (
    items.some(a => {
      const newPath = a[propName].replace(re, replace);
      if (newPaths.has(newPath)) return true;
      newPaths.add(newPath);
    })
  ) {
    throw new Error("Duplicate filenames created");
  }
  return Promise.all(items
    .filter(item => item[propName].replace(matchPattern, replacePattern) !== item[propName])
    .map(async item => item.update({ 
      [propName]: item[propName].replace(matchPattern, replacePattern) 
    })));
};

const moveItems = async (itemType, itemIds, sourceAlbumId, destinationAlbumId) => {
  if (itemType !== 'Images' && itemType !== 'Albums') throw new Error('Invalid itemType');
  const [source, destination] = await Promise.all([
    Album.findByPk(sourceAlbumId),
    Album.findByPk(destinationAlbumId)
  ]);

  const items = (itemType === 'Albums' ? Album : Image).findAll({ where: { id: itemIds }});
  const images = await destination.getImages();
  const albums = await destination.getAlbums();

  const destinationClashes = intersection(
    albums.map(a => a.name).concat(images.map(i => i.filename)), 
    items.map(i => i.filename || i.name
  ));
  
  if (destinationClashes.length > 0) {
    throw new Error("Destination filename collisions found"/*, { destinationClashes }*/);
  }

  const updates = { [itemType === 'Albums' ? 'parentId' : 'albumId']: destinationAlbumId };

  if (itemType === 'Albums') {
    updates.location = item.location.replace(new RegExp(`${source.name}$`), destination.name);
  }

  await Promise.all(items.map(item => item.update(updates)));
};

const read = async (req, res) => {
  const { id } = req.params;
  if (!id || !Number.isInteger(+id)) throw new Error('Invalid album ID');  
  
  let album = await Album
    .scope(['defaultScope', 'basic', 'context', 'related'])
    .findByPk(req.params.id);
  
  if (!album) {
    return res.sendStatus(404);
  }

  const { siblings = [], ...response } = album.toJSON();

  // get previous/next siblings
  // if (!album.parentId && siblings.length === 0) {
  //   siblings = await Album.unscoped().findAll({ 
  //     where: { parentId: null }, 
  //     raw: true, 
  //     attributes: ['id']
  //   });
  // }
  // siblings = siblings.map(a => a.id);
  const index = siblings.findIndex(a => a.id === album.id);
  response.previousAlbum = index > 0 ? siblings[index - 1].id : null;
  response.nextAlbum = siblings[index + 1] ? siblings[index + 1].id : null;
  response.ancestors = await album.getAncestors();  

  res.json(response);
};
 
// 
const index = async (req, res) => {  
  const opts = await getSearchQueryOpts(req.query, 'albums', true);
  const { rows, count } = await Album.findAndCountAll(opts);
  res.json([rows, count]);
};

const indexRoot = async (req, res) => {
  res.json(await Album.findAll({ where: { location: '' }}));
};

// update the database and get the new albums
const syncRoot = async (req, res) => {
  const results = await Album.syncRoot();
  res.json(results);
};

const update = async (req, res) => {
  const album = await Album.findByPk(req.params.id);
  if (!album) return res.sendStatus(404);
  try {
    await album.update(req.body);
    res.status(200).json(album);
  } catch (error) {    
    console.error(error);    
    res.status(400).send(error.message);
  }
};

const destroy = async (req, res) => {
  const { id } = req.params;
  const [albums, images] = await Promise.all([
    Image.count({ where: { albumId: id }}),
    Album.count({ where: { parentId: id }})
  ]);
  if (albums > 0 || images > 0) throw new Error("Album not empty");    
  const album = await Album.findByPk(id);
  await album.destroy();
  return res.sendStatus(204);
};

// const listContents = async (req, res) => {
//   const { where: albumWhere, order: albumOrder } = await getSearchQueryOpts(req.query, 'albums');
//   const { where: imagesWhere, order: imagesOrder } = await getSearchQueryOpts(req.query, 'images');
//   const album = await Album.findByPk(req.params.id, {
//     order: [
//       ...albumOrder,
//       ...imagesOrder
//     ],
//     include: [
//       { model: Album, as: 'albums', where: albumWhere },
//       { model: Image, as: 'images', where: imagesWhere }
//     ]    
//   });
//   if (album) {
//     return res.json({
//       albums: album.albums || [],
//       images: album.images || []
//     });
//   }
//   res.sendStatus(404);
// };

const listAlbums = async (req, res) => {
  const { id } = req.params;
  const { where, order } = await getSearchQueryOpts(req.query, 'albums');
  const album = await Album.findByPk(id);
  if (album) {    
    const albums = await album.getAlbums({ where, order });
    return res.json(albums);
  }
  res.sendStatus(404);
};

const listImages = async (req, res) => {
  const { where, order } = await getSearchQueryOpts(req.query, 'images');
  const album = await Album.findByPk(req.params.id);
  if (album) {
    const images = await album.getImages({ where, order });
    return res.json(images);
  }
  res.sendStatus(404);
};


const syncAlbum = async (req, res) => {
  const album = await Album.findByPk(req.params.id);
  if (!album) {
    return res.sendStatus(404);
  }
  const results = await album.syncWithDisk();
  res.json(results);
};

const addTag = async (req, res) => {
  const [album, tag] = await Promise.all([
    Album.findByPk(req.params.id),
    Tag.findByPk(req.params.tagId)
  ]);
  if (!album || !tag) {
    return res.sendStatus(404);
  }
  await album.addTag(tag);
  res.sendStatus(204);
};


const removeTag = async (req, res) => {
  const [album, tag] = await Promise.all([
    Album.findByPk(req.params.id),
    Tag.findByPk(req.params.tagId)
  ]);
  await album.removeTag(tag);
  res.sendStatus(204);
};

const addRelatedAlbum = async (req, res) => {
  const { id, relatedId, relationType } = req.params;
  const include = [];
  if (relationType === 'alias') {
    include.push({
      model: Album,
      as: 'relatedAlbums',
      through: { where: { relationType: 'alias' }}
    });
  }
  
  const album = await Album.findByPk(id, { include });  
  const relatedAlbum = await Album.findByPk(relatedId, { include });

  if (!album || !relatedAlbum) {
    throw new NotFoundError();
  }

  await album.addRelatedAlbum(relatedAlbum, { through: { relationType }});
  await relatedAlbum.addRelatedAlbum(album, { through: { relationType }});

  if (relationType === 'alias') {
    // for aliases add relations for all the existing related albums
    await album.addRelatedAlbums(relatedAlbum.relatedAlbums);
    await relatedAlbum.addRelatedAlbums(album.relatedAlbums);
  }
};

// add an additional (non-hierarchical child) image to the album
const addImage = async (req, res) => res.sendStatus(501);

// remove an additional (non-hierarchical child) image from the album
const removeImage = async (req, res) => res.sendStatus(501);

const renameAlbums = async (req, res) => {
  const { id } = req.params;
  const { match, replace } = req.body;
  res.json(await renameItems('Albums', id, new RegExp(match), replace));
};

const renameImages = async (req, res) => {
  const { id } = req.params;
  const { match, replace } = req.body;
  res.json(await renameItems('Images', id, new RegExp(match), replace));
};

const moveAlbums = async (req, res) => {
  const { id: albumId } = req.params;
  const { albumIds, destinationId } = req.body;
  res.json(await moveItems('Albums', albumIds, albumId, destinationId));
};

const moveImages = async (req, res) => {
  const { id: albumId } = req.params;
  const { imageIds, destinationId } = req.body;
  res.json(await moveItems('Images', imageIds, albumId, destinationId));
};

module.exports = {
  addImage,
  addRelatedAlbum,
  addTag,
  destroy,
  index,
  indexRoot,
  listAlbums,
  // listContents,
  listImages,
  moveAlbums,
  moveImages,
  read,
  removeImage,
  renameAlbums,
  renameImages,
  removeTag,
  syncAlbum,
  syncRoot,
  update
};
